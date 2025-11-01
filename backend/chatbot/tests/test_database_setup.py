"""
Test database setup and schema validation
"""
import psycopg2
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

def test_pgvector_extension():
    """Test if pgvector extension is installed"""
    try:
        conn = psycopg2.connect(
            host='localhost',
            port=5432,
            database='mindease_rag',
            user='postgres',
            password='postgres'
        )
        cursor = conn.cursor()
        
        cursor.execute("SELECT * FROM pg_extension WHERE extname = 'vector';")
        result = cursor.fetchone()
        
        cursor.close()
        conn.close()
        
        if result:
            print("✅ pgvector extension is installed")
            return True
        else:
            print("❌ pgvector extension is NOT installed")
            print("   Run: CREATE EXTENSION IF NOT EXISTS vector;")
            return False
    except Exception as e:
        print(f"❌ Error connecting to database: {e}")
        return False

def test_tables_exist():
    """Test if tables exist with correct schema"""
    try:
        conn = psycopg2.connect(
            host='localhost',
            port=5432,
            database='mindease_rag',
            user='postgres',
            password='postgres'
        )
        cursor = conn.cursor()
        
        # Check input_chunks table
        cursor.execute("""
            SELECT column_name, data_type, character_maximum_length
            FROM information_schema.columns
            WHERE table_name = 'input_chunks'
            ORDER BY ordinal_position;
        """)
        input_columns = cursor.fetchall()
        
        # Check output_chunks table
        cursor.execute("""
            SELECT column_name, data_type, character_maximum_length
            FROM information_schema.columns
            WHERE table_name = 'output_chunks'
            ORDER BY ordinal_position;
        """)
        output_columns = cursor.fetchall()
        
        print("\n📊 Input Chunks Table Schema:")
        for col in input_columns:
            print(f"   - {col[0]}: {col[1]}")
        
        print("\n📊 Output Chunks Table Schema:")
        for col in output_columns:
            print(f"   - {col[0]}: {col[1]}")
        
        # Check primary keys
        cursor.execute("""
            SELECT constraint_name, table_name
            FROM information_schema.table_constraints
            WHERE table_name IN ('input_chunks', 'output_chunks')
            AND constraint_type = 'PRIMARY KEY';
        """)
        primary_keys = cursor.fetchall()
        print(f"\n✅ Found {len(primary_keys)} primary key constraints")
        
        # Check foreign key
        cursor.execute("""
            SELECT constraint_name, table_name
            FROM information_schema.table_constraints
            WHERE table_name = 'output_chunks'
            AND constraint_type = 'FOREIGN KEY';
        """)
        foreign_keys = cursor.fetchall()
        print(f"✅ Found {len(foreign_keys)} foreign key constraints")
        
        cursor.close()
        conn.close()
        
        return True
        
    except Exception as e:
        print(f"❌ Error checking tables: {e}")
        return False

def test_indexes_exist():
    """Test if indexes exist for efficient retrieval"""
    try:
        conn = psycopg2.connect(
            host='localhost',
            port=5432,
            database='mindease_rag',
            user='postgres',
            password='postgres'
        )
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT indexname, tablename
            FROM pg_indexes
            WHERE tablename IN ('input_chunks', 'output_chunks')
            ORDER BY tablename, indexname;
        """)
        indexes = cursor.fetchall()
        
        print(f"\n📑 Found {len(indexes)} indexes:")
        for idx in indexes:
            print(f"   - {idx[1]}.{idx[0]}")
        
        cursor.close()
        conn.close()
        
        return len(indexes) > 0
        
    except Exception as e:
        print(f"❌ Error checking indexes: {e}")
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("Database Setup Tests")
    print("=" * 60)
    
    test_pgvector_extension()
    test_tables_exist()
    test_indexes_exist()
    
    print("\n" + "=" * 60)

