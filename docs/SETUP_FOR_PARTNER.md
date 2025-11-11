# Setup Guide for Partner

This guide helps you set up the MindEase chatbot on your local machine after cloning the repository.

## Prerequisites

1. **Python 3.8+** installed
2. **PostgreSQL** installed with `pgvector` extension
3. **Ollama** installed and running
4. **Git** installed

## Step 1: Clone Repository

```bash
git clone <repository-url>
cd MindEase
```

## Step 2: Install Dependencies

```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Install Python dependencies
cd backend
pip install -r requirements.txt
```

**Note**: You may also need to install `python-dotenv` for environment variable support:
```bash
pip install python-dotenv
```

## Step 3: Setup Environment Variables

1. Copy the example environment file:
   ```bash
   cd backend/chatbot
   cp env.example .env
   ```

2. Edit `.env` file and update:
   - `DB_PASSWORD`: Your PostgreSQL password
   - `DB_NAME`: Database name (default: mentalhealthdb)
   - Other values if different from defaults

3. Or set environment variables directly (Windows PowerShell):
   ```powershell
   $env:DB_PASSWORD="your_password"
   $env:DB_NAME="mentalhealthdb"
   ```

## Step 4: Setup PostgreSQL Database

1. **Create Database**:
   ```sql
   CREATE DATABASE mentalhealthdb;
   ```

2. **Install pgvector Extension**:
   ```sql
   \c mentalhealthdb
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

3. **Create Tables** (run the schema file):
   ```bash
   psql -U postgres -d mentalhealthdb -f backend/chatbot/postgresql_schema.sql
   ```

See `POSTGRESQL_SETUP.md` for detailed instructions.

## Step 5: Download Required Files

These files are **NOT** in git due to size:

### A. DeBERTa Model Files

The model structure is in `deberta_best/` but weights are excluded. You have two options:

**Option 1: If partner has model files**
- Copy `model.safetensors` to `deberta_best/` folder
- Other files should already be in git

**Option 2: Re-download/fine-tune**
- Download DeBERTa v3 Large from Hugging Face
- Fine-tune on your dataset (if you have the training setup)

### B. MentalChat16K Dataset

The dataset is **NOT** in git (~44 MB). You need to:

1. Download from the original source: https://arxiv.org/abs/2503.13509
2. Or ask your partner to share via cloud storage (Google Drive, etc.)
3. Place it in: `dataset/MentalChat16K.csv`

## Step 6: Build Database

Once you have the dataset:

```bash
# From project root
cd backend/chatbot
python build_database.py
```

This will:
- Load the CSV file
- Chunk the data
- Generate embeddings
- Insert into PostgreSQL

This may take 10-30 minutes depending on your hardware.

## Step 7: Setup Ollama

1. **Install Ollama**: https://ollama.ai/download

2. **Start Ollama**:
   ```bash
   ollama serve
   ```

3. **Download Model**:
   ```bash
   ollama pull llama3.1:8b-instruct
   ```

Or if using quantized version:
   ```bash
   ollama pull llama3.1:8b
   ```

## Step 8: Verify Setup

Run the Phase 1 test to verify database setup:

```bash
cd backend/chatbot
python tests/test_phase1.py
```

If all tests pass, you're ready!

## Step 9: Run the Chatbot

**Option 1: Clean Chat Interface (Recommended)**
```bash
# Windows
backend\chatbot\run_chat.bat

# Linux/Mac
bash backend/chatbot/run_chat.sh

# Or directly
cd backend
python -m chatbot.chat
```

**Option 2: Debug Version (with verbose output)**
```bash
# Windows
backend\chatbot\run_main.bat

# Linux/Mac
bash backend/chatbot/run_main.sh

# Or directly
cd backend
python -m chatbot.main
```

## Troubleshooting

### Database Connection Errors

- Check PostgreSQL is running: `psql -U postgres`
- Verify password in `.env` file
- Check database exists: `\l` in psql

### Model Not Found

- Ensure `deberta_best/model.safetensors` exists
- Check path in config (should be auto-detected)

### Dataset Not Found

- Verify `dataset/MentalChat16K.csv` exists
- Check file path is correct

### Ollama Connection Errors

- Ensure `ollama serve` is running
- Check model is downloaded: `ollama list`
- Verify model name matches in `.env`

### Import Errors

- Ensure virtual environment is activated
- Install all dependencies: `pip install -r requirements.txt`
- Try: `pip install python-dotenv` if env loading fails

## File Structure

```
MindEase/
├── backend/
│   ├── chatbot/
│   │   ├── config.py              # Configuration (uses env vars)
│   │   ├── env.example            # Template for .env
│   │   ├── .env                   # Your config (NOT in git)
│   │   ├── main.py                # Main chatbot script
│   │   ├── build_database.py      # Database builder
│   │   ├── tests/                 # All test files
│   │   └── ...                    # Other chatbot files
│   └── requirements.txt
├── deberta_best/                   # Model folder (weights excluded from git)
│   ├── config.json                # ✅ In git
│   ├── tokenizer.json             # ✅ In git
│   └── model.safetensors          # ❌ NOT in git (large file)
├── dataset/
│   └── MentalChat16K.csv          # ❌ NOT in git (large file)
└── .gitignore                     # Controls what's excluded
```

## What's NOT in Git (and why)

1. **`.env` files** - Contains passwords (security)
2. **`model.safetensors`** - Large model file (~500MB+)
3. **`dataset/MentalChat16K.csv`** - Large dataset (~44MB)
4. **`venv/`** - Virtual environment (recreated locally)
5. **`__pycache__/`** - Python cache files (auto-generated)

## Quick Setup Checklist

- [ ] Cloned repository
- [ ] Created and activated virtual environment
- [ ] Installed dependencies
- [ ] Created `.env` file with database password
- [ ] PostgreSQL installed and running
- [ ] Database created (`mentalhealthdb`)
- [ ] pgvector extension installed
- [ ] Tables created (schema applied)
- [ ] DeBERTa model files downloaded/copied
- [ ] MentalChat16K dataset downloaded
- [ ] Database built (`build_database.py` run successfully)
- [ ] Ollama installed and running
- [ ] Llama model downloaded
- [ ] Tests passing (`test_phase1.py`)

Once all checked, you're ready to use the chatbot!

