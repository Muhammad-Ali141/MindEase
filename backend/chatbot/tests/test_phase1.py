"""
Phase 1: Database Setup & Schema Validation
Testing plan phase 1.1 and 1.2
"""
import psycopg2
import sys
import os

# Import configuration
from chatbot.config import DB_CONFIG

def test_pgvector_extension():
    """Test 1.1: PostgreSQL Setup Verification - Check pgvector extension"""
    print("\n" + "=" * 60)
    print("Test 1.1: PostgreSQL Setup Verification")
    print("=" * 60)
    
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        # Check if pgvector extension exists
        cursor.execute("SELECT * FROM pg_extension WHERE extname = 'vector';")
        result = cursor.fetchone()
        
        if result:
            print("[OK] pgvector extension is installed")
            print(f"   Extension details: {result}")
            return True
        else:
            print("[FAIL] pgvector extension is NOT installed")
            print("   Attempting to create extension...")
            try:
                cursor.execute("CREATE EXTENSION IF NOT EXISTS vector;")
                conn.commit()
                print("[OK] pgvector extension created successfully!")
                return True
            except Exception as e:
                print(f"[FAIL] Error creating extension: {e}")
                print("   Please install pgvector manually:")
                print("   CREATE EXTENSION IF NOT EXISTS vector;")
                return False
        
        cursor.close()
        conn.close()
        
    except psycopg2.Error as e:
        print(f"[FAIL] Error connecting to database: {e}")
        print(f"   Database: {DB_CONFIG['database']}")
        print(f"   User: {DB_CONFIG['user']}")
        print(f"   Host: {DB_CONFIG['host']}:{DB_CONFIG['port']}")
        return False

def test_tables_exist():
    """Test 1.2: Schema Validation - Check if tables exist"""
    print("\n" + "=" * 60)
    print("Test 1.2: Schema Validation - Tables Existence")
    print("=" * 60)
    
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        # Check if tables exist
        cursor.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('input_chunks', 'output_chunks');
        """)
        tables = cursor.fetchall()
        table_names = [t[0] for t in tables]
        
        print(f"Found tables: {table_names}")
        
        if 'input_chunks' in table_names and 'output_chunks' in table_names:
            print("[OK] Both tables exist: input_chunks and output_chunks")
        elif 'input_chunks' in table_names:
            print("[WARN] Only input_chunks table exists (output_chunks missing)")
            return False
        elif 'output_chunks' in table_names:
            print("[WARN] Only output_chunks table exists (input_chunks missing)")
            return False
        else:
            print("[FAIL] Tables do not exist yet")
            print("   Tables will be created automatically by RAGSystem")
            print("   Or run: backend/chatbot/postgresql_schema.sql")
            cursor.close()
            conn.close()
            return False
        
        cursor.close()
        conn.close()
        
        return True
        
    except psycopg2.Error as e:
        print(f"[FAIL] Error checking tables: {e}")
        return False

def test_schema_structure():
    """Test 1.2: Schema Validation - Verify table structure"""
    print("\n" + "=" * 60)
    print("Test 1.2: Schema Validation - Table Structure")
    print("=" * 60)
    
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        # Check input_chunks table structure
        print("\n[INFO] Input Chunks Table Schema:")
        cursor.execute("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = 'input_chunks'
            ORDER BY ordinal_position;
        """)
        input_columns = cursor.fetchall()
        
        expected_input_columns = {
            'question_no': 'integer',
            'chunk_index': 'integer',
            'content': 'text',
            'embedding': 'USER-DEFINED'  # vector type shows as USER-DEFINED
        }
        
        for col in input_columns:
            col_name, data_type, is_nullable, default = col
            print(f"   - {col_name}: {data_type} (nullable: {is_nullable})")
            
            # Check if vector type
            if col_name == 'embedding':
                cursor.execute("""
                    SELECT typname 
                    FROM pg_type 
                    WHERE oid = (
                        SELECT atttypid 
                        FROM pg_attribute 
                        WHERE attrelid = 'input_chunks'::regclass 
                        AND attname = 'embedding'
                    );
                """)
                type_result = cursor.fetchone()
                if type_result and 'vector' in type_result[0].lower():
                    print(f"     [OK] Embedding is vector type: {type_result[0]}")
                else:
                    print(f"     [WARN] Embedding type: {type_result[0] if type_result else 'unknown'}")
        
        # Check output_chunks table structure
        print("\n[INFO] Output Chunks Table Schema:")
        cursor.execute("""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = 'output_chunks'
            ORDER BY ordinal_position;
        """)
        output_columns = cursor.fetchall()
        
        for col in output_columns:
            col_name, data_type, is_nullable, default = col
            print(f"   - {col_name}: {data_type} (nullable: {is_nullable})")
        
        cursor.close()
        conn.close()
        
        return len(input_columns) > 0 and len(output_columns) > 0
        
    except psycopg2.Error as e:
        print(f"[FAIL] Error checking schema: {e}")
        return False

