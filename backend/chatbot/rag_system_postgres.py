"""
RAG System for MentalChat16K Dataset using PostgreSQL with pgvector
Implements hierarchical retrieval: find input chunks -> get corresponding output chunks

Only uses 'input' and 'output' columns from CSV, ignores 'instruction' column.
"""
import os
# Compatibility: sentence_transformers 2.2.2 expects cached_download (removed in newer huggingface_hub)
try:
    from huggingface_hub import cached_download
except ImportError:
    import re
    import huggingface_hub
    from huggingface_hub import hf_hub_download

    def _cached_download(*args, url=None, filename=None, force_filename=None, repo_id=None, **kwargs):
        url = url or (args[0] if args and isinstance(args[0], str) and args[0].startswith("http") else None)
        fn = filename or (args[1] if len(args) > 1 else None) or force_filename
        if repo_id and fn:
            return hf_hub_download(repo_id=repo_id, filename=fn, **kwargs)
        if url:
            m = re.match(r"https?://[^/]+/([^/]+/[^/]+)/resolve/[^/]+/(.+)", url.strip())
            if m:
                return hf_hub_download(repo_id=m.group(1), filename=fn or m.group(2), **kwargs)
        if repo_id and fn:
            return hf_hub_download(repo_id=repo_id, filename=fn, **kwargs)
        raise ValueError("cached_download shim: need repo_id+filename or url+filename")

    huggingface_hub.cached_download = _cached_download

import pandas as pd
import numpy as np
from typing import List, Dict, Tuple, Optional
from sentence_transformers import SentenceTransformer
import psycopg2
from psycopg2.extras import execute_values
from psycopg2.pool import SimpleConnectionPool
from tqdm import tqdm
import json

