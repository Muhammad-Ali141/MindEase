# Git Push Guide - What to Push and What NOT to Push

This guide explains what files can be safely pushed to git and what should be excluded.

## ✅ PUSH TO GIT (Safe to Share)

### Core Code Files
- ✅ All Python source files (`.py` files)
- ✅ `backend/chatbot/config.py` - Configuration loader (uses env vars)
- ✅ `backend/chatbot/env.example` - Template for environment variables
- ✅ `backend/chatbot/postgresql_schema.sql` - Database schema
- ✅ All test files in `backend/chatbot/tests/`
- ✅ All documentation files (`.md` files)
- ✅ `backend/requirements.txt` - Python dependencies
- ✅ `.gitignore` - Git ignore rules
- ✅ `SETUP_FOR_PARTNER.md` - Setup instructions

### Model Structure (without weights)
- ✅ `deberta_best/config.json`
- ✅ `deberta_best/tokenizer.json`
- ✅ `deberta_best/tokenizer_config.json`
- ✅ `deberta_best/special_tokens_map.json`
- ✅ `deberta_best/spm.model`
- ✅ `deberta_best/added_tokens.json`
- ✅ `deberta_best/training_args.bin`
- ❌ `deberta_best/model.safetensors` - **EXCLUDED** (large file ~500MB+)

### Frontend/Backend Structure
- ✅ All Next.js files
- ✅ All Django backend structure
- ✅ Configuration files (except sensitive data)

## ❌ DO NOT PUSH (Excluded by .gitignore)

### Sensitive Information
- ❌ `.env` files - Contains database passwords
- ❌ Any file with hardcoded passwords
- ❌ `backend/chatbot/.env` - Environment variables

### Large Model Files
- ❌ `deberta_best/model.safetensors` - Model weights (~500MB+)
- ❌ Any `.safetensors`, `.bin`, `.pt`, `.pth` model files

### Large Datasets
- ❌ `dataset/MentalChat16K.csv` - Dataset (~44MB)
- ❌ Any large data files

### Generated/Temporary Files
- ❌ `__pycache__/` - Python cache
- ❌ `*.pyc`, `*.pyo`, `*.pyd` - Compiled Python
- ❌ `venv/` - Virtual environment (recreated locally)
- ❌ `node_modules/` - Node dependencies
- ❌ `.next/` - Next.js build
- ❌ `*.log` - Log files
- ❌ `*.sql.dump`, `*.backup` - Database backups
- ❌ `*.pkl`, `*.h5` - Pickled files

### IDE Files
- ❌ `.vscode/`, `.idea/` - IDE settings
- ❌ `*.swp`, `*.swo` - Editor swap files

### OS Files
- ❌ `.DS_Store` - macOS
- ❌ `Thumbs.db` - Windows

## 🔐 Security Considerations

### Before Pushing:

1. **Check for passwords**: 
   ```bash
   # Search for hardcoded passwords
   grep -r "password" backend/chatbot --exclude-dir=__pycache__ | grep -v "config.py"
   ```

2. **Verify .gitignore**:
   ```bash
   git status --ignored
   ```

3. **Check large files**:
   ```bash
   # Check file sizes
   find . -type f -size +10M -not -path "./.git/*" -not -path "./venv/*"
   ```

## 📦 Files Partner Needs to Download Separately

After cloning, your partner will need to obtain these files:

### 1. DeBERTa Model Weights
- **File**: `deberta_best/model.safetensors`
- **Size**: ~500MB+
- **Options**:
  - Share via cloud storage (Google Drive, OneDrive, etc.)
  - Partner downloads from Hugging Face and fine-tunes
  - Partner uses their own fine-tuned model

### 2. MentalChat16K Dataset
- **File**: `dataset/MentalChat16K.csv`
- **Size**: ~44MB
- **Options**:
  - Download from original source: https://arxiv.org/abs/2503.13509
  - Share via cloud storage
  - Partner downloads separately

## 📝 Setup Process for Partner

1. **Clone repository**
   ```bash
   git clone <repo-url>
   cd MindEase
   ```

2. **Create `.env` file**
   ```bash
   cd backend/chatbot
   cp env.example .env
   # Edit .env with their database password
   ```

3. **Download missing files**
   - Download `model.safetensors` (share link or Hugging Face)
   - Download `MentalChat16K.csv` (share link or original source)

4. **Setup and run**
   - Follow `SETUP_FOR_PARTNER.md` for complete instructions

## ✅ Verification Checklist

Before pushing:

- [ ] No `.env` files committed
- [ ] No hardcoded passwords in code
- [ ] `model.safetensors` excluded (check `.gitignore`)
- [ ] `MentalChat16K.csv` excluded (check `.gitignore`)
- [ ] All sensitive data uses environment variables
- [ ] `env.example` created with template values
- [ ] `config.py` uses `os.getenv()` instead of hardcoded values
- [ ] Documentation updated (`SETUP_FOR_PARTNER.md` exists)
- [ ] `.gitignore` properly configured

## 🚀 Quick Commands

```bash
# Check what will be committed
git status

# Check ignored files
git status --ignored

# Verify large files excluded
find . -type f -size +10M -not -path "./.git/*" -not -path "./venv/*" | xargs git check-ignore

# Test clone in different directory
cd /tmp
git clone <repo-url> test-clone
cd test-clone
# Verify setup works
```

## 📋 Summary

**What's Safe to Push:**
- ✅ Code files
- ✅ Documentation
- ✅ Configuration templates (`env.example`)
- ✅ Test files
- ✅ Database schema
- ✅ Model structure (without weights)

**What's NOT Safe:**
- ❌ Passwords/credentials
- ❌ Large model weights
- ❌ Large datasets
- ❌ Generated/cache files
- ❌ Environment files with actual values

**Result:** Partner can clone, set up their own `.env`, download missing files, and run everything successfully!

