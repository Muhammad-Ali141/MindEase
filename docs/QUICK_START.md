# Quick Start Guide - MindEase Chatbot

**Fast setup guide for your partner!**

## Prerequisites Checklist

- [ ] Python 3.8+ installed
- [ ] PostgreSQL installed
- [ ] Git installed
- [ ] Ollama installed

## 5-Minute Setup

### 1. Clone & Setup Environment

```bash
git clone <repository-url>
cd MindEase

# Create and activate virtual environment
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac

# Install dependencies
cd backend
pip install -r requirements.txt
```

### 2. Configure Database

```bash
# Create .env file
cd chatbot
copy env.example .env  # Windows
# cp env.example .env  # Linux/Mac

# Edit .env and set your PostgreSQL password
notepad .env  # Windows
# nano .env   # Linux/Mac
```

Update: `DB_PASSWORD=your_password_here`

### 3. Setup PostgreSQL

```sql
-- In PostgreSQL
CREATE DATABASE mentalhealthdb;
\c mentalhealthdb
CREATE EXTENSION IF NOT EXISTS vector;
\q
```

Then run schema:
```bash
psql -U postgres -d mentalhealthdb -f backend/chatbot/postgresql_schema.sql
```

### 4. Get Missing Files

**These are NOT in git (too large):**

1. **Model file**: Ask your partner for `deberta_best/model.safetensors` or download DeBERTa v3 Large
2. **Dataset**: Download `MentalChat16K.csv` from https://arxiv.org/abs/2503.13509 or ask partner

Place:
- `model.safetensors` → `deberta_best/` folder
- `MentalChat16K.csv` → `dataset/` folder

### 5. Build Database

```bash
cd backend/chatbot
python build_database.py
```

### 6. Setup Ollama

```bash
# Start Ollama
ollama serve

# In new terminal, download model
ollama pull llama3.1:8b-instruct
# or
ollama pull llama3.1:8b
```

### 7. Run!

**Clean Interface (Recommended):**
```bash
python -m chatbot.chat
# or
backend\chatbot\run_chat.bat  # Windows
```

**Debug Version:**
```bash
python -m chatbot.main
# or
backend\chatbot\run_main.bat  # Windows
```

## That's It!

If everything worked, you should see the therapist greeting you first!

## Need Help?

See **[SETUP_FOR_PARTNER.md](SETUP_FOR_PARTNER.md)** for detailed step-by-step instructions.

