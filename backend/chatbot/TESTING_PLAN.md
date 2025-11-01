# Comprehensive Testing Plan for MindEase Chatbot

## Overview
This document outlines a complete testing strategy to validate:
1. Embeddings are created successfully in PostgreSQL
2. Input and output chunks are stored correctly with proper relationships
3. Retrieval works correctly (input chunks → corresponding output chunks)
4. LLM generates appropriate responses using retrieved context

---

## Phase 1: Database Setup & Schema Validation

### 1.1 PostgreSQL Setup Verification
**Objective**: Ensure PostgreSQL is configured with pgvector extension

**Steps**:
```sql
-- Check if pgvector extension exists
SELECT * FROM pg_extension WHERE extname = 'vector';

-- If not exists, create it
CREATE EXTENSION IF NOT EXISTS vector;

-- Verify tables exist
\dt
```

**Expected Result**: 
- ✅ pgvector extension installed
- ✅ Tables `input_chunks` and `output_chunks` exist
- ✅ Vector columns are of type `vector(384)` (for all-MiniLM-L6-v2)

### 1.2 Schema Validation
**Objective**: Verify table structure matches requirements

**Test Query**:
```sql
-- Check input_chunks table structure
\d input_chunks

-- Check output_chunks table structure
\d output_chunks

-- Verify foreign key relationship
SELECT 
    CONSTRAINT_NAME,
    TABLE_NAME,
    COLUMN_NAME,
    REFERENCED_TABLE_NAME
FROM information_schema.KEY_COLUMN_USAGE
WHERE TABLE_NAME IN ('input_chunks', 'output_chunks');
```

**Expected Schema**:

**input_chunks**:
- `question_no` (INTEGER, PRIMARY KEY) - Question number from CSV
- `chunk_index` (INTEGER, PRIMARY KEY) - Chunk index for this question
- `content` (TEXT) - Chunk text content
- `embedding` (vector(384)) - Embedding vector

**output_chunks**:
- `question_no` (INTEGER, PRIMARY KEY) - Same as input chunk
- `chunk_index` (INTEGER, PRIMARY KEY) - Same as input chunk
- `content` (TEXT) - Output chunk text content
- `embedding` (vector(384)) - Embedding vector (optional, for future use)

**Composite Primary Key**: `(question_no, chunk_index)` ensures uniqueness

**Expected Result**: 
- ✅ Both tables have correct structure
- ✅ Composite primary keys on (question_no, chunk_index)
- ✅ Vector columns are type `vector(384)`
- ✅ Indexes exist for efficient retrieval

---

## Phase 2: Data Ingestion Testing

### 2.1 CSV Loading Validation
**Objective**: Verify CSV is read correctly and only `input`/`output` columns are used

**Test Steps**:
```python
import pandas as pd
df = pd.read_csv('dataset/MentalChat16K.csv')
print(f"Total rows: {len(df)}")
print(f"Columns: {df.columns.tolist()}")
print(f"Input column non-null: {df['input'].notna().sum()}")
print(f"Output column non-null: {df['output'].notna().sum()}")
```

**Expected Result**:
- ✅ CSV loads successfully
- ✅ Only `input` and `output` columns are used
- ✅ `instruction` column is ignored
- ✅ No null values in input/output columns used

### 2.2 Chunking Validation
**Objective**: Verify chunks are created correctly with proper indexing

**Test Steps**:
1. Process first 10 rows from CSV
2. Verify chunk sizes (approximately 512 tokens)
3. Verify overlap (50 tokens between chunks)
4. Check chunk indexing starts at 0 for each question

**Expected Result**:
- ✅ Each question has at least 1 chunk
- ✅ Chunk sizes are approximately correct
- ✅ Overlaps are present between consecutive chunks
- ✅ Chunk indices start at 0 for each question
- ✅ Input and output chunks have same number of chunks per question

### 2.3 Embedding Generation Validation
**Objective**: Verify embeddings are generated correctly

**Test Steps**:
```python
from sentence_transformers import SentenceTransformer
model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')
test_text = "I'm feeling anxious"
embedding = model.encode(test_text)
print(f"Embedding shape: {embedding.shape}")
print(f"Embedding type: {type(embedding)}")
print(f"Embedding sample: {embedding[:5]}")
```

**Expected Result**:
- ✅ Embeddings have shape (384,) for all-MiniLM-L6-v2
- ✅ Embeddings are numpy arrays
- ✅ All embeddings are normalized (for cosine similarity)

### 2.4 Database Insertion Validation
**Objective**: Verify chunks and embeddings are inserted correctly

