# Text-to-Speech (TTS) Module

## Overview

This is a **standalone** Text-to-Speech module for high-quality, multilingual speech synthesis. It uses **Coqui TTS (XTTS v2)** for natural-sounding voices with support for 17+ languages including English and Urdu.

**Key Features:**
- High-quality, natural-sounding speech synthesis
- Multilingual support (English, Urdu, and 15+ other languages)
- Automatic CUDA acceleration (falls back to CPU)
- Terminal-based testing interface
- Voice cloning support (optional, requires reference audio)
- Audio file saving and playback
- Sentence-by-sentence processing for long texts

## Why Coqui XTTS v2?

### **Coqui XTTS v2**
- **High Quality**: Produces natural, human-like speech
- **Multilingual**: Supports 17 languages including English and Urdu
- **Voice Cloning**: Can clone voices from short reference audio (3-10 seconds)
- **Free & Open-Source**: No API costs, fully local processing
- **Privacy-Preserving**: All processing happens locally
- **Active Development**: Well-maintained with active community

### Performance
- **CUDA**: ~10-20x real-time synthesis (very fast)
- **CPU**: ~2-5x real-time synthesis (acceptable for most use cases)
- **Model Size**: ~1.7GB (downloaded automatically on first use)

## Architecture

### Synthesis Pipeline

```
Text Input
    ↓
Text Preprocessing (sentence splitting, normalization)
    ↓
TTS Model Inference (XTTS v2)
    ↓
Audio Generation (NumPy array, 22050 Hz, mono)
    ↓
Audio Output (WAV file or playback)
```

### Component Overview

1. **`tts_service.py`**: Core TTS service class
   - Model loading and management
   - Text-to-speech synthesis
   - Device detection (CUDA/CPU)
   - Audio format handling
   - Language and voice selection

2. **`tts_live.py`**: Terminal-based TTS CLI
   - Interactive text input
   - File-based text input
   - Audio playback
   - Audio file saving
   - Voice cloning support

## Installation

### Prerequisites

- **Python 3.9, 3.10, or 3.11** (Python 3.12+ is NOT supported by Coqui TTS)
- Virtual environment (recommended)
- CUDA-capable GPU (optional but recommended for best performance)

**⚠️ Important**: Coqui TTS requires Python >= 3.9 and < 3.12. If you have Python 3.12+, you need to:
1. Use Python 3.10 or 3.11 (recommended - create a new venv with Python 3.10/3.11)
2. Or use an alternative TTS library (see "Alternative TTS Libraries" section below)

### GPU Setup (Optional but Recommended)

For CUDA acceleration, you need:
- NVIDIA GPU with CUDA support
- CUDA Toolkit 11.8+ or 12.1+
- cuDNN library

The module will automatically detect and use CUDA if available.

### Step-by-Step Installation

1. **Create and activate virtual environment**:
   ```bash
   # Windows
   python -m venv venv
   venv\Scripts\activate
   
   # Linux/macOS
   python3 -m venv venv
   source venv/bin/activate
   ```

2. **Navigate to TTS module**:
   ```bash
   cd backend/tts
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

   **Note**: 
   - This will install PyTorch, Coqui TTS, and other dependencies
   - If you get an error about TTS not being found, check your Python version: `python --version`
   - TTS requires Python 3.9-3.11 (not 3.12+)
   - The first run will download the XTTS v2 model (~1.7GB) automatically
   
   **If installation fails due to Python version**:
   - Create a new virtual environment with Python 3.10 or 3.11:
     ```bash
     # Windows (using py launcher)
     py -3.10 -m venv venv_tts
     venv_tts\Scripts\activate
     
     # Or download Python 3.10/3.11 and use it directly
     ```

4. **Verify installation**:
   ```bash
   python -c "from TTS.api import TTS; print('OK')"
   ```

## Usage

### Interactive Mode

Start interactive mode to enter text and hear it synthesized:

```bash
# From backend/tts directory
python tts_live.py

# Or as a module from project root
python -m backend.tts.tts_live
```

Example session:
```
Interactive TTS Mode
Enter text to synthesize (or 'quit' to exit):
------------------------------------------------------------
> Hello, how are you today?
Synthesizing: Hello, how are you today?
Synthesis complete in 2.34s (audio: 3.12s)
Playing audio...

> I'm doing great, thank you!
Synthesizing: I'm doing great, thank you!
Synthesis complete in 1.89s (audio: 2.45s)
Playing audio...

> quit
Exiting...
```

### Direct Text Input

Synthesize text directly from command line:

```bash
# English text with playback
python tts_live.py --text "Hello, how are you?" --play

# Urdu text
python tts_live.py --text "آپ کیسے ہیں؟" --lang ur --play

# Save to file without playback
python tts_live.py --text "This will be saved to a file" --output output.wav --no-play
```

### File Input

Read text from a file and synthesize:

```bash
# Read from file, play audio
python tts_live.py --file input.txt --play

