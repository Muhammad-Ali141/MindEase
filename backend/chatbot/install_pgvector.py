"""
Install pgvector extension in PostgreSQL database
"""
import psycopg2
import sys

# Import configuration
from chatbot.config import DB_CONFIG

def install_pgvector():
    """Install pgvector extension"""
    try:
        print("Connecting to PostgreSQL database...")
        conn = psycopg2.connect(**DB_CONFIG)
        conn.autocommit = True  # Required for CREATE EXTENSION
        cursor = conn.cursor()
        
        print(f"Connected to database: {DB_CONFIG['database']}")
        
        # Check if extension already exists
        print("\nChecking if pgvector extension exists...")
        cursor.execute("SELECT * FROM pg_extension WHERE extname = 'vector';")
        result = cursor.fetchone()
        
        if result:
            print("[OK] pgvector extension is already installed!")
            print(f"   Extension details: {result}")
            cursor.close()
            conn.close()
            return True
        
        # Try to create extension
        print("\nAttempting to install pgvector extension...")
        try:
            cursor.execute("CREATE EXTENSION IF NOT EXISTS vector;")
            print("[SUCCESS] pgvector extension installed successfully!")
            
            # Verify installation
            cursor.execute("SELECT * FROM pg_extension WHERE extname = 'vector';")
            result = cursor.fetchone()
            if result:
                print(f"[OK] Verified: {result}")
            
            cursor.close()
            conn.close()
            return True
            
        except psycopg2.Error as e:
            error_msg = str(e)
            print(f"[FAIL] Could not install pgvector extension: {error_msg}")
            
            if "is not available" in error_msg or "could not open extension control file" in error_msg:
                print("\n" + "="*60)
                print("pgvector needs to be installed on the PostgreSQL server first.")
                print("="*60)
                print("\nInstallation options:")
                print("\n1. Windows - Using pre-built binaries:")
                print("   - Download from: https://github.com/pgvector/pgvector/releases")
                print("   - Extract and copy .dll files to PostgreSQL lib directory")
                print("   - Copy .sql and .control files to PostgreSQL share/extension directory")
                print("\n2. Or build from source:")
                print("   - Download source: git clone https://github.com/pgvector/pgvector.git")
                print("   - Follow build instructions for your platform")
                print("\n3. Or use package manager (if available):")
                print("   - Some PostgreSQL distributions include pgvector")
                print("\nAfter installation, re-run this script.")
                print("="*60)
            
            cursor.close()
            conn.close()
            return False
            
    except psycopg2.Error as e:
        print(f"[FAIL] Error connecting to database: {e}")
        print(f"   Database: {DB_CONFIG['database']}")
        print(f"   Host: {DB_CONFIG['host']}:{DB_CONFIG['port']}")
        print(f"   User: {DB_CONFIG['user']}")
        return False
    except Exception as e:
        print(f"[FAIL] Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("=" * 60)
    print("pgvector Installation Script")
    print("=" * 60)
    print(f"\nDatabase: {DB_CONFIG['database']}")
    print(f"Host: {DB_CONFIG['host']}:{DB_CONFIG['port']}")
    print(f"User: {DB_CONFIG['user']}\n")
    
    success = install_pgvector()
    
    print("\n" + "=" * 60)
    if success:
        print("[SUCCESS] pgvector is ready to use!")
    else:
        print("[FAIL] pgvector installation failed. See instructions above.")
    print("=" * 60)
    
    sys.exit(0 if success else 1)

