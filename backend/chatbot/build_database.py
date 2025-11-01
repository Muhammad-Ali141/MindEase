"""
Standalone script to build vector database for Phase 2 completion
"""
import os
import sys
import pandas as pd
import numpy as np
import psycopg2
from psycopg2.extras import execute_values
from tqdm import tqdm

# Try to import sentence_transformers
try:
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError as e:
    print(f"[ERROR] Could not import sentence_transformers: {e}")
    print("[INFO] Please install/update dependencies:")
    print("  pip install --upgrade torch torchvision sentence-transformers")
    sys.exit(1)

# Import configuration
from chatbot.config import DB_CONFIG

def chunk_text(text, chunk_size=512, chunk_overlap=50):
    """Chunk text with overlapping windows"""
    words = text.split()
    chunks = []
    start = 0
    
    while start < len(words):
        end = min(start + chunk_size, len(words))
        chunk = " ".join(words[start:end])
        if chunk.strip():
            chunks.append(chunk)
        if end >= len(words):
            break
        start += chunk_size - chunk_overlap
    
    return chunks if chunks else [text]

def build_database():
    """Build vector database from CSV"""
    print("=" * 70)
    print("Building Vector Database for Phase 2 Completion")
    print("=" * 70)
    
    # Get dataset path
    current_file = os.path.abspath(__file__)
    project_root = os.path.dirname(os.path.dirname(os.path.dirname(current_file)))
    dataset_path = os.path.join(project_root, "dataset", "MentalChat16K.csv")
    
    if not os.path.exists(dataset_path):
        print(f"[FAIL] Dataset not found at: {dataset_path}")
        return False
    
    print(f"\n[INFO] Loading dataset from: {dataset_path}")
    df = pd.read_csv(dataset_path)
    print(f"[OK] Dataset loaded: {df.shape[0]} rows")
    
    # Check if database already has data
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM input_chunks;")
        existing_count = cursor.fetchone()[0]
        cursor.close()
        conn.close()
        
        if existing_count > 0:
            print(f"[INFO] Database already has {existing_count} chunks")
            response = input("Do you want to rebuild? (y/n): ")
            if response.lower() != 'y':
                print("[SKIP] Database build skipped")
                return True
            else:
                # Clear existing data
                conn = psycopg2.connect(**DB_CONFIG)
                conn.autocommit = True
                cursor = conn.cursor()
                cursor.execute("TRUNCATE TABLE output_chunks CASCADE;")
                cursor.execute("TRUNCATE TABLE input_chunks CASCADE;")
                cursor.close()
                conn.close()
                print("[OK] Existing data cleared")
    except Exception as e:
        print(f"[WARN] Error checking existing data: {e}")
    
    # Initialize embedding model
    print("\n[INFO] Loading embedding model: sentence-transformers/all-MiniLM-L6-v2")
    try:
        embedder = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')
        print("[OK] Embedding model loaded!")
    except Exception as e:
        print(f"[FAIL] Error loading embedding model: {e}")
        return False
    
    # Prepare chunks
    print("\n[INFO] Chunking dataset...")
    chunks_data = []
    valid_questions = 0
    
    for idx, row in tqdm(df.iterrows(), total=len(df), desc="Processing"):
        input_text = str(row.get('input', ''))
        output_text = str(row.get('output', ''))
        
        if pd.isna(input_text) or pd.isna(output_text):
            continue
        
        if not input_text or not output_text or input_text.lower() == 'nan' or output_text.lower() == 'nan':
            continue
        
        input_chunk_list = chunk_text(input_text)
        output_chunk_list = chunk_text(output_text)
        
        max_chunks = max(len(input_chunk_list), len(output_chunk_list))
        
        if len(input_chunk_list) < max_chunks:
            last_input = input_chunk_list[-1] if input_chunk_list else ""
            input_chunk_list.extend([last_input] * (max_chunks - len(input_chunk_list)))
        
        if len(output_chunk_list) < max_chunks:
            last_output = output_chunk_list[-1] if output_chunk_list else ""
            output_chunk_list.extend([last_output] * (max_chunks - len(output_chunk_list)))
        
        for chunk_idx, (in_chunk, out_chunk) in enumerate(zip(input_chunk_list, output_chunk_list)):
            if in_chunk.strip() and out_chunk.strip():
                chunks_data.append({
                    'question_no': idx,
                    'chunk_index': chunk_idx,
                    'input_content': in_chunk,
                    'output_content': out_chunk
                })
        
        valid_questions += 1
    
    print(f"\n[OK] Processed {valid_questions} valid questions")
    print(f"[OK] Generated {len(chunks_data)} chunk pairs")
    
    # Generate embeddings
    print("\n[INFO] Generating embeddings for input chunks...")
    input_contents = [chunk['input_content'] for chunk in chunks_data]
    
    try:
        embeddings = embedder.encode(
            input_contents,
            show_progress_bar=True,
            batch_size=32,
            convert_to_numpy=True,
            normalize_embeddings=True
        )
        print("[OK] Embeddings generated!")
    except Exception as e:
        print(f"[FAIL] Error generating embeddings: {e}")
        return False
    
    # Insert into database
    print("\n[INFO] Inserting chunks into PostgreSQL...")
    conn = psycopg2.connect(**DB_CONFIG)
    conn.autocommit = False
    cursor = conn.cursor()
    
    try:
        input_chunks_data = [
            (
                chunk['question_no'],
                chunk['chunk_index'],
                chunk['input_content'],
                str(embeddings[i].tolist())
            )
            for i, chunk in enumerate(chunks_data)
        ]
        
        output_chunks_data = [
            (
                chunk['question_no'],
                chunk['chunk_index'],
                chunk['output_content'],
                None
            )
            for chunk in chunks_data
        ]
        
        # Insert input chunks
        print("[INFO] Inserting input chunks...")
        execute_values(
            cursor,
            """
            INSERT INTO input_chunks (question_no, chunk_index, content, embedding)
            VALUES %s
            ON CONFLICT (question_no, chunk_index) DO UPDATE
            SET content = EXCLUDED.content, embedding = EXCLUDED.embedding
            """,
            input_chunks_data,
            template="(%s, %s, %s, %s::vector)",
            page_size=1000
        )
        
        # Insert output chunks
        print("[INFO] Inserting output chunks...")
        execute_values(
            cursor,
            """
            INSERT INTO output_chunks (question_no, chunk_index, content, embedding)
            VALUES %s
            ON CONFLICT (question_no, chunk_index) DO UPDATE
            SET content = EXCLUDED.content
            """,
            output_chunks_data,
            template="(%s, %s, %s, %s)",
            page_size=1000
        )
        
        conn.commit()
        print(f"[SUCCESS] Successfully inserted {len(chunks_data)} chunk pairs!")
        
        # Verify insertion
        cursor.execute("SELECT COUNT(*) FROM input_chunks;")
        input_count = cursor.fetchone()[0]
        cursor.execute("SELECT COUNT(*) FROM output_chunks;")
        output_count = cursor.fetchone()[0]
        
        print(f"\n[VERIFY] Input chunks: {input_count}")
        print(f"[VERIFY] Output chunks: {output_count}")
        
        cursor.close()
        conn.close()
        
        return True
        
    except Exception as e:
        conn.rollback()
        print(f"[FAIL] Error inserting data: {e}")
        import traceback
        traceback.print_exc()
        cursor.close()
        conn.close()
        return False

if __name__ == "__main__":
    success = build_database()
    
    print("\n" + "=" * 70)
    if success:
        print("[SUCCESS] Database build completed!")
        print("\nNext step: Re-run Phase 2 tests to verify:")
        print("  python backend\\chatbot\\tests\\test_data_ingestion.py")
    else:
        print("[FAIL] Database build failed. Check errors above.")
    print("=" * 70)
    
    sys.exit(0 if success else 1)

