# MindEase - Mental Health Therapy Chatbot

An AI-powered therapy chatbot that uses emotion detection, RAG (Retrieval Augmented Generation), and LLM to provide empathetic mental health support.

## Features

- **Emotion Detection**: Fine-tuned DeBERTa v3 Large model detects emotions from user input
- **RAG System**: PostgreSQL with pgvector for hierarchical retrieval from MentalChat 16k dataset
- **LLM Integration**: Llama 3.1 8B Instruct for generating therapist-style responses
- **Conversation Memory**: Maintains context across the conversation
- **Context-Aware**: Personalized responses based on conversation history

## Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd MindEase
```

### 2. Setup Environment

**See [SETUP_FOR_PARTNER.md](SETUP_FOR_PARTNER.md) for complete detailed setup instructions.**

Quick steps:
1. Create virtual environment: `python -m venv venv`
2. Activate: `venv\Scripts\activate` (Windows) or `source venv/bin/activate` (Linux/Mac)
3. Install dependencies: `pip install -r backend/requirements.txt`
4. Setup `.env` file: Copy `backend/chatbot/env.example` to `backend/chatbot/.env` and update with your database password

### 3. Setup PostgreSQL

1. Install PostgreSQL with pgvector extension
2. Create database: `CREATE DATABASE mentalhealthdb;`
3. Run schema: `psql -U postgres -d mentalhealthdb -f backend/chatbot/postgresql_schema.sql`

See [POSTGRESQL_SETUP.md](POSTGRESQL_SETUP.md) for detailed instructions.

### 4. Download Required Files

**These files are NOT in git (too large):**

- **DeBERTa Model**: Copy `model.safetensors` to `deberta_best/` folder (or ask your partner)
- **Dataset**: Download `MentalChat16K.csv` and place in `dataset/` folder

### 5. Build Database

```bash
cd backend/chatbot
python build_database.py
```

### 6. Setup Ollama

1. Install Ollama: https://ollama.ai/download
2. Start: `ollama serve`
3. Download model: `ollama pull llama3.1:8b-instruct` (or `ollama pull llama3.1:8b`)

### 7. Run the Chatbot

**Option 1: Clean Chat Interface (Recommended)**
```bash
python -m chatbot.chat
# or
backend\chatbot\run_chat.bat  # Windows
bash backend/chatbot/run_chat.sh  # Linux/Mac
```

**Option 2: Debug Version (with verbose output)**
```bash
python -m chatbot.main
# or
backend\chatbot\run_main.bat  # Windows
bash backend/chatbot/run_main.sh  # Linux/Mac
```

## Documentation

- **[SETUP_FOR_PARTNER.md](SETUP_FOR_PARTNER.md)** - Complete setup guide for partners
- **[POSTGRESQL_SETUP.md](POSTGRESQL_SETUP.md)** - PostgreSQL and pgvector setup
- **[CHATBOT_SETUP.md](CHATBOT_SETUP.md)** - Chatbot component details
- **[GIT_PUSH_GUIDE.md](GIT_PUSH_GUIDE.md)** - What to push and what NOT to push
- **[GIT_CHECKLIST.md](GIT_CHECKLIST.md)** - Pre-push verification checklist

## Project Structure

```
MindEase/
├── backend/
│   ├── chatbot/          # Chatbot module
│   │   ├── chat.py        # Clean chat interface
│   │   ├── main.py        # Debug version
│   │   ├── config.py      # Configuration (uses .env)
│   │   ├── env.example    # Environment template
│   │   ├── tests/         # Test suite
│   │   └── ...
│   └── requirements.txt   # Python dependencies
├── deberta_best/          # Model files (weights excluded from git)
├── dataset/               # Dataset (excluded from git)
└── README.md              # This file
```

## Important Notes

- **`.env` file**: Contains database password - NOT in git. Partner needs to create from `env.example`
- **Model weights**: `deberta_best/model.safetensors` - NOT in git (too large). Share separately.
- **Dataset**: `dataset/MentalChat16K.csv` - NOT in git (too large). Share separately or download from source.

## Chatbot Components

1. **Emotion Detection** (`emotion_detector.py`): Uses DeBERTa v3 Large
2. **RAG System** (`rag_system_postgres.py`): PostgreSQL with pgvector
3. **LLM Client** (`llm_client.py`): Ollama integration for Llama 3.1 8B
4. **Conversation Memory** (`conversation_memory.py`): Maintains context and generates summaries

## Testing

All tests are in `backend/chatbot/tests/`:

```bash
# Run all tests
python backend/chatbot/run_all_tests.py

# Run specific test
python backend/chatbot/tests/test_phase1.py
```

See `backend/chatbot/TESTING_PROGRESS.md` for test results.

## Troubleshooting

### Database Connection Issues
- Check PostgreSQL is running
- Verify `.env` file has correct password
- Ensure database exists: `psql -U postgres -l`

### Model Not Found
- Ensure `deberta_best/model.safetensors` exists
- Check path in config (auto-detected)

### Ollama Issues
- Ensure `ollama serve` is running
- Verify model downloaded: `ollama list`
- Check model name matches in config

## Support

For detailed setup instructions, see **[SETUP_FOR_PARTNER.md](SETUP_FOR_PARTNER.md)**

---

**Ready to use?** Follow the [SETUP_FOR_PARTNER.md](SETUP_FOR_PARTNER.md) guide step-by-step!
