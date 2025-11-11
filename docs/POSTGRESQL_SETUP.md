# PostgreSQL Setup Guide for MindEase RAG System

## Overview

The RAG system has been migrated from ChromaDB to PostgreSQL with pgvector extension for better production readiness and hierarchical retrieval support.

## Prerequisites

1. **PostgreSQL** (version 12 or higher)
2. **pgvector extension** for vector similarity search
3. **Python packages**: psycopg2-binary (already in requirements.txt)

## Database Setup

### 1. Install PostgreSQL

Download and install PostgreSQL from: https://www.postgresql.org/download/

### 2. Install pgvector Extension

**Windows**:
```bash
# Using pre-built binaries (recommended)
# Download from: https://github.com/pgvector/pgvector/releases

# Or build from source:
git clone --branch v0.5.1 https://github.com/pgvector/pgvector.git
cd pgvector
make
make install
```

**Linux (Ubuntu/Debian)**:
```bash
sudo apt install postgresql-server-dev-XX  # Replace XX with your version
git clone --branch v0.5.1 https://github.com/pgvector/pgvector.git
cd pgvector
make
sudo make install
```

**macOS**:
```bash
brew install pgvector
```

### 3. Create Database

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE mindease_rag;

# Connect to the new database
\c mindease_rag

# Create extension
CREATE EXTENSION IF NOT EXISTS vector;

# Verify extension
\dx

# Exit
\q
```

### 4. Run Schema Script

```bash
# From project root
psql -U postgres -d mindease_rag -f backend/chatbot/postgresql_schema.sql
```

Or manually:

```sql
-- Connect to mindease_rag database
\c mindease_rag

-- Create extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create tables (see backend/chatbot/postgresql_schema.sql)
-- Tables will be created automatically by RAGSystem if they don't exist
```

## Configuration

### Update Database Connection

Edit `backend/chatbot/rag_system_postgres.py` or pass `db_config`:

```python
db_config = {
    'host': 'localhost',
    'port': 5432,
    'database': 'mindease_rag',
    'user': 'postgres',
    'password': 'your_password'  # Update this
}

rag = RAGSystem(db_config=db_config)
```

Or set environment variables:

```bash
export POSTGRES_HOST=localhost
export POSTGRES_PORT=5432
export POSTGRES_DB=mindease_rag
export POSTGRES_USER=postgres
export POSTGRES_PASSWORD=your_password
```

## Migration from ChromaDB

### If You Have Existing ChromaDB Data

1. The system will automatically detect empty database
2. First run will rebuild from CSV dataset
3. This may take 5-10 minutes depending on dataset size

### Starting Fresh

1. Drop existing tables (optional):
```sql
DROP TABLE IF EXISTS output_chunks CASCADE;
DROP TABLE IF EXISTS input_chunks CASCADE;
```

2. Run the RAG system - it will create tables and populate data automatically

## Schema

### Tables

**input_chunks**:
- `question_no` (INTEGER) - Question number from CSV
- `chunk_index` (INTEGER) - Chunk index within question
- `content` (TEXT) - Input chunk text
- `embedding` (vector(384)) - Embedding vector
- `created_at` (TIMESTAMP) - Creation timestamp
- **Primary Key**: (question_no, chunk_index)

**output_chunks**:
- `question_no` (INTEGER) - Same as input chunk
- `chunk_index` (INTEGER) - Same as input chunk
- `content` (TEXT) - Output chunk text
- `embedding` (vector(384)) - Optional embedding
- `created_at` (TIMESTAMP) - Creation timestamp
- **Primary Key**: (question_no, chunk_index)
- **Foreign Key**: (question_no, chunk_index) → input_chunks

### Indexes

- `input_chunks_embedding_idx` - IVFFlat index for vector similarity search
- `input_chunks_question_no_idx` - Index for question lookups
- `output_chunks_question_no_idx` - Index for question lookups

## Usage

### Update Chatbot to Use PostgreSQL Version

Edit `backend/chatbot/chatbot_terminal.py`:

```python
# Change import
from chatbot.rag_system_postgres import RAGSystem  # Instead of rag_system

# Update initialization
db_config = {
    'host': 'localhost',
    'port': 5432,
    'database': 'mindease_rag',
    'user': 'postgres',
    'password': 'postgres'  # Update
}

self.rag_system = RAGSystem(db_config=db_config)
```

Or use environment variables for configuration.

## Testing

### Run Tests

```bash
cd backend

# Test database setup
python -m chatbot.tests.test_database_setup

# Test data ingestion
python -m chatbot.tests.test_data_ingestion

# Test retrieval
python -m chatbot.tests.test_retrieval

# Test integration
python -m chatbot.tests.test_integration

# Run all tests
python -m chatbot.run_all_tests
```

## Verification Queries

```sql
-- Check total chunks
SELECT COUNT(*) FROM input_chunks;
SELECT COUNT(*) FROM output_chunks;

-- Check for orphaned chunks
SELECT 
    i.question_no,
    i.chunk_index
FROM input_chunks i
LEFT JOIN output_chunks o 
    ON i.question_no = o.question_no 
    AND i.chunk_index = o.chunk_index
WHERE o.question_no IS NULL
LIMIT 5;

-- Test similarity search
SELECT 
    question_no,
    chunk_index,
    1 - (embedding <=> %s::vector) as similarity
FROM input_chunks
ORDER BY embedding <=> %s::vector
LIMIT 5;
```

## Troubleshooting

### Extension Not Found

```sql
-- Check if extension exists
SELECT * FROM pg_extension WHERE extname = 'vector';

-- If not, create it
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify
\dx
```

### Connection Errors

- Check PostgreSQL is running: `pg_isready`
- Verify credentials in `db_config`
- Check firewall settings
- Ensure database exists: `SELECT datname FROM pg_database;`

### Performance Issues

- Ensure indexes are created (run schema script)
- Consider adjusting IVFFlat index lists parameter for larger datasets
- Use HNSW index if available (PostgreSQL 15+)

### Vector Type Errors

- Verify pgvector extension is installed correctly
- Check vector dimension matches (384 for all-MiniLM-L6-v2)
- Ensure embeddings are normalized

## Advantages of PostgreSQL over ChromaDB

1. ✅ **Production Ready**: PostgreSQL is battle-tested and production-ready
2. ✅ **ACID Compliance**: Full transactional support
3. ✅ **Scalability**: Handles large datasets efficiently
4. ✅ **Hierarchical Retrieval**: Easy joins between input and output chunks
5. ✅ **Integration**: Works seamlessly with existing Django/PostgreSQL setup
6. ✅ **Queries**: Powerful SQL queries for analysis and debugging
7. ✅ **Indexes**: Optimized vector indexes for fast similarity search
8. ✅ **Relationships**: Foreign key constraints ensure data integrity

## Next Steps

1. ✅ Set up PostgreSQL database
2. ✅ Run schema script
3. ✅ Update chatbot to use PostgreSQL version
4. ✅ Run tests to verify setup
5. ✅ Build vector database from dataset
6. ✅ Test end-to-end pipeline

---

**For more details, see `backend/chatbot/TESTING_PLAN.md`**

