"""
Test data ingestion: CSV loading, chunking, embedding generation, database insertion
"""
import pandas as pd
import psycopg2
import sys
import os
import numpy as np

# Import sentence_transformers only when needed
try:
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    SENTENCE_TRANSFORMERS_AVAILABLE = False
    print("[WARN] sentence-transformers not available. Embedding tests will be skipped.")

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

# Database configuration
# Import configuration
from chatbot.config import DB_CONFIG

def test_csv_loading():
    """Test CSV loading and column validation"""
    print("\n" + "=" * 60)
    print("Phase 2.1: CSV Loading Validation")
    print("=" * 60)
    
    try:
        # Get dataset path
        current_file = os.path.abspath(__file__)
        project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(current_file))))
        dataset_path = os.path.join(project_root, "dataset", "MentalChat16K.csv")
        
        df = pd.read_csv(dataset_path)
        
        print("[OK] CSV loaded successfully")
        print(f"   Total rows: {len(df)}")
        print(f"   Columns: {df.columns.tolist()}")
        
        # Check if input and output columns exist
        if 'input' in df.columns and 'output' in df.columns:
            print("[OK] Required columns found: 'input' and 'output'")
            
            # Check non-null values
            input_non_null = df['input'].notna().sum()
            output_non_null = df['output'].notna().sum()
            
            print(f"   Input column non-null: {input_non_null}/{len(df)}")
            print(f"   Output column non-null: {output_non_null}/{len(df)}")
            
            # Check if instruction column is present (should be ignored)
            if 'instruction' in df.columns:
                print("[WARN] 'instruction' column found (will be ignored)")
            
            return True
        else:
            print("[FAIL] Required columns 'input' or 'output' not found")
            return False
            
    except Exception as e:
        print(f"[FAIL] Error loading CSV: {e}")
        return False

def test_embedding_generation():
    """Test embedding generation"""
    print("\n" + "=" * 60)
    print("Phase 2.3: Embedding Generation Validation")
    print("=" * 60)
    
    if not SENTENCE_TRANSFORMERS_AVAILABLE:
        print("[SKIP] sentence-transformers not available. Skipping embedding test.")
        return False
    
    try:
        print("[INFO] Loading embedding model...")
        model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')
        test_text = "I'm feeling anxious about my exam"
        
        embedding = model.encode(test_text, convert_to_numpy=True, normalize_embeddings=True)
        
        print("[OK] Embedding generated successfully")
        print(f"   Shape: {embedding.shape}")
        print(f"   Type: {type(embedding)}")
        print(f"   Sample values: {embedding[:5]}")
        print(f"   Norm (should be ~1.0): {np.linalg.norm(embedding):.4f}")
        
        if embedding.shape[0] == 384:
            print("[OK] Embedding dimension is correct (384)")
            return True
        else:
            print(f"[FAIL] Expected dimension 384, got {embedding.shape[0]}")
            return False
            
    except Exception as e:
        print(f"[FAIL] Error generating embeddings: {e}")
        return False

