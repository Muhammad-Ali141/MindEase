# MindEase Chatbot Module

This module implements the complete therapy chatbot pipeline with emotion detection, RAG, and LLM integration.

## Components

1. **Emotion Detection** (`emotion_detector.py`)
   - Uses fine-tuned DeBERTa v3 Large model
   - Detects emotions from user text
   - Located at: `deberta_best/`

2. **RAG System** (`rag_system_postgres.py`)
   - Implements hierarchical retrieval from MentalChat16K dataset
   - Uses sentence-transformers for embeddings
   - Uses PostgreSQL with pgvector for vector storage
   - Chunks input/output separately and links them by index

3. **LLM Client** (`llm_client.py`)
   - Integrates with Ollama for Llama 3.1 8B Instruct
   - Auto-detects available models
   - Generates therapist-style responses

4. **Conversation Memory** (`conversation_memory.py`)
   - Maintains conversation history across messages
   - Generates session summaries for context

5. **Terminal Chatbot** (`main.py`)
   - Main entry point for terminal interface
   - Integrates all components with detailed debugging

## Setup Instructions

### 1. Install Dependencies

```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
# or
source venv/bin/activate  # Linux/Mac

pip install -r requirements.txt
```

### 2. Setup Ollama

1. Install Ollama from: https://ollama.ai/download
2. Start Ollama service:
   ```bash
   ollama serve
   ```
3. Download Llama 3.1 8B Instruct model:
   ```bash
   ollama pull llama3.1:8b-instruct
   ```
   Or for quantized version (if available):
   ```bash
   ollama pull llama3.1:8b-instruct-q4_K_M
   ```

### 3. Verify Model and Dataset Locations

- DeBERTa model: Should be at `deberta_best/` (project root)
- Dataset: Should be at `dataset/MentalChat16K.csv`

### 4. Run the Chatbot

**Option 1: Using convenience scripts**

```bash
# Windows
backend\chatbot\run_main.bat

# Linux/Mac
bash backend/chatbot/run_main.sh
```

**Option 2: Using Python directly**

```bash
# From project root
cd backend
python -m chatbot.main
```

Or from the chatbot directory:

```bash
cd backend/chatbot
python main.py
```

## How It Works

1. **User Input**: User types a message
2. **Emotion Detection**: DeBERTa analyzes the text and detects top 2 emotions
3. **RAG Retrieval**: System searches MentalChat dataset for similar contexts
4. **Response Generation**: LLM generates empathetic response using:
   - Detected emotions
   - Retrieved context from similar therapy sessions
   - Conversation history
   - Therapist-style system prompt

## Pipeline Flow

```
User Input
    ↓
Emotion Detection (DeBERTa) → Detected Emotions
    ↓
RAG Retrieval → Relevant Contexts
    ↓
LLM (Llama 3.1 8B) → Therapist Response
    ↓
Display to User
```

## Notes

- First run will require database setup (PostgreSQL with pgvector)
- Run `build_database.py` to populate the database from the dataset
- Vector database is stored in PostgreSQL (`mentalhealthdb`)
- Conversation history is maintained in-memory (last 20 messages)
- Emotions are detected with threshold >= 0.3 and top 2 are selected
- RAG retrieves top 3 most similar contexts with similarity >= 0.5
- LLM client auto-detects available Ollama models

## Troubleshooting

### Model not found errors
- Ensure `deberta_best/` folder exists in project root
- Ensure `dataset/MentalChat16K.csv` exists

### Ollama connection errors
- Make sure `ollama serve` is running
- Verify model is downloaded: `ollama list`
- Check model name in `llm_client.py` matches downloaded model

### Import errors
- Activate virtual environment
- Install all dependencies: `pip install -r requirements.txt`
- Run from project root or adjust paths

## Testing

All tests are located in the `tests/` folder. Run tests using:

```bash
# Run all tests
python backend/chatbot/run_all_tests.py

# Run specific test
python backend/chatbot/tests/test_phase1.py
python backend/chatbot/tests/test_data_ingestion.py
python backend/chatbot/tests/test_retrieval.py
python backend/chatbot/tests/test_integration.py
python backend/chatbot/tests/test_llm_quality.py
python backend/chatbot/tests/test_performance.py
```

See `TESTING_PROGRESS.md` for detailed test results and `TESTING_PLAN.md` for test specifications.

