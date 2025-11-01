"""
Check PostgreSQL setup and provide pgvector installation guidance
"""
import psycopg2
import subprocess
import os
import sys

# Import configuration
from chatbot.config import DB_CONFIG

def check_postgres_version():
    """Check PostgreSQL version"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        cursor.execute("SELECT version();")
        version = cursor.fetchone()[0]
        cursor.close()
        conn.close()
        return version
    except Exception as e:
        print(f"Error: {e}")
        return None

def find_postgres_install_path():
    """Try to find PostgreSQL installation path on Windows"""
    common_paths = [
        r"C:\Program Files\PostgreSQL",
        r"C:\Program Files (x86)\PostgreSQL",
        os.path.expanduser(r"~\AppData\Local\Programs\PostgreSQL"),
    ]
    
    for base_path in common_paths:
        if os.path.exists(base_path):
            # Look for versioned directories
            for item in os.listdir(base_path):
                path = os.path.join(base_path, item)
                if os.path.isdir(path) and item.replace('.', '').isdigit():
                    return path
    
    return None

def install_pgvector_windows():
    """Provide instructions for installing pgvector on Windows"""
    print("\n" + "="*70)
    print("pgvector Installation Guide for Windows")
    print("="*70)
    
    # Check PostgreSQL version
    version = check_postgres_version()
    if version:
        print(f"\n[OK] PostgreSQL Version: {version}")
        # Extract major version number
        try:
            major_version = version.split()[1].split('.')[0]
            print(f"   Detected major version: {major_version}")
        except:
            major_version = None
            print("   Could not detect version number")
    else:
        print("\n[WARN] Could not detect PostgreSQL version")
        major_version = None
    
    # Find PostgreSQL installation
    pg_path = find_postgres_install_path()
    
    print("\n" + "-"*70)
    print("STEP 1: Download pgvector")
    print("-"*70)
    print("1. Go to: https://github.com/pgvector/pgvector/releases")
    print("2. Download the latest release for Windows")
    print("3. Look for file matching your PostgreSQL version")
    if major_version:
        print(f"   Recommended: pgvector-v0.x.x-pg{major_version}-windows-x64.zip")
    else:
        print("   Recommended: pgvector-v0.x.x-pgXX-windows-x64.zip (match your version)")
    
    print("\n" + "-"*70)
    print("STEP 2: Extract and Copy Files")
    print("-"*70)
    
    if pg_path:
        print(f"[OK] Found PostgreSQL at: {pg_path}")
        lib_path = os.path.join(pg_path, "lib")
        share_path = os.path.join(pg_path, "share", "extension")
        
        print(f"\nCopy files to:")
        print(f"   - .dll files -> {lib_path}")
        print(f"   - .sql and .control files -> {share_path}")
    else:
        print("[WARN] Could not auto-detect PostgreSQL path")
        print("\nManually find your PostgreSQL installation:")
        print("   - Usually in: C:\\Program Files\\PostgreSQL\\XX")
        print("   - Where XX is your version number")
        print("\nCopy files to:")
        print("   - .dll files -> PostgreSQL\\XX\\lib\\")
        print("   - .sql and .control files -> PostgreSQL\\XX\\share\\extension\\")
    
    print("\n" + "-"*70)
    print("STEP 3: Create Extension in Database")
    print("-"*70)
    print("After copying files, run:")
    print(f"\n   psql -U postgres -d mentalhealthdb")
    print("\n   Or use pgAdmin, and execute:")
    print("   CREATE EXTENSION IF NOT EXISTS vector;")
    
    print("\n" + "-"*70)
    print("STEP 4: Verify Installation")
    print("-"*70)
    print("Run: python backend\\chatbot\\install_pgvector.py")
    print("Or: python backend\\chatbot\\tests\\test_phase1.py")
    
    print("\n" + "="*70)
    
    return True

if __name__ == "__main__":
    print("=" * 70)
    print("PostgreSQL Setup Checker")
    print("=" * 70)
    
    # Check connection
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        print(f"\n[OK] Connected to database: {DB_CONFIG['database']}")
        conn.close()
    except Exception as e:
        print(f"\n[FAIL] Cannot connect to database: {e}")
        sys.exit(1)
    
    # Check pgvector
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM pg_extension WHERE extname = 'vector';")
        result = cursor.fetchone()
        if result:
            print("[OK] pgvector extension is already installed!")
            cursor.close()
            conn.close()
            sys.exit(0)
        else:
            print("\n[WARN] pgvector extension is not installed")
            cursor.close()
            conn.close()
    except Exception as e:
        print(f"\n[WARN] Error checking pgvector: {e}")
    
    # Provide installation instructions
    install_pgvector_windows()