**Test Query**:
```sql
-- Check total chunks inserted
SELECT 
    COUNT(*) as total_input_chunks,
    COUNT(DISTINCT question_no) as total_questions
FROM input_chunks;

SELECT 
    COUNT(*) as total_output_chunks,
    COUNT(DISTINCT question_no) as total_questions
FROM output_chunks;

-- Verify question_no and chunk_index relationship
SELECT 
    i.question_no,
    i.chunk_index,
    i.content as input_content,
    o.content as output_content
FROM input_chunks i
JOIN output_chunks o 
    ON i.question_no = o.question_no 
    AND i.chunk_index = o.chunk_index
LIMIT 5;
```

**Expected Result**:
- ✅ Number of input chunks = number of output chunks
- ✅ Each input chunk has corresponding output chunk
- ✅ All question_no values match between tables
- ✅ All chunk_index values match for same question_no
- ✅ No orphaned chunks (input without output or vice versa)

---

## Phase 3: Retrieval Testing

### 3.1 Similarity Search Validation
**Objective**: Verify vector similarity search works correctly

**Test Query**:
```sql
-- Test similarity search on a sample query
WITH query_embedding AS (
    SELECT embedding::text 
    FROM input_chunks 
    WHERE question_no = 1 AND chunk_index = 0
    LIMIT 1
)
SELECT 
    question_no,
    chunk_index,
    content,
    1 - (embedding <=> (SELECT embedding FROM input_chunks WHERE question_no = 1 AND chunk_index = 0 LIMIT 1)) as similarity
FROM input_chunks
ORDER BY embedding <=> (SELECT embedding FROM input_chunks WHERE question_no = 1 AND chunk_index = 0 LIMIT 1)
LIMIT 5;
```

**Expected Result**:
- ✅ Similarity search returns results
- ✅ Most similar chunk has similarity ≈ 1.0 (self-match)
- ✅ Similarity decreases for less similar chunks
- ✅ Results are ordered by similarity (descending)

### 3.2 Hierarchical Retrieval Validation
**Objective**: Verify input chunks → corresponding output chunks mapping works

**Test Steps**:
1. Perform similarity search on input_chunks
2. Retrieve top K input chunks
3. For each retrieved input chunk, get corresponding output chunk using (question_no, chunk_index)

**Test Query**:
```sql
-- Example: Find similar input chunks, then get their outputs
WITH similar_inputs AS (
    SELECT 
        question_no,
        chunk_index,
        content as input_content,
        1 - (embedding <=> %s) as similarity
    FROM input_chunks
    WHERE 1 - (embedding <=> %s) >= 0.5  -- similarity threshold
    ORDER BY embedding <=> %s
    LIMIT 3
)
SELECT 
    si.question_no,
    si.chunk_index,
    si.input_content,
    si.similarity,
    oc.content as output_content
FROM similar_inputs si
JOIN output_chunks oc 
    ON si.question_no = oc.question_no 
    AND si.chunk_index = oc.chunk_index
ORDER BY si.similarity DESC;
```

**Expected Result**:
- ✅ Each retrieved input chunk has corresponding output chunk
- ✅ No missing output chunks
- ✅ Mapping is correct (question_no and chunk_index match)
- ✅ Output content is relevant to input content

### 3.3 Threshold Validation
**Objective**: Verify similarity threshold filtering works

**Test Cases**:
- Query with high similarity (should return results)
- Query with low similarity (should return empty or few results)
- Query with threshold = 0.5 (should filter appropriately)

**Expected Result**:
- ✅ Threshold filtering works correctly
- ✅ Only chunks above threshold are returned
- ✅ Empty results when no chunks meet threshold

---

## Phase 4: Integration Testing

### 4.1 End-to-End Pipeline Test
**Objective**: Test complete flow from user input to LLM response

**Test Scenarios**:

1. **Simple Query** (should retrieve relevant context)
   ```
   Input: "I'm feeling anxious about my exam"
   Expected: 
   - Emotions detected (anxiety, nervousness)
   - Relevant contexts retrieved
   - LLM generates empathetic response
   ```

2. **Complex Query** (should still work)
   ```
   Input: "I've been struggling with depression and can't sleep at night, feel hopeless"
   Expected:
   - Multiple emotions detected
   - Multiple relevant contexts retrieved
   - Comprehensive LLM response
   ```

3. **Unrelated Query** (should handle gracefully)
   ```
   Input: "What's the weather today?"
   Expected:
   - May or may not detect emotions
   - Few/no relevant contexts (below threshold)
   - LLM still generates appropriate response
   ```