# Read from file, save to output
python tts_live.py --file input.txt --output output.wav

# Urdu text file
python tts_live.py --file urdu_text.txt --lang ur --output urdu_audio.wav --play
```

### Voice Cloning (Optional)

Clone a voice from reference audio:

```bash
# Use reference audio for voice cloning
python tts_live.py --text "Hello, this is my cloned voice" --speaker reference_voice.wav --play
```

**Requirements for voice cloning:**
- Reference audio: 3-10 seconds of clear speech
- WAV format recommended
- Single speaker, minimal background noise

### Command-Line Options

| Option | Description | Default |
|--------|-------------|---------|
| `--text` | Direct text input | None (interactive mode) |
| `--file` | Input text file path | None |
| `--output` | Output audio file path (WAV) | None (no save) |
| `--lang` | Language code | "en" |
| `--play` | Auto-play audio after synthesis | False |
| `--no-play` | Don't play audio | False |
| `--device` | Force device (cuda/cpu) | Auto-detect |
| `--model` | TTS model name | "tts_models/multilingual/multi-dataset/xtts_v2" |
| `--speaker` | Reference audio for voice cloning | None |
| `--list-languages` | List supported languages | False |

### Supported Languages

List all supported languages:
```bash
python tts_live.py --list-languages
```

Supported languages:
- `en` - English
- `ur` - Urdu
- `es` - Spanish
- `fr` - French
- `de` - German
- `it` - Italian
- `pt` - Portuguese
- `pl` - Polish
- `tr` - Turkish
- `ru` - Russian
- `nl` - Dutch
- `cs` - Czech
- `ar` - Arabic
- `zh-cn` - Chinese (Simplified)
- `ja` - Japanese
- `hu` - Hungarian
- `ko` - Korean

## Python API Usage

### Basic Usage

```python
from backend.tts.tts_service import TTSService

# Initialize TTS service
tts = TTSService()

# Synthesize text
audio = tts.synthesize("Hello, how are you?", language="en")

# Save to file
tts.synthesize_to_file(
    text="This will be saved to a file",
    output_path="output.wav",
    language="en"
)

# Clean up
tts.close()
```

### Context Manager

```python
from backend.tts.tts_service import TTSService

with TTSService() as tts:
    audio = tts.synthesize("Hello, world!", language="en")
    # Service automatically closes when exiting context
```

### Voice Cloning

```python
from backend.tts.tts_service import TTSService

tts = TTSService()

# Clone voice from reference audio
audio = tts.synthesize(
    text="This will sound like the reference speaker",
    language="en",
    speaker_wav="reference_voice.wav"
)

tts.close()
```

### Language Switching

```python
from backend.tts.tts_service import TTSService

tts = TTSService()

# English
audio_en = tts.synthesize("Hello", language="en")

# Urdu
audio_ur = tts.synthesize("ہیلو", language="ur")

# Spanish
audio_es = tts.synthesize("Hola", language="es")

tts.close()
```

## Performance Tuning

### Device Selection

The module automatically detects CUDA if available. You can force a device:

```bash
# Force CPU
python tts_live.py --text "Hello" --device cpu

