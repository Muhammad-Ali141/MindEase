# MindEase Chatbot

A complete therapy chatbot system with emotion detection, RAG (Retrieval-Augmented Generation), and LLM integration for providing empathetic mental health support.

## Overview

The MindEase chatbot combines multiple AI technologies to provide personalized therapy responses:
- **Emotion Detection**: Uses fine-tuned DeBERTa v3 model to detect emotions from user text
- **RAG System**: Retrieves relevant context from MentalChat16K dataset using PostgreSQL with pgvector
- **LLM Integration**: Generates empathetic therapist responses using Ollama (Llama 3.1 8B)
- **Conversation Memory**: Maintains context and generates session summaries

## Components

### 1. Emotion Detection (`emotion_detector.py`)
- Uses fine-tuned DeBERTa v3 Large model
- Detects top 2 emotions with threshold >= 0.3
- Model located at: `deberta_best/` (project root)

### 2. RAG System (`rag_system_postgres.py`)
- Implements hierarchical retrieval from MentalChat16K dataset
- Uses sentence-transformers (`all-MiniLM-L6-v2`) for embeddings
- PostgreSQL with pgvector for vector storage
- Chunks input/output separately and links them by index
- Retrieves top 3 most similar contexts with similarity >= 0.5

### 3. LLM Client (`llm_client.py`)
- Integrates with Ollama for Llama 3.1 8B Instruct
- Auto-detects available models (handles variations like `llama3.1:8b` vs `llama3.1:8b-instruct`)
- Generates therapist-style responses with structured therapy approach
- System prompt enforces: understand first → build understanding → provide support

### 4. Conversation Memory (`conversation_memory.py`)
- Maintains conversation history (last 20 messages)
- Generates LLM-powered session summaries
- Provides context-aware goodbye messages
- Summaries are strictly factual (only what was actually discussed)

### 5. Chat Interfaces
- **`chat.py`**: Clean, user-friendly terminal interface with therapist greeting
- **`main.py`**: Debugging interface with step-by-step workflow visualization

## Setup Instructions

### 1. Prerequisites

- Python 3.8+
- PostgreSQL 12+ with pgvector extension
- Ollama installed and running
- DeBERTa model weights (`deberta_best/model.safetensors`)
- MentalChat16K dataset (`dataset/MentalChat16K.csv`)

### 2. Install Dependencies

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate

pip install -r requirements.txt
```

### 3. Setup PostgreSQL

1. Create database:
   ```sql
   CREATE DATABASE mentalhealthdb;
   ```

2. Install pgvector extension:
   ```bash
   python install_pgvector.py
   ```
   Or manually:
   ```sql
   CREATE EXTENSION vector;
   ```

3. Create schema:
   ```bash
   psql -U postgres -d mentalhealthdb -f postgresql_schema.sql
   ```

4. Populate database:
   ```bash
   python build_database.py
   ```

### 4. Setup Ollama

1. Install Ollama from: https://ollama.ai/download

2. Start Ollama service:
   ```bash
   ollama serve
   ```

3. Download Llama 3.1 8B Instruct model:
   ```bash
   ollama pull llama3.1:8b-instruct
   ```
   Or for quantized version:
   ```bash
   ollama pull llama3.1:8b
   ```

### 5. Configuration

Create a `.env` file in `backend/chatbot/`:

```bash
cd backend/chatbot
cp env.example .env
```

Edit `.env` with your settings:
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mentalhealthdb
DB_USER=postgres
DB_PASSWORD=your_password_here
```

**Note**: The `.env` file is in `.gitignore` and won't be committed. Each machine needs its own `.env` file.

### 6. Verify Model and Dataset Locations

- **DeBERTa model**: Should be at `deberta_best/` (project root)
  - Required files: `model.safetensors`, `config.json`, `tokenizer.json`, etc.
- **Dataset**: Should be at `dataset/MentalChat16K.csv`

## Running the Chatbot

### Clean Chat Interface (Recommended)

```bash
cd backend/chatbot
python chat.py
```

Or from project root:
```bash
python -m chatbot.chat
```

Features:
- Clean terminal design
- Therapist greeting on start
- Context-aware goodbye messages
- Session summary on exit

### Debug Interface (With Verbose Output)

```bash
cd backend/chatbot
python main.py
```

Or from project root:
```bash
python -m chatbot.main
```

Features:
- Step-by-step debugging output
- Shows emotion detection results
- Shows RAG retrieval details
- Shows LLM input preparation
- Interactive commands: `quit`, `exit`, `bye`, `clear`, `debug`, `memory`

## How It Works

### Pipeline Flow

```
User Input
    ↓
Emotion Detection (DeBERTa) → Detected Emotions
    ↓
RAG Retrieval → Relevant Contexts from MentalChat Dataset
    ↓
LLM (Llama 3.1 8B) → Therapist Response
    ↓
Display to User
```

### Process Details

1. **User Input**: User types a message
2. **Emotion Detection**: DeBERTa analyzes text and detects top 2 emotions
3. **RAG Retrieval**: System searches MentalChat dataset for similar therapy contexts
4. **Response Generation**: LLM generates empathetic response using:
   - Detected emotions
   - Retrieved context from similar therapy sessions
   - Conversation history
   - Therapist-style system prompt (structured approach)