**Validation Checklist**:
- ✅ Emotions are detected (even if low confidence)
- ✅ RAG retrieval finds relevant chunks (or returns empty if no match)
- ✅ LLM receives formatted context with emotions
- ✅ LLM response is appropriate and empathetic
- ✅ No errors in pipeline

### 4.2 Retrieval Accuracy Test
**Objective**: Manually verify retrieved contexts are actually relevant

**Test Steps**:
1. Create test queries with known topics
2. Retrieve contexts for each query
3. Manually review if retrieved contexts are relevant

**Sample Queries**:
- "anxiety about exams"
- "depression and hopelessness"
- "relationship problems"
- "work stress"

**Expected Result**:
- ✅ Retrieved contexts are semantically relevant to query
- ✅ Output chunks provide appropriate therapist responses
- ✅ Similarity scores reflect actual relevance

---

## Phase 5: LLM Response Quality Testing

### 5.1 Response Format Validation
**Objective**: Verify LLM responses are well-formatted and appropriate

**Test Cases**:
1. Response should be non-empty
2. Response should be therapist-like (empathetic, supportive)
3. Response should reference detected emotions if present
4. Response should incorporate retrieved context naturally

**Evaluation Criteria**:
- ✅ Length: 50-500 words (reasonable length)
- ✅ Tone: Empathetic, professional, supportive
- ✅ Content: Relevant to user query
- ✅ Structure: Coherent, well-formed sentences

### 5.2 Context Integration Test
**Objective**: Verify LLM uses retrieved context appropriately

**Test Steps**:
1. Provide query with known context in database
2. Verify that context is retrieved
3. Check if LLM response reflects the context

**Expected Result**:
- ✅ LLM incorporates context naturally
- ✅ Response doesn't directly copy context
- ✅ Context influences response style/tone

---

## Phase 6: Performance Testing

### 6.1 Database Query Performance
**Objective**: Measure retrieval speed

**Test Steps**:
1. Measure time for similarity search
2. Measure time for joining output chunks
3. Measure time for full retrieval pipeline

**Expected Performance**:
- Similarity search: < 100ms for top 10 results
- Join operation: < 50ms
- Full retrieval: < 200ms total

### 6.2 End-to-End Latency
**Objective**: Measure complete pipeline latency

**Test Steps**:
1. Measure emotion detection time
2. Measure RAG retrieval time
3. Measure LLM generation time
4. Measure total pipeline time

**Expected Performance**:
- Emotion detection: 100-500ms
- RAG retrieval: 100-300ms
- LLM generation: 2-5 seconds (depends on model)
- Total pipeline: 2.5-6 seconds

---

## Test Scripts

### test_database_setup.py
Tests database schema and initial setup

### test_data_ingestion.py
Tests CSV loading, chunking, embedding generation, and database insertion

### test_retrieval.py
Tests similarity search and hierarchical retrieval

### test_integration.py
Tests end-to-end pipeline

### test_llm_quality.py
Tests LLM response quality and context integration

### test_performance.py
Tests performance benchmarks

---

## Acceptance Criteria

✅ **Database Setup**
- PostgreSQL with pgvector installed
- Tables created with correct schema
- Indexes created for efficient retrieval

✅ **Data Ingestion**
- CSV loaded correctly (only input/output columns)
- Chunks created with proper overlap
- Embeddings generated (384 dimensions)
- All chunks inserted into database
- Input-output mapping preserved

✅ **Retrieval**
- Similarity search returns relevant results
- Hierarchical retrieval works (input → output)
- Threshold filtering works
- No missing mappings

✅ **Integration**
- Complete pipeline works end-to-end
- No errors in any component
- Responses are generated successfully

✅ **Quality**
- Retrieved contexts are relevant
- LLM responses are appropriate
- Context is integrated naturally

✅ **Performance**
- Retrieval < 200ms
- Total pipeline < 6 seconds
- Database queries are optimized

---

## Running Tests

```bash
# Activate virtual environment
cd backend
venv\Scripts\activate  # Windows
# or
source venv/bin/activate  # Linux/Mac

# Install test dependencies
pip install pytest pytest-cov

# Run all tests
pytest backend/chatbot/tests/ -v

# Run specific test file
pytest backend/chatbot/tests/test_retrieval.py -v

# Run with coverage
pytest backend/chatbot/tests/ --cov=backend/chatbot --cov-report=html
```

---

## Maintenance

- Run tests after any code changes
- Re-run ingestion tests if dataset changes
- Monitor performance tests regularly
- Update test cases as requirements evolve