# Force CUDA
python tts_live.py --text "Hello" --device cuda
```

### Expected Performance

**On RTX 4070 (CUDA)**:
- Synthesis speed: ~10-20x real-time
- Example: 3 seconds of audio in ~0.15-0.3 seconds

**On CPU**:
- Synthesis speed: ~2-5x real-time
- Example: 3 seconds of audio in ~0.6-1.5 seconds

### Memory Usage

- **Model Loading**: ~2GB RAM
- **Inference**: Additional ~500MB-1GB during synthesis
- **Total**: ~2.5-3GB RAM recommended

## Audio Output Format

- **Sample Rate**: 22050 Hz (XTTS default)
- **Channels**: Mono
- **Format**: WAV (uncompressed)
- **Bit Depth**: 16-bit
- **File Extension**: `.wav`

## Alternative TTS Libraries (Python 3.12+)

If you're using Python 3.12+ and cannot use Coqui TTS, here are alternatives:

### Option 1: Piper TTS (Recommended for Python 3.12+)
- **Pros**: Fast, lightweight, supports Python 3.12+
- **Cons**: Lower quality than XTTS, fewer languages
- **Installation**: `pip install piper-tts`
- **Note**: Would require code modifications to use Piper instead of Coqui TTS

### Option 2: Edge-TTS (Microsoft Edge TTS)
- **Pros**: High quality, many voices, Python 3.12+ compatible
- **Cons**: Requires internet connection (not fully local)
- **Installation**: `pip install edge-tts`
- **Note**: Would require code modifications

### Option 3: Use Python 3.10/3.11 (Recommended)
- Create a separate virtual environment with Python 3.10 or 3.11
- This allows you to use Coqui TTS without code changes

## Troubleshooting

### Python Version Issues

**Error**: `ERROR: Could not find a version that satisfies the requirement TTS>=0.22.0`

**Solution**: Coqui TTS requires Python 3.9-3.11. If you have Python 3.12+:
1. Check your Python version: `python --version`
2. Create a new virtual environment with Python 3.10 or 3.11:
   ```bash
   # Windows
   py -3.10 -m venv venv_tts
   venv_tts\Scripts\activate
   
   # Linux/macOS
   python3.10 -m venv venv_tts
   source venv_tts/bin/activate
   ```
3. Install dependencies in the new environment

### Model Download Issues

**First run downloads model (~1.7GB)**:
- Ensure stable internet connection
- Model is cached in `~/.local/share/tts/` (Linux/Mac) or `%LOCALAPPDATA%\tts\` (Windows)
- First download may take several minutes

### CUDA Out of Memory

**If you get CUDA OOM errors**:
- The module automatically falls back to CPU
- Or force CPU: `--device cpu`
- Reduce text length (split into smaller chunks)

### Slow Performance on CPU

**If synthesis is too slow**:
1. **Check device**: Ensure CUDA is being used if available
   ```python
   python -c "from backend.tts.tts_service import TTSService; tts = TTSService(); print(tts.device)"
   ```

2. **Use shorter texts**: Split long texts into sentences (automatic)

3. **Consider GPU**: CUDA provides 5-10x speedup

### Audio Playback Issues

**If audio doesn't play**:
- Check system audio settings
- Install audio drivers
- Try saving to file instead: `--output test.wav --no-play`
- Play the file manually to verify synthesis worked

### Language Not Supported

**If language code is invalid**:
- Use `--list-languages` to see supported languages
- Ensure language code matches exactly (e.g., `ur` for Urdu, not `urdu`)

### Voice Cloning Issues

**If voice cloning doesn't work**:
- Ensure reference audio is 3-10 seconds
- Use WAV format for best results
- Ensure single speaker, minimal background noise
- Check that reference audio is clear and intelligible

## Future Integration

This module is designed for easy integration into the main MindEase application.

### Django Integration (REST API)

```python
# Example: backend/api/views.py
from backend.tts.tts_service import TTSService

@csrf_exempt
def tts_synthesize(request):
    if request.method == "POST":
        text = request.POST.get('text')
        language = request.POST.get('language', 'en')
        
        tts = TTSService()
        output_path = f"/tmp/tts_{uuid.uuid4()}.wav"
        
        tts.synthesize_to_file(
            text=text,
            output_path=output_path,
            language=language
        )
        
        # Return audio file
        with open(output_path, 'rb') as f:
            response = HttpResponse(f.read(), content_type='audio/wav')
            response['Content-Disposition'] = f'attachment; filename="tts.wav"'
            return response
```

### Frontend Integration

The frontend can:
1. Send text to backend TTS endpoint
2. Receive audio file or stream
3. Play audio using HTML5 Audio API
4. Show playback controls (play, pause, stop)
5. Allow voice selection and language switching

### Chat Integration

- Auto-play AI responses in voice chat
- Optional TTS for text chat messages
- Voice settings in user profile
- Language preference per user

## Testing Checklist

Run these commands to verify the installation:

```bash
# 1. Create and activate virtual environment
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/macOS

# 2. Install dependencies
cd backend/tts
pip install -r requirements.txt

# 3. Test basic synthesis (English)
python tts_live.py --text "Hello, this is a test" --play

# 4. Test Urdu synthesis
python tts_live.py --text "یہ ایک ٹیسٹ ہے" --lang ur --play

# 5. Test file input
echo "This is a test file" > test.txt
python tts_live.py --file test.txt --output test.wav --play

# 6. Test interactive mode
python tts_live.py
# Enter some text, then type 'quit' to exit

# 7. List supported languages
python tts_live.py --list-languages
```

## Module Structure

```
backend/tts/
├── __init__.py          # Module initialization
├── tts_service.py       # Core TTS service class
├── tts_live.py          # Terminal-based TTS CLI
├── requirements.txt     # Python dependencies
└── README.md           # This file
```

## Dependencies

- **TTS**: Coqui TTS library (core TTS engine)
- **torch**: PyTorch for model inference
- **torchaudio**: Audio processing utilities
- **soundfile**: Audio file I/O
- **sounddevice**: Audio playback
- **numpy**: Numerical processing
- **pydub**: Audio format conversion (optional)

## License

This module is part of the MindEase project and follows the same license.

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review logs for error messages
3. Verify all dependencies are installed correctly
4. Test with simple text first before trying complex inputs

---

**Version**: 1.0.0  
**Last Updated**: January 2025  
**Status**: Standalone module, ready for integration

