# Git Push Checklist

Use this checklist before pushing to ensure everything is ready for your partner.

## ✅ Pre-Push Checklist

### 1. Security
- [ ] No `.env` files committed (check: `git status | grep .env`)
- [ ] No hardcoded passwords in code (check: `grep -r "password" backend/chatbot --exclude-dir=__pycache__`)
- [ ] All passwords use environment variables
- [ ] `env.example` file exists with template values

### 2. Large Files
- [ ] `model.safetensors` excluded (check: `git check-ignore deberta_best/model.safetensors`)
- [ ] `MentalChat16K.csv` excluded (check: `git check-ignore dataset/MentalChat16K.csv`)
- [ ] No other large files committed

### 3. Configuration
- [ ] `config.py` uses `os.getenv()` for all sensitive data
- [ ] `env.example` created with all required variables
- [ ] All test files use `config.py` instead of hardcoded values

### 4. Documentation
- [ ] `SETUP_FOR_PARTNER.md` created and complete
- [ ] `GIT_PUSH_GUIDE.md` created
- [ ] `README.md` updated if needed

### 5. .gitignore
- [ ] `.env` files listed
- [ ] Large model files excluded
- [ ] Dataset excluded
- [ ] Cache files excluded
- [ ] Virtual environment excluded

## 🚀 Quick Verification Commands

```bash
# Check what will be committed
git status

# Verify large files are ignored
git check-ignore deberta_best/model.safetensors
git check-ignore dataset/MentalChat16K.csv

# Check for hardcoded passwords (should only find config.py references)
grep -r "password" backend/chatbot --exclude-dir=__pycache__ | grep -v "config.py" | grep -v "env.example"

# Check file sizes (nothing > 10MB should be committed)
find . -type f -size +10M -not -path "./.git/*" -not -path "./venv/*" | xargs git check-ignore
```

## 📝 Summary

**Ready to Push:**
- ✅ Code files (all `.py` files)
- ✅ Documentation (`.md` files)
- ✅ Configuration template (`env.example`)
- ✅ Tests (all in `tests/`)
- ✅ Database schema
- ✅ Model structure (without weights)

**Excluded from Git:**
- ❌ `.env` files (sensitive)
- ❌ `model.safetensors` (large)
- ❌ `MentalChat16K.csv` (large)
- ❌ Cache files
- ❌ Virtual environment

**Partner Will Need:**
1. Clone repository
2. Create `.env` from `env.example`
3. Download `model.safetensors` (share separately)
4. Download `MentalChat16K.csv` (share separately)
5. Follow `SETUP_FOR_PARTNER.md`

Everything is ready! 🎉