### LLM Response Strategy

The LLM follows a structured therapy approach:
1. **STEP 1: UNDERSTAND FIRST** - Ask one question at a time to understand the situation
2. **STEP 2: BUILD UNDERSTANDING** - Validate feelings and explore deeper
3. **STEP 3: PROVIDE SUPPORT** - Suggest coping mechanisms only after understanding

The system enforces:
- One question at a time (no overwhelming the user)
- Always validate feelings first
- No multiple suggestions at once
- Therapy-only scope (gracefully refuses off-topic queries)

## Testing

All tests are located in the `tests/` folder.

### Run All Tests

```bash
python run_all_tests.py
```

### Run Specific Tests

```bash
# Phase 1: Data Ingestion
python tests/test_phase1.py
python tests/test_data_ingestion.py

# Phase 2: Database Setup
python tests/test_database_setup.py

# Phase 3: Retrieval
python tests/test_retrieval.py

# Phase 4: Integration
python tests/test_integration.py

# Phase 5: LLM Quality
python tests/test_llm_quality.py

# Phase 6: Performance
python tests/test_performance.py
```

## Troubleshooting

### Model Not Found Errors

**DeBERTa Model:**
- Ensure `deberta_best/` folder exists in project root
- Verify `model.safetensors` file is present
- Check model path in `config.py`

**Dataset:**
- Ensure `dataset/MentalChat16K.csv` exists
- Verify dataset path in `config.py`

### Ollama Connection Errors

1. **Ollama not running:**
   ```bash
   ollama serve
   ```

2. **Model not downloaded:**
   ```bash
   ollama list  # Check available models
   ollama pull llama3.1:8b-instruct  # Download if missing
   ```

3. **Model name mismatch:**
   - The LLM client auto-detects available models
   - It will try: `llama3.1:8b-instruct`, `llama3.1:8b`, etc.
   - Check console output for detected model name

### Database Connection Errors

**Password Authentication Failed:**
1. Check `.env` file exists in `backend/chatbot/`
2. Verify `DB_PASSWORD` is correct
3. Test connection:
   ```bash
   python -c "from chatbot.config import DB_CONFIG; print(DB_CONFIG)"
   ```

**Database not found:**
1. Create database:
   ```sql
   CREATE DATABASE mentalhealthdb;
   ```

2. Run schema setup:
   ```bash
   python check_postgres_setup.py
   ```

**pgvector extension missing:**
```bash
python install_pgvector.py
```

### Import Errors

1. **Activate virtual environment:**
   ```bash
   venv\Scripts\activate  # Windows
   source venv/bin/activate  # Linux/Mac
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Run from correct directory:**
   - From project root: `python -m chatbot.chat`
   - Or from `backend/chatbot/`: `python chat.py`

### Configuration Not Loading

1. **Check python-dotenv installed:**
   ```bash
   pip install python-dotenv
   ```

2. **Verify .env file format:**
   - No spaces around `=`
   - No quotes around values
   - Each variable on new line
   
   **Correct:**
   ```
   DB_HOST=localhost
   DB_PASSWORD=pakistan
   ```
   
   **Incorrect:**
   ```
   DB_HOST = localhost
   DB_PASSWORD = "pakistan"
   ```

3. **Test config loading:**
   ```bash
   python -c "from chatbot.config import DB_CONFIG; print(DB_CONFIG)"
   ```

## File Structure

```
backend/chatbot/
├── __init__.py
├── README.md                    # This file
├── config.py                    # Configuration (loads from .env)
├── env.example                  # Template for .env file
├── chat.py                      # Clean chat interface
├── main.py                      # Debug chat interface
├── emotion_detector.py          # Emotion detection using DeBERTa
├── rag_system_postgres.py       # RAG system with PostgreSQL
├── llm_client.py                # Ollama LLM client
├── conversation_memory.py       # Conversation history & summaries
├── build_database.py            # Populate database from dataset
├── check_postgres_setup.py      # Verify PostgreSQL setup
├── install_pgvector.py          # Install pgvector extension
├── postgresql_schema.sql        # Database schema
├── run_all_tests.py             # Run all tests
└── tests/                       # Test suite
    ├── __init__.py
    ├── test_phase1.py
    ├── test_data_ingestion.py
    ├── test_database_setup.py
    ├── test_retrieval.py
    ├── test_integration.py
    ├── test_llm_quality.py
    └── test_performance.py
```

## Notes

- **Database**: Vector database is stored in PostgreSQL (`mentalhealthdb`)
- **Conversation History**: Maintained in-memory (last 20 messages)
- **Session Summaries**: Generated by LLM, strictly factual (only what was discussed)
- **Environment Variables**: Loaded from `.env` file (not committed to git)
- **Model Auto-Detection**: LLM client automatically finds available Ollama models

## Quick Start Checklist

- [ ] Install Python 3.8+ and PostgreSQL 12+
- [ ] Create virtual environment and install dependencies
- [ ] Setup PostgreSQL database and install pgvector
- [ ] Populate database with `build_database.py`
- [ ] Install and start Ollama
- [ ] Download Llama 3.1 8B model
- [ ] Create `.env` file with database credentials
- [ ] Verify DeBERTa model and dataset are in correct locations
- [ ] Run `python chat.py` to start chatting!
