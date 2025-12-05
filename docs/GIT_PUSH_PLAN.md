# Git Push Plan for MindEase Project

## 📋 Overview
This document outlines the plan to prepare and push all changes to Git, ensuring that sensitive files, temporary files, and large binaries are properly excluded.

## 🔍 Current Status

### Files Currently Tracked (Should Review):
- ✅ `backend/chatbot/postgresql_schema.sql` - Schema file (KEEP - useful for setup)
- ⚠️ `fyp.sql` - Database dump file (REVIEW - might be personal/test data)
- ⚠️ `venv/` - Python virtual environment (SHOULD BE IGNORED - already in .gitignore but exists in root)

### Untracked Files (New Features):
- ✅ `app/voice-chat/` - Voice chat feature (ADD)
- ✅ `backend/stt/` - Speech-to-Text module (ADD)
- ✅ `backend/tts/` - Text-to-Speech module (ADD)
- ✅ `hooks/use-microphone.ts` - Microphone hook (ADD)
- ✅ `docs/FFMPEG_INSTALLATION.md` - Documentation (ADD)
- ✅ `docs/TTS_VOICE_CHAT_INTEGRATION_PLAN.md` - Documentation (ADD)
- ✅ `docs/VOICE_CHAT_INTEGRATION_PLAN.md` - Documentation (ADD)
- ⚠️ `gg.ipynb` - Jupyter notebook (REVIEW - personal/test file?)

### Files That Should Be Ignored:
- ❌ `venv/` - Virtual environment (already in .gitignore)
- ❌ `backend/tts/Audios/*.wav` - Test audio files (ADD to .gitignore)
- ❌ `fyp.sql` - Personal database dump (ADD to .gitignore if not needed)
- ❌ `gg.ipynb` - Jupyter notebook (ADD to .gitignore if not needed)
- ❌ `backup/` - Backup directory (already in .gitignore)
- ❌ `*.tsbuildinfo` - TypeScript build info (already in .gitignore)
- ❌ `__pycache__/` - Python cache (already in .gitignore)
- ❌ `.env*` - Environment files (already in .gitignore)

## 📝 Step-by-Step Plan

### Phase 1: Update .gitignore ✅
**Status:** Ready to execute

**Actions:**
1. Add audio test files to .gitignore:
   - `backend/tts/Audios/*.wav`
   - `backend/stt/**/*.wav` (if any test files exist)
   - `*.wav` (general audio files, but allow specific ones if needed)

2. Add Jupyter notebooks (if not needed):
   - `*.ipynb` (or specifically `gg.ipynb`)

