# Local Setup for Your Machine

This guide helps you set up the chatbot to run on your local machine.

## Quick Setup

### 1. Environment File Already Created ✅

The `.env` file has been created in `backend/chatbot/` with your local settings:
- **DB_PASSWORD**: `pakistan` (your local password)
- **DB_NAME**: `mentalhealthdb`
- **DB_USER**: `postgres`

### 2. Verify .env File

```bash
cd backend/chatbot
cat .env  # Linux/Mac
# or
type .env  # Windows
```

You should see:
```
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mentalhealthdb
DB_USER=postgres
DB_PASSWORD=pakistan
```

### 3. Update Password if Needed

If your PostgreSQL password is different, edit `.env`:
```bash
# Edit the file
notepad .env  # Windows
# or
nano .env     # Linux/Mac
```

Change:
```
DB_PASSWORD=your_actual_password
```

### 4. Verify Configuration Loads

```bash
python -c "from chatbot.config import DB_CONFIG; print('Password:', DB_CONFIG['password'])"
```

Should print your password (confirming it loaded from `.env`).

### 5. Run the Chatbot

**Clean Chat Interface:**
```bash
python chat.py
# or
python -m chatbot.chat
```

**Debug Version (with verbose output):**
```bash
python main.py
# or
python -m chatbot.main
```

## How It Works

1. **`config.py`** loads settings from:
   - `.env` file in `backend/chatbot/` (first priority)
   - `.env` file in `backend/` (second priority)
   - `.env` file in project root (third priority)
   - Environment variables (if no .env found)
   - Default values (last resort)

2. **`.env` file** is in `.gitignore` (not committed to git)
3. **`env.example`** is committed (template for others)

## Troubleshooting

### Password Authentication Failed

**Check:**
1. Is `.env` file in `backend/chatbot/`?
2. Does it have `DB_PASSWORD=pakistan`?
3. Is PostgreSQL running?
4. Is the password correct?

**Fix:**
```bash
# Verify .env exists
cd backend/chatbot
ls -la .env  # Linux/Mac
dir .env     # Windows

# Check password
python -c "from chatbot.config import DB_CONFIG; print(DB_CONFIG)"
```

### Config Not Loading

**Check:**
1. Is `python-dotenv` installed?
   ```bash
   pip install python-dotenv
   ```

2. Is `.env` file format correct?
   - No spaces around `=`
   - No quotes around values
   - Each variable on new line

**Example .env:**
```
DB_HOST=localhost
DB_PASSWORD=pakistan
```

**Not:**
```
DB_HOST = localhost
DB_PASSWORD = "pakistan"
```

### Still Having Issues?

Check the config directly:
```bash
python -c "import os; os.chdir('backend/chatbot'); from dotenv import load_dotenv; load_dotenv('.env'); print('DB_PASSWORD:', os.getenv('DB_PASSWORD'))"
```

## Notes

- **`.env` file is local only** - Not committed to git
- **Each machine needs its own `.env`** - Copy `env.example` to `.env` on each machine
- **Default password** - Currently set to `pakistan` for local development
- **Production** - Change default password in `config.py` or use environment variables