def test_primary_keys():
    """Test 1.2: Schema Validation - Verify primary keys"""
    print("\n" + "=" * 60)
    print("Test 1.2: Schema Validation - Primary Keys")
    print("=" * 60)
    
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        # Check primary keys
        cursor.execute("""
            SELECT 
                tc.constraint_name,
                tc.table_name,
                string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name
                AND tc.table_schema = kcu.table_schema
            WHERE tc.table_name IN ('input_chunks', 'output_chunks')
            AND tc.constraint_type = 'PRIMARY KEY'
            GROUP BY tc.constraint_name, tc.table_name;
        """)
        primary_keys = cursor.fetchall()
        
        print(f"\nFound {len(primary_keys)} primary key constraints:")
        for pk in primary_keys:
            constraint_name, table_name, columns = pk
            print(f"   - {table_name}: {constraint_name} on ({columns})")
            
            # Verify composite key for both tables
            if table_name in ['input_chunks', 'output_chunks']:
                if 'question_no' in columns and 'chunk_index' in columns:
                    print(f"     [OK] Correct composite primary key (question_no, chunk_index)")
                else:
                    print(f"     [FAIL] Expected composite key (question_no, chunk_index)")
        
        cursor.close()
        conn.close()
        
        return len(primary_keys) == 2  # Both tables should have primary keys
        
    except psycopg2.Error as e:
        print(f"[FAIL] Error checking primary keys: {e}")
        return False

def test_foreign_keys():
    """Test 1.2: Schema Validation - Verify foreign key relationships"""
    print("\n" + "=" * 60)
    print("Test 1.2: Schema Validation - Foreign Keys")
    print("=" * 60)
    
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        # Check foreign keys
        cursor.execute("""
            SELECT 
                tc.constraint_name,
                tc.table_name,
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name
            FROM information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_name = 'output_chunks';
        """)
        foreign_keys = cursor.fetchall()
        
        if foreign_keys:
            print(f"\n[OK] Found {len(foreign_keys)} foreign key constraint(s):")
            for fk in foreign_keys:
                constraint_name, table_name, column_name, foreign_table, foreign_column = fk
                print(f"   - {table_name}.{column_name} -> {foreign_table}.{foreign_column}")
                print(f"     Constraint: {constraint_name}")
                
                # Verify it references input_chunks
                if foreign_table == 'input_chunks':
                    print(f"     [OK] Correctly references input_chunks")
        else:
            print("\n[WARN] No foreign key constraint found")
            print("   output_chunks should have foreign key to input_chunks")
        
        cursor.close()
        conn.close()
        
        return len(foreign_keys) > 0
        
    except psycopg2.Error as e:
        print(f"[FAIL] Error checking foreign keys: {e}")
        return False

def test_indexes():
    """Test 1.2: Schema Validation - Verify indexes"""
    print("\n" + "=" * 60)
    print("Test 1.2: Schema Validation - Indexes")
    print("=" * 60)
    
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        # Check indexes
        cursor.execute("""
            SELECT indexname, tablename, indexdef
            FROM pg_indexes
            WHERE schemaname = 'public'
            AND tablename IN ('input_chunks', 'output_chunks')
            ORDER BY tablename, indexname;
        """)
        indexes = cursor.fetchall()
        
        print(f"\n[INFO] Found {len(indexes)} indexes:")
        for idx in indexes:
            index_name, table_name, index_def = idx
            print(f"   - {table_name}.{index_name}")
            if 'vector' in index_def.lower() or 'embedding' in index_def.lower():
                print(f"     [OK] Vector similarity index")
            elif 'question_no' in index_def.lower():
                print(f"     [OK] Question number index")
        
        # Check for vector index specifically
        vector_indexes = [idx for idx in indexes if 'vector' in idx[2].lower() or 'embedding' in idx[2].lower()]
        if vector_indexes:
            print(f"\n[OK] Found {len(vector_indexes)} vector similarity index(es)")
        else:
            print("\n[WARN] No vector similarity index found")
            print("   Consider creating IVFFlat or HNSW index for fast similarity search")
        
        cursor.close()
        conn.close()
        
        return len(indexes) >= 2  # At least primary key indexes
        
    except psycopg2.Error as e:
        print(f"[FAIL] Error checking indexes: {e}")
        return False

def run_phase1_tests():
    """Run all Phase 1 tests"""
    print("=" * 60)
    print("PHASE 1: Database Setup & Schema Validation")
    print("=" * 60)
    print(f"\nDatabase: {DB_CONFIG['database']}")
    print(f"Host: {DB_CONFIG['host']}:{DB_CONFIG['port']}")
    print(f"User: {DB_CONFIG['user']}")
    
    results = {}
    
    # Test 1.1: PostgreSQL Setup Verification
    results['pgvector'] = test_pgvector_extension()
    
    # Test 1.2: Schema Validation
    results['tables_exist'] = test_tables_exist()
    
    if results['tables_exist']:
        results['schema_structure'] = test_schema_structure()
        results['primary_keys'] = test_primary_keys()
        results['foreign_keys'] = test_foreign_keys()
        results['indexes'] = test_indexes()
    else:
        print("\n[WARN] Skipping schema tests - tables do not exist yet")
        print("   Tables will be created by RAGSystem or run schema SQL manually")
        results['schema_structure'] = False
        results['primary_keys'] = False
        results['foreign_keys'] = False
        results['indexes'] = False
    
    # Summary
    print("\n" + "=" * 60)
    print("PHASE 1 TEST SUMMARY")
    print("=" * 60)
    
    print("\nTest Results:")
    for test_name, result in results.items():
        status = "[PASS] PASSED" if result else "[FAIL] FAILED"
        print(f"   {test_name.replace('_', ' ').title()}: {status}")
    
    all_passed = all(results.values())
    
    print("\n" + "=" * 60)
    if all_passed:
        print("[SUCCESS] ALL PHASE 1 TESTS PASSED!")
        print("   Database setup is complete and ready for Phase 2")
    else:
        print("[WARN] SOME TESTS FAILED OR TABLES DON'T EXIST YET")
        print("   This is normal if tables haven't been created yet")
        print("   Tables will be created automatically when RAGSystem runs")
    print("=" * 60)
    
    return results

if __name__ == "__main__":
    run_phase1_tests()