3. Add database dump files:
   - `fyp.sql` (if it's a personal/test dump)
   - `*.sql` (but keep schema files like `postgresql_schema.sql`)

4. Ensure venv is properly ignored:
   - Verify `venv/` pattern works for root-level venv
   - Add `**/venv/` to catch venv in any directory

5. Add temporary/cache files:
   - `*.tmp`
   - `*.temp`
   - `*.cache`
   - `.pytest_cache/`
   - `.mypy_cache/`

6. Add OS-specific files:
   - `desktop.ini` (Windows)
   - `$RECYCLE.BIN/` (Windows)

7. Add IDE-specific files:
   - `.vs/` (Visual Studio)
   - `*.code-workspace` (if personal)

8. Add model/checkpoint files (if large):
   - `*.ckpt`
   - `*.weights`
   - `models/**/*.bin` (if not already covered)

### Phase 2: Review Tracked Files ⚠️
**Status:** Needs decision

**Actions:**
1. **Review `fyp.sql`:**
   - Is this a personal database dump or a schema file?
   - If personal/test data: Remove from tracking and add to .gitignore
   - If schema/documentation: Keep it

2. **Review `gg.ipynb`:**
   - Is this a test/experimental notebook?
   - If yes: Add to .gitignore
   - If it contains important analysis: Keep it

3. **Review audio files:**
   - Check if `backend/tts/Audios/*.wav` are test files
   - If test files: Ensure they're in .gitignore
   - If sample/reference files: Consider keeping with a note

### Phase 3: Clean Git State 🧹
**Status:** Ready after Phase 1 & 2

**Actions:**
1. Remove files from Git tracking (if needed):
   ```powershell
   # If fyp.sql should be ignored:
   git rm --cached fyp.sql
   
   # If audio files were tracked:
   git rm --cached backend/tts/Audios/*.wav
   
   # If gg.ipynb should be ignored:
   git rm --cached gg.ipynb
   ```

2. Verify .gitignore is working:
   ```powershell
   git status
   # Should not show venv/, __pycache__/, .env files, etc.
   ```

### Phase 4: Stage All Changes 📦
**Status:** Ready after Phase 3

**Actions:**
1. Review all changes:
   ```powershell
   git status
   ```

2. Stage all new features:
   ```powershell
   git add app/voice-chat/
   git add backend/stt/
   git add backend/tts/
   git add hooks/use-microphone.ts
   git add docs/FFMPEG_INSTALLATION.md
   git add docs/TTS_VOICE_CHAT_INTEGRATION_PLAN.md
   git add docs/VOICE_CHAT_INTEGRATION_PLAN.md
   ```

3. Stage modified files:
   ```powershell
   git add .
   # Or selectively add files
   ```

4. Stage .gitignore update:
   ```powershell
   git add .gitignore
   ```

### Phase 5: Commit Changes 💾
**Status:** Ready after Phase 4

**Actions:**
1. Create a comprehensive commit message:
   ```powershell
   git commit -m "feat: Add voice chat with STT and TTS integration

   - Add voice chat page with microphone integration
   - Integrate Speech-to-Text (STT) using faster-whisper
   - Integrate Text-to-Speech (TTS) using Coqui TTS
   - Add session management for voice chats
   - Add comprehensive documentation for voice features
   - Update requirements.txt with all dependencies
   - Improve .gitignore to exclude test files and venv
   
   Features:
   - Real-time audio transcription
   - AI response audio synthesis
   - Synchronized text and audio playback
   - Session summary generation for voice chats
   - Microphone permission handling
   
   Technical:
   - STT: faster-whisper with deduplication and hallucination filtering
   - TTS: XTTS v2 with singleton pattern for performance
   - Audio format conversion (WebM to WAV) using pydub
   - FFmpeg integration for audio processing"
   ```

### Phase 6: Push to Remote 🚀
**Status:** Ready after Phase 5

**Actions:**
1. Check current branch:
   ```powershell
   git branch
   ```

2. Check remote:
   ```powershell
   git remote -v
   ```

3. Push to remote:
   ```powershell
   # If pushing to main/master:
   git push origin main
   # or
   git push origin master
   
   # If pushing to a feature branch:
   git push origin feature/voice-chat
   ```

## ⚠️ Important Notes

### Before Pushing:
1. **Never commit:**
   - `.env` files with real credentials
   - `venv/` directory
   - Large model files (>100MB)
   - Personal database dumps
   - API keys or secrets

2. **Verify:**
   - All sensitive data is in .gitignore
   - No credentials in code
   - Requirements.txt is up to date
   - Documentation is complete

3. **Consider:**
   - Creating a `.env.example` file with placeholder values
   - Adding a `README.md` with setup instructions
   - Documenting required environment variables

### After Pushing:
1. Verify on remote repository that:
   - All files are present
   - No sensitive files are visible
   - Repository size is reasonable

2. Inform team members:
   - New dependencies to install
   - Environment variables needed
   - Setup steps for voice features

## 📊 File Size Considerations

### Large Files to Watch:
- Model files in `deberta_best/` (already partially ignored)
- Audio files (should be ignored if test files)
- Database dumps (should be ignored)
- Virtual environments (should be ignored)

### Recommended:
- Use Git LFS for files >100MB (if needed)
- Keep model weights out of repository
- Use `.env.example` for configuration templates

## ✅ Checklist Before Pushing

- [ ] .gitignore updated with all necessary patterns
- [ ] No sensitive files in staging area
- [ ] No venv/ or __pycache__/ directories tracked
- [ ] No .env files tracked
- [ ] requirements.txt is complete and accurate
- [ ] All new features are documented
- [ ] Commit message is descriptive
- [ ] Remote repository is configured
- [ ] Branch name is appropriate
- [ ] Ready to push!

## 🎯 Execution Order

1. **Update .gitignore** (Phase 1)
2. **Review tracked files** (Phase 2) - **DECISION NEEDED**
3. **Clean Git state** (Phase 3)
4. **Stage changes** (Phase 4)
5. **Commit** (Phase 5)
6. **Push** (Phase 6) - **WAIT FOR USER APPROVAL**

---

**Status:** Plan ready. Awaiting user approval to proceed with Phase 1.