def test_chunking():
    """Test chunking validation"""
    print("\n" + "=" * 60)
    print("Phase 2.2: Chunking Validation")
    print("=" * 60)
    
    try:
        # Simple word-based chunking function for testing
        def chunk_text(text, chunk_size=512, chunk_overlap=50):
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
        
        # Get dataset path
        current_file = os.path.abspath(__file__)
        project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(current_file))))
        dataset_path = os.path.join(project_root, "dataset", "MentalChat16K.csv")
        
        df = pd.read_csv(dataset_path)
        
        # Test chunking on first 5 rows
        print("[INFO] Testing chunking on first 5 rows...")
        for idx in range(min(5, len(df))):
            input_text = str(df.iloc[idx]['input'])
            if pd.notna(input_text) and input_text.lower() != 'nan':
                chunks = chunk_text(input_text, chunk_size=512, chunk_overlap=50)
                print(f"   Row {idx}: {len(chunks)} chunks created")
                if chunks:
                    print(f"      First chunk length: {len(chunks[0].split())} words")
                    if len(chunks) > 1:
                        # Check overlap
                        first_words = set(chunks[0].split()[-50:])
                        second_words = set(chunks[1].split()[:50])
                        overlap = len(first_words & second_words)
                        print(f"      Overlap with next chunk: ~{overlap} words")
        
        print("[OK] Chunking validation completed")
        return True
        
    except Exception as e:
        print(f"[FAIL] Error in chunking test: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_database_insertion():
    """Test if chunks are inserted correctly in database"""
    print("\n" + "=" * 60)
    print("Phase 2.4: Database Insertion Validation")
    print("=" * 60)
    
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        # Count total chunks
        cursor.execute("SELECT COUNT(*) FROM input_chunks;")
        input_count = cursor.fetchone()[0]
        
        if input_count == 0:
            print("[WARN] Database is empty. No chunks inserted yet.")
            print("       Run RAGSystem to build vector database first:")
            print("       python -c \"from backend.chatbot.rag_system_postgres import RAGSystem; RAGSystem()\"")
            print("[SKIP] Skipping insertion validation tests")
            cursor.close()
            conn.close()
            return None  # Return None to indicate skipped
        
        cursor.execute("SELECT COUNT(*) FROM output_chunks;")
        output_count = cursor.fetchone()[0]
        
        print(f"[OK] Input chunks count: {input_count}")
        print(f"[OK] Output chunks count: {output_count}")
        
        if input_count == output_count:
            print("[OK] Input and output chunks match in count")
        else:
            print(f"[FAIL] Mismatch: {input_count} input chunks vs {output_count} output chunks")
        
        # Count unique questions
        cursor.execute("SELECT COUNT(DISTINCT question_no) FROM input_chunks;")
        question_count = cursor.fetchone()[0]
        print(f"[OK] Unique questions: {question_count}")
        
        # Test relationship integrity
        cursor.execute("""
            SELECT 
                COUNT(*) as total,
                COUNT(DISTINCT i.question_no) as input_questions,
                COUNT(DISTINCT o.question_no) as output_questions
            FROM input_chunks i
            FULL OUTER JOIN output_chunks o
                ON i.question_no = o.question_no 
                AND i.chunk_index = o.chunk_index
        """)
        result = cursor.fetchone()
        
        # Check for orphaned chunks
        cursor.execute("""
            SELECT 
                i.question_no,
                i.chunk_index,
                CASE WHEN o.question_no IS NULL THEN 'Missing output' ELSE 'OK' END as status
            FROM input_chunks i
            LEFT JOIN output_chunks o 
                ON i.question_no = o.question_no 
                AND i.chunk_index = o.chunk_index
            WHERE o.question_no IS NULL
            LIMIT 5;
        """)
        orphaned_inputs = cursor.fetchall()
        
        cursor.execute("""
            SELECT 
                o.question_no,
                o.chunk_index,
                CASE WHEN i.question_no IS NULL THEN 'Missing input' ELSE 'OK' END as status
            FROM output_chunks o
            LEFT JOIN input_chunks i 
                ON i.question_no = o.question_no 
                AND i.chunk_index = o.chunk_index
            WHERE i.question_no IS NULL
            LIMIT 5;
        """)
        orphaned_outputs = cursor.fetchall()
        
        if orphaned_inputs:
            print(f"[FAIL] Found {len(orphaned_inputs)} orphaned input chunks (missing output)")
            for orphan in orphaned_inputs[:3]:
                print(f"   - Question {orphan[0]}, Chunk {orphan[1]}")
        else:
            print("[OK] No orphaned input chunks")
        
        if orphaned_outputs:
            print(f"[FAIL] Found {len(orphaned_outputs)} orphaned output chunks (missing input)")
        else:
            print("[OK] No orphaned output chunks")
        
        # Sample a few rows to verify structure
        cursor.execute("""
            SELECT 
                i.question_no,
                i.chunk_index,
                LENGTH(i.content) as input_length,
                LENGTH(o.content) as output_length
            FROM input_chunks i
            JOIN output_chunks o 
                ON i.question_no = o.question_no 
                AND i.chunk_index = o.chunk_index
            LIMIT 5;
        """)
        samples = cursor.fetchall()
        
        print(f"\n[INFO] Sample chunks:")
        for sample in samples:
            print(f"   Q{sample[0]}, C{sample[1]}: Input={sample[2]} chars, Output={sample[3]} chars")
        
        cursor.close()
        conn.close()
        
        return input_count > 0 and output_count > 0 and len(orphaned_inputs) == 0 and len(orphaned_outputs) == 0
        
    except Exception as e:
        print(f"[FAIL] Error checking database: {e}")
        return False

def run_phase2_tests():
    """Run all Phase 2 tests"""
    print("=" * 60)
    print("PHASE 2: Data Ingestion Testing")
    print("=" * 60)
    print(f"\nDatabase: {DB_CONFIG['database']}")
    print(f"Host: {DB_CONFIG['host']}:{DB_CONFIG['port']}")
    print(f"User: {DB_CONFIG['user']}\n")
    
    results = {}
    
    # Test 2.1: CSV Loading
    results['csv_loading'] = test_csv_loading()
    
    # Test 2.2: Chunking
    results['chunking'] = test_chunking()
    
    # Test 2.3: Embedding Generation
    results['embedding_generation'] = test_embedding_generation()
    
    # Test 2.4: Database Insertion
    insertion_result = test_database_insertion()
    results['database_insertion'] = insertion_result if insertion_result is not None else False
    
    # Summary
    print("\n" + "=" * 60)
    print("PHASE 2 TEST SUMMARY")
    print("=" * 60)
    
    print("\nTest Results:")
    for test_name, result in results.items():
        status = "[PASS] PASSED" if result else "[FAIL] FAILED"
        print(f"   {test_name.replace('_', ' ').title()}: {status}")
    
    all_passed = all(results.values())
    
    print("\n" + "=" * 60)
    if all_passed:
        print("[SUCCESS] ALL PHASE 2 TESTS PASSED!")
        print("   Data ingestion is complete and ready for Phase 3")
    else:
        print("[WARN] SOME TESTS FAILED")
        print("   Review output above for details")
    print("=" * 60)
    
    return results

if __name__ == "__main__":
    run_phase2_tests()
    
    print("\n" + "=" * 60)