class RAGSystem:
    """RAG system for hierarchical retrieval from MentalChat dataset using PostgreSQL"""
    
    def __init__(
        self,
        dataset_path: str = None,
        embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2",
        chunk_size: int = 512,
        chunk_overlap: int = 50,
        db_config: Dict = None
    ):
        """
        Initialize RAG system with PostgreSQL
        
        Args:
            dataset_path: Path to MentalChat16K.csv
            embedding_model: Name of sentence transformer model
            chunk_size: Size of text chunks in tokens (approximate)
            chunk_overlap: Overlap between chunks in tokens (approximate)
            db_config: PostgreSQL connection config dict with keys:
                - host, port, database, user, password
        """
        # Set paths
        if dataset_path is None:
            current_file = os.path.abspath(__file__)
            project_root = os.path.dirname(os.path.dirname(os.path.dirname(current_file)))
            dataset_path = os.path.join(project_root, "dataset", "MentalChat16K.csv")
            
            # Alternative: check if dataset is in current directory or one level up
            if not os.path.exists(dataset_path):
                cwd_dataset = os.path.join(os.getcwd(), "dataset", "MentalChat16K.csv")
                if os.path.exists(cwd_dataset):
                    dataset_path = cwd_dataset
                else:
                    parent_dataset = os.path.join(os.path.dirname(os.getcwd()), "dataset", "MentalChat16K.csv")
                    if os.path.exists(parent_dataset):
                        dataset_path = parent_dataset
        
        self.dataset_path = dataset_path
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        
        # Default PostgreSQL config (can be overridden)
        if db_config is None:
            from chatbot.config import DB_CONFIG as default_config
            self.db_config = default_config.copy()
        else:
            self.db_config = db_config
        
        # Initialize embedding model
        print(f"Loading embedding model: {embedding_model}...")
        self.embedder = SentenceTransformer(embedding_model)
        self.embedding_dim = 384  # For all-MiniLM-L6-v2
        print("Embedding model loaded!")
        
        # Initialize PostgreSQL connection
        self._connect_to_database()
        
        # Check if database is populated
        if self._is_database_empty():
            print("Database is empty. Building from dataset...")
            self._build_vector_database()
        else:
            count = self._get_chunk_count()
            print(f"Database loaded with {count} input chunks")
    
    def _connect_to_database(self):
        """Connect to PostgreSQL database and ensure schema exists"""
        try:
            # Test connection
            conn = psycopg2.connect(**self.db_config)
            conn.autocommit = True
            cursor = conn.cursor()
            
            # Check if pgvector extension exists
            cursor.execute("SELECT * FROM pg_extension WHERE extname = 'vector';")
            if not cursor.fetchone():
                print("Creating pgvector extension...")
                cursor.execute("CREATE EXTENSION IF NOT EXISTS vector;")
            
            # Create tables if they don't exist
            self._create_tables(cursor)
            
            cursor.close()
            conn.close()
            print("PostgreSQL connection established!")
            
        except psycopg2.Error as e:
            print(f"Error connecting to PostgreSQL: {e}")
            error_msg = str(e)
            print("\nPlease ensure:")
            print("1. PostgreSQL is running")
            print(f"2. Database '{self.db_config['database']}' exists")
            
            if "is not available" in error_msg or "extension" in error_msg.lower():
                print("3. pgvector extension needs to be installed on PostgreSQL server")
                print("   Run: python backend\\chatbot\\check_postgres_setup.py")
                print("   For installation instructions")
            else:
                print("3. pgvector extension can be installed")
            print("4. Connection credentials are correct")
            raise
    
    def _create_tables(self, cursor):
        """Create input_chunks and output_chunks tables if they don't exist"""
        # Create input_chunks table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS input_chunks (
                question_no INTEGER NOT NULL,
                chunk_index INTEGER NOT NULL,
                content TEXT NOT NULL,
                embedding vector(384) NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (question_no, chunk_index)
            );
        """)
        
        # Create output_chunks table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS output_chunks (
                question_no INTEGER NOT NULL,
                chunk_index INTEGER NOT NULL,
                content TEXT NOT NULL,
                embedding vector(384),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (question_no, chunk_index),
                FOREIGN KEY (question_no, chunk_index) 
                    REFERENCES input_chunks(question_no, chunk_index) 
                    ON DELETE CASCADE
            );
        """)
        
        # Create indexes if they don't exist
        try:
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS input_chunks_embedding_idx 
                ON input_chunks 
                USING ivfflat (embedding vector_cosine_ops)
                WITH (lists = 100);
            """)
        except:
            # If ivfflat doesn't work, try alternative
            print("Note: Using standard index (ivfflat may not be available)")
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS input_chunks_question_no_idx 
            ON input_chunks(question_no);
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS output_chunks_question_no_idx 
            ON output_chunks(question_no);
        """)
    
    def _is_database_empty(self) -> bool:
        """Check if database has any chunks"""
        try:
            conn = psycopg2.connect(**self.db_config)
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM input_chunks;")
            count = cursor.fetchone()[0]
            cursor.close()
            conn.close()
            return count == 0
        except:
            return True
    
    def _get_chunk_count(self) -> int:
        """Get total number of input chunks"""
        try:
            conn = psycopg2.connect(**self.db_config)
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM input_chunks;")
            count = cursor.fetchone()[0]
            cursor.close()
            conn.close()
            return count
        except:
            return 0
    
    def _chunk_text(self, text: str) -> List[str]:
        """
        Chunk text with overlapping windows
        
        Args:
            text: Text to chunk
            
        Returns:
            List of text chunks
        """
        # Simple word-based chunking (approximate token-based)
        words = text.split()
        chunks = []
        start = 0
        
        while start < len(words):
            # Get chunk
            end = min(start + self.chunk_size, len(words))
            chunk = " ".join(words[start:end])
            if chunk.strip():  # Only add non-empty chunks
                chunks.append(chunk)
            
            # Move start position with overlap
            if end >= len(words):
                break
            start += self.chunk_size - self.chunk_overlap
        
        # Ensure at least one chunk
        if not chunks:
            chunks = [text]
        
        return chunks
    
    def _build_vector_database(self):
        """Build vector database from MentalChat dataset using only input/output columns"""
        print("Loading dataset...")
        df = pd.read_csv(self.dataset_path)
        
        print(f"Dataset loaded: {df.shape[0]} entries")
        print(f"Columns: {df.columns.tolist()}")
        print("Using only 'input' and 'output' columns (ignoring 'instruction')")
        
        # Prepare data for chunking
        chunks_data = []  # List of (question_no, chunk_index, input_chunk, output_chunk)
        
        print("\nChunking dataset...")
        valid_questions = 0
        
        for idx, row in tqdm(df.iterrows(), total=len(df), desc="Processing"):
            # Only use 'input' and 'output' columns
            input_text = str(row.get('input', ''))
            output_text = str(row.get('output', ''))
            
            # Skip if input or output is empty/null
            if pd.isna(row.get('input')) or pd.isna(row.get('output')):
                continue
            
            if not input_text or not output_text or input_text.lower() == 'nan' or output_text.lower() == 'nan':
                continue
            
            # Chunk input and output separately
            input_chunk_list = self._chunk_text(input_text)
            output_chunk_list = self._chunk_text(output_text)
            
            # Ensure matching number of chunks (pad with last chunk if needed)
            max_chunks = max(len(input_chunk_list), len(output_chunk_list))
            
            # Pad shorter list with last chunk
            if len(input_chunk_list) < max_chunks:
                last_input = input_chunk_list[-1] if input_chunk_list else ""
                input_chunk_list.extend([last_input] * (max_chunks - len(input_chunk_list)))
            
            if len(output_chunk_list) < max_chunks:
                last_output = output_chunk_list[-1] if output_chunk_list else ""
                output_chunk_list.extend([last_output] * (max_chunks - len(output_chunk_list)))
            
            # Store chunks with question_no and chunk_index
            for chunk_idx, (in_chunk, out_chunk) in enumerate(zip(input_chunk_list, output_chunk_list)):
                if in_chunk.strip() and out_chunk.strip():  # Only store non-empty chunks
                    chunks_data.append({
                        'question_no': idx,
                        'chunk_index': chunk_idx,
                        'input_content': in_chunk,
                        'output_content': out_chunk
                    })
            
            valid_questions += 1
        
        print(f"\nProcessed {valid_questions} valid questions")
        print(f"Generated {len(chunks_data)} chunk pairs")
        
        # Generate embeddings for input chunks
        print("Generating embeddings for input chunks...")
        input_contents = [chunk['input_content'] for chunk in chunks_data]
        
        embeddings = self.embedder.encode(
            input_contents,
            show_progress_bar=True,
            batch_size=32,
            convert_to_numpy=True,
            normalize_embeddings=True  # Normalize for cosine similarity
        )
        
        # Insert into database
        print("Inserting chunks into PostgreSQL...")
        conn = psycopg2.connect(**self.db_config)
        conn.autocommit = False
        cursor = conn.cursor()
        
        try:
            # Prepare data for bulk insert
            input_chunks_data = [
                (
                    chunk['question_no'],
                    chunk['chunk_index'],
                    chunk['input_content'],
                    str(embeddings[i].tolist())  # Convert numpy array to string format for vector
                )
                for i, chunk in enumerate(chunks_data)
            ]
            
            output_chunks_data = [
                (
                    chunk['question_no'],
                    chunk['chunk_index'],
                    chunk['output_content'],
                    None  # Output embeddings optional
                )
                for chunk in chunks_data
            ]
            
            # Insert input chunks
            print("Inserting input chunks...")
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
            print("Inserting output chunks...")
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
            print(f"Successfully inserted {len(chunks_data)} chunk pairs!")
            
        except Exception as e:
            conn.rollback()
            print(f"Error inserting data: {e}")
            raise
        finally:
            cursor.close()
            conn.close()
    
    def retrieve_context(
        self, 
        query: str, 
        top_k: int = 3,
        similarity_threshold: float = 0.5
    ) -> List[Dict]:
        """
        Retrieve relevant context for a query using hierarchical retrieval
        
        Args:
            query: User query text
            top_k: Number of chunks to retrieve
            similarity_threshold: Minimum similarity score (0-1)
            
        Returns:
            List of dictionaries containing retrieved context
        """
        # Generate query embedding
        query_embedding = self.embedder.encode([query], convert_to_numpy=True)[0]
        query_embedding_str = str(query_embedding.tolist())
        
        # Connect to database
        conn = psycopg2.connect(**self.db_config)
        cursor = conn.cursor()
        
        try:
            # Perform similarity search using pgvector cosine distance
            # Similarity = 1 - cosine_distance
            cursor.execute("""
                SELECT 
                    i.question_no,
                    i.chunk_index,
                    i.content as input_content,
                    o.content as output_content,
                    1 - (i.embedding <=> %s::vector) as similarity
                FROM input_chunks i
                JOIN output_chunks o 
                    ON i.question_no = o.question_no 
                    AND i.chunk_index = o.chunk_index
                WHERE 1 - (i.embedding <=> %s::vector) >= %s
                ORDER BY i.embedding <=> %s::vector
                LIMIT %s
            """, (query_embedding_str, query_embedding_str, similarity_threshold, query_embedding_str, top_k))
            
            results = cursor.fetchall()
            
            # Process results
            retrieved_contexts = []
            for row in results:
                question_no, chunk_index, input_content, output_content, similarity = row
                
                retrieved_contexts.append({
                    'question_no': question_no,
                    'chunk_index': chunk_index,
                    'input_chunk': input_content,
                    'output_chunk': output_content,
                    'similarity': float(similarity)
                })
            
            return retrieved_contexts
            
        finally:
            cursor.close()
            conn.close()
    
    def format_context_for_llm(self, contexts: List[Dict]) -> str:
        """
        Format retrieved contexts for LLM prompt
        
        Args:
            contexts: List of retrieved context dictionaries
            
        Returns:
            Formatted context string
        """
        if not contexts:
            return ""
        
        formatted = "Relevant context from therapy sessions:\n\n"
        for i, ctx in enumerate(contexts, 1):
            formatted += f"Context {i} (similarity: {ctx['similarity']:.2f}):\n"
            formatted += f"Similar situation: {ctx['input_chunk']}\n"
            formatted += f"Previous therapist response: {ctx['output_chunk']}\n\n"
        
        return formatted


if __name__ == "__main__":
    # Test RAG system
    print("Testing RAG System with PostgreSQL...")
    
    # Configure database connection
    db_config = {
        'host': 'localhost',
        'port': 5432,
        'database': 'mindease_rag',
        'user': 'postgres',
        'password': 'postgres'  # Update with your password
    }
    
    rag = RAGSystem(db_config=db_config)
    
    test_query = "I'm feeling very anxious about my upcoming exam and can't sleep"
    print(f"\nQuery: {test_query}\n")
    
    contexts = rag.retrieve_context(test_query, top_k=3)
    print(f"Retrieved {len(contexts)} contexts:")
    for ctx in contexts:
        print(f"\nSimilarity: {ctx['similarity']:.3f}")
        print(f"Question No: {ctx['question_no']}, Chunk Index: {ctx['chunk_index']}")
        print(f"Input: {ctx['input_chunk'][:100]}...")
        print(f"Output: {ctx['output_chunk'][:100]}...")
    
    print("\n" + "="*50)
    print("Formatted context for LLM:")
    print("="*50)
    print(rag.format_context_for_llm(contexts))

