# TTS Virtual Environment Setup

This directory contains a separate virtual environment (`venv_tts`) specifically for TTS functionality.

## Why a Separate Venv?

The TTS module requires `transformers==4.33.0` (for `BeamSearchScorer` compatibility), while the main chatbot requires `transformers>=4.40.0` (for `sentence-transformers` compatibility). These conflicting requirements necessitate separate environments.

## Using the TTS Venv

### Activate the TTS venv:
```powershell
cd backend/tts
.\venv_tts\Scripts\Activate.ps1
```

### Run TTS commands:
```powershell
python tts_live.py --text "Hello, how are you?" --play
```

### Or use the venv directly without activating:
```powershell
.\venv_tts\Scripts\python.exe tts_live.py --text "Hello, how are you?" --play
```

## Installed Versions

- **TTS**: 0.22.0
- **transformers**: 4.33.0 (required for TTS)
- **huggingface-hub**: <1.0.0 (compatible with transformers 4.33.0)
- **torch**: 2.9.1
- **torchaudio**: 2.9.1

## Notes

- The TTS venv is independent of the main project venv
- Always use this venv when running TTS-related scripts
- The main Django server should use the root venv (for chatbot functionality)

