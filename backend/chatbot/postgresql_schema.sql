-- PostgreSQL Schema for MindEase RAG System
-- Requires pgvector extension

-- Create pgvector extension if not exists
CREATE EXTENSION IF NOT EXISTS vector;

-- Drop tables if they exist (for clean setup)
DROP TABLE IF EXISTS output_chunks CASCADE;
DROP TABLE IF EXISTS input_chunks CASCADE;

-- Table: input_chunks
-- Stores chunked input questions with embeddings
CREATE TABLE input_chunks (
    question_no INTEGER NOT NULL,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding vector(384) NOT NULL,  -- 384 dimensions for all-MiniLM-L6-v2
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (question_no, chunk_index)
);

-- Table: output_chunks
-- Stores chunked output answers with embeddings (optional, for future use)
CREATE TABLE output_chunks (
    question_no INTEGER NOT NULL,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding vector(384),  -- Optional, can be NULL if not needed
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (question_no, chunk_index),
    FOREIGN KEY (question_no, chunk_index) 
        REFERENCES input_chunks(question_no, chunk_index) 
        ON DELETE CASCADE
);

-- Create indexes for efficient similarity search
-- HNSW index for fast approximate nearest neighbor search
CREATE INDEX input_chunks_embedding_idx 
ON input_chunks 
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);  -- Adjust based on dataset size

-- Alternative: Use HNSW if available (PostgreSQL 15+)
-- CREATE INDEX input_chunks_embedding_idx 
-- ON input_chunks 
-- USING hnsw (embedding vector_cosine_ops);

-- Index for question_no lookups
CREATE INDEX input_chunks_question_no_idx ON input_chunks(question_no);
CREATE INDEX output_chunks_question_no_idx ON output_chunks(question_no);

-- Index for composite lookups
CREATE INDEX input_chunks_composite_idx ON input_chunks(question_no, chunk_index);
CREATE INDEX output_chunks_composite_idx ON output_chunks(question_no, chunk_index);

-- Comments for documentation
COMMENT ON TABLE input_chunks IS 'Stores chunked input questions with vector embeddings for similarity search';
COMMENT ON TABLE output_chunks IS 'Stores chunked output answers, linked to input chunks via (question_no, chunk_index)';
COMMENT ON COLUMN input_chunks.question_no IS 'Question number from CSV (row index)';
COMMENT ON COLUMN input_chunks.chunk_index IS 'Chunk index within the question (0-based)';
COMMENT ON COLUMN input_chunks.embedding IS '384-dimensional embedding vector for similarity search';
COMMENT ON COLUMN output_chunks.question_no IS 'Same question_no as corresponding input chunk';
COMMENT ON COLUMN output_chunks.chunk_index IS 'Same chunk_index as corresponding input chunk';

-- Grant permissions (adjust user as needed)
-- GRANT ALL PRIVILEGES ON TABLE input_chunks TO your_user;
-- GRANT ALL PRIVILEGES ON TABLE output_chunks TO your_user;

-- Verification queries
-- SELECT COUNT(*) FROM input_chunks;
-- SELECT COUNT(*) FROM output_chunks;
-- SELECT i.question_no, i.chunk_index, COUNT(o.content) as output_count
-- FROM input_chunks i
-- LEFT JOIN output_chunks o ON i.question_no = o.question_no AND i.chunk_index = o.chunk_index
-- GROUP BY i.question_no, i.chunk_index
-- HAVING COUNT(o.content) != 1;

