# Speech-to-Text (STT) Module

## Overview

This is a **standalone** Speech-to-Text module for real-time microphone transcription. It uses `faster-whisper` with the `Systran/faster-whisper-large-v3` model for high-accuracy English/Urdu transcription.

**Key Features:**
- Real-time microphone transcription
- Automatic CUDA acceleration (falls back to CPU)
- Chunked processing with overlap to avoid dropped words
- Terminal-based output (ready for future integration)
- File transcription support for testing

## Why These Technologies?

### `Systran/faster-whisper-large-v3`
- **Pre-Converted**: Ships as a CTranslate2 checkpoint so `faster-whisper` loads it directly
- **Accuracy**: Whisper v3 improves on conversational accuracy vs. v2 (see [SYSTRAN findings](https://github.com/SYSTRAN/faster-whisper/issues/587?utm_source=openai))
- **Multilingual**: Handles Urdu and English without extra training; pass `--lang auto` (default) to auto-detect
- **Future-Proof**: Swap in a fine-tuned checkpoint later (e.g., Urdu therapy corpus) via the `--model` flag

### `faster-whisper`
- **Performance**: CTranslate2 backend provides 4-5x speedup over original Whisper
- **Memory Efficient**: Lower memory footprint than PyTorch-based implementations
- **CUDA Support**: Automatic GPU acceleration when available
- **Production Ready**: Stable, well-maintained library

## Architecture

### Streaming Pipeline

```
Microphone Input
    ↓
Audio Capture (sounddevice)
    ↓
Chunking with Overlap (3s chunks, 0.5s overlap)
    ↓
Resampling to 16kHz (if needed)
    ↓
STT Model Inference (faster-whisper)
    ↓
Text Output (terminal)
    ↓
Session Transcript Accumulation
```

### Component Overview

1. **`stt_service.py`**: Core STT service class
   - Model loading and management
   - Audio transcription logic
   - Device detection (CUDA/CPU)
   - Compute type optimization

2. **`stt_live.py`**: Live transcription CLI
   - Microphone capture
   - Chunking and overlap handling
   - Real-time processing
   - Session transcript management

## Installation

### Prerequisites

- Python 3.10+
- Virtual environment (recommended)
- Microphone access permissions

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

2. **Navigate to STT module**:
   ```bash
   cd backend/stt
   ```

3. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Verify installation**:
   ```bash
   python -c "from faster_whisper import WhisperModel; print('OK')"
   ```

## Usage

### Live Microphone Transcription

**Basic usage** (default settings):
```bash
# From backend/stt directory
python stt_live.py

# Or as a module from project root
python -m backend.stt.stt_live
```

**With custom options**:
```bash
python stt_live.py --chunk 4.0 --overlap 1.0 --device 1
```

**List available audio devices**:
```bash
python stt_live.py --list-devices
```

### File Transcription (Testing)

Transcribe an audio file instead of microphone:
```bash
python stt_live.py --file path/to/audio.wav
```

### Command-Line Options

| Option | Description | Default |
|--------|-------------|---------|
| `--device` | Audio device index | Default system device |
| `--chunk` | Chunk duration (seconds) | 3.0 |
| `--overlap` | Overlap duration (seconds) | 0.5 |
| `--lang` | Language code (`auto` enables detection) | "auto" |
| `--model` | Model ID | "Systran/faster-whisper-large-v3" |
| `--sample-rate` | Audio sample rate | 16000 |
| `--file` | Transcribe file instead of mic | None |
| `--list-devices` | List audio devices | False |
| `--beam-size` | Beam width for decoding | 5 |
| `--best-of` | Number of best candidates (when temperature > 0) | 5 |
| `--temperature` | Softmax temperature | 0.0 |
| `--silence-threshold` | RMS threshold that marks a pause | 0.0025 |
| `--silence-duration` | Tail duration (seconds) evaluated for silence | 0.7 |

## Performance Tuning

### Chunk Size

- **Small chunks (2-3s)**: Lower latency, more frequent updates
- **Large chunks (4-5s)**: More stable, better context, higher latency
- **Recommendation**: Start with 3.0s, adjust based on your needs

### Overlap

- **Small overlap (0.3-0.5s)**: Faster processing, may miss words at boundaries
- **Large overlap (1.0-1.5s)**: More reliable, prevents dropped words
- **Recommendation**: 0.5s for most cases, increase if you notice missing words

### Compute Type

The module automatically selects:
- **CUDA**: `float16` (fast, good accuracy)
- **CPU**: `int8` (fastest CPU option) or `float32` (fallback)

### Expected Performance

**On RTX 4070 (CUDA + float16)**:
- Chunk processing: ~0.5-1.0s per 3s chunk
- Real-time factor: ~0.2-0.3x (much faster than real-time)

**On CPU (int8)**:
- Chunk processing: ~2-4s per 3s chunk
- Real-time factor: ~0.7-1.3x (near real-time to slightly slower)

## Output Format & Pause Detection

- The CLI prints a full sentence **only after ~0.7 s of silence** (adjustable).
- No partial words appear mid-sentence; this is ideal for sensitive psychiatric notes.
- Stopping the script flushes any pending text and prints `Stopped.`.

Example:
```
Listening... (Press Ctrl+C to stop)
Hello, my name is Ali.
I'm facing some anxiety issues lately.

Stopped.
```

### Silence controls

- `--silence-threshold` (default `0.0025`): RMS amplitude threshold (0–1). Raise it for noisy rooms, lower it if sentences never flush.
- `--silence-duration` (default `0.7` s): Pause length before printing. Increase for slower speakers, decrease for rapid dialogue.

These parameters control when buffered text is emitted; they do **not** change model accuracy.

### Accuracy & Urdu readiness

- `--lang auto` (default) lets Whisper detect the language dynamically; pass `--lang ur` to force Urdu.
- Increase `--beam-size` (e.g., 8) or use a small temperature (`--temperature 0.2 --best-of 5`) when accuracy matters more than latency.
- To fine-tune: train a Whisper v3 checkpoint on your Urdu therapy corpus (HuggingFace + CTranslate2), then point `--model` to the converted folder—no code updates required.

## Future Integration

This module is designed for easy integration into the main MindEase application.

### Django Integration (WebSocket)

```python
# Example: backend/api/views.py or WebSocket consumer
from stt.stt_service import SpeechToTextService

stt_service = SpeechToTextService()

# In WebSocket handler
async def handle_audio_chunk(audio_data, sample_rate):
    transcript = stt_service.transcribe_audio_array(
        audio_data,
        sample_rate,
        language="en"
    )
    await websocket.send_json({
        "type": "transcription",
        "text": transcript
    })
```

### REST API Integration

```python
# Example: backend/api/views.py
from stt.stt_service import SpeechToTextService

@csrf_exempt
def transcribe_audio(request):
    if request.method == "POST":
        audio_file = request.FILES['audio']
        # Save temporarily or process directly
        stt_service = SpeechToTextService()
        transcript = stt_service.transcribe_file(audio_file.path)
        return JsonResponse({"transcript": transcript})
```

### Frontend Integration

The frontend can:
1. Capture microphone audio via Web Audio API
2. Send chunks to backend via WebSocket or REST
3. Display real-time transcriptions
4. Save transcripts to session messages

## Troubleshooting

### Microphone Permission Issues

**macOS**:
- System Preferences → Security & Privacy → Microphone
- Grant permission to Terminal or Python

**Windows**:
- Settings → Privacy → Microphone
- Ensure microphone access is enabled

**Linux**:
- Check ALSA/PulseAudio permissions
- May need to add user to `audio` group

### Audio Device Not Found

```bash
# List available devices
python stt_live.py --list-devices

# Use specific device
python stt_live.py --device 1
```

### Model Loading Errors

**CUDA Out of Memory**:
- The module automatically falls back to CPU
- Or reduce chunk size to process less audio at once

**Model Download Issues**:
- First run downloads model from HuggingFace (~1.5GB)
- Ensure stable internet connection
- Model is cached in `~/.cache/huggingface/`

### Slow Performance

1. **Check device**: Ensure CUDA is being used
   ```python
   python -c "from stt.stt_service import SpeechToTextService; s = SpeechToTextService(); print(s.device)"
   ```

2. **Reduce chunk size**: Smaller chunks = faster processing
   ```bash
   python stt_live.py --chunk 2.0
   ```

3. **CPU optimization**: If on CPU, ensure `int8` compute type is used

### Audio Quality Issues

- **Low volume**: Check microphone input level in system settings
- **Background noise**: Use VAD filter (enabled by default)
- **Distorted audio**: Check sample rate matches microphone (usually 16kHz or 44.1kHz)

## Language Support

### Current: English Only

The module is configured for English transcription. The `Systran/faster-whisper-large-v2` model supports multiple languages, but English is its primary strength.

### Future: Urdu Support

For high-quality Urdu transcription:
1. Fine-tune the model on Urdu datasets
2. Or use a multilingual model (e.g., `openai/whisper-large-v3`)
3. Update the `--lang` parameter to `"ur"`

**Note**: The module is designed to accept custom fine-tuned models via the `--model` parameter.

## Testing Checklist

Run these commands to verify the installation:

```bash
# 1. Create and activate virtual environment
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/macOS

# 2. Install dependencies
cd backend/stt
pip install -r requirements.txt

# 3. List audio devices (verify microphone access)
python stt_live.py --list-devices

# 4. Run live transcription (from backend/stt directory)
python stt_live.py
# Or from project root: python -m backend.stt.stt_live

# 5. Speak into microphone and verify transcriptions appear

# 6. Test file transcription (if you have a test audio file)
python stt_live.py --file test_audio.wav
```

## Module Structure

```
backend/stt/
├── __init__.py          # Module initialization
├── stt_service.py       # Core STT service class
├── stt_live.py          # Live transcription CLI
├── requirements.txt     # Python dependencies
└── README.md           # This file
```

## Dependencies

- **faster-whisper**: Core STT engine
- **sounddevice**: Cross-platform microphone capture
- **soundfile**: Audio file I/O
- **resampy**: Audio resampling
- **numpy**: Numerical processing
- **tqdm**: Progress bars (optional)
- **python-dotenv**: Environment variables (optional)

## License

This module is part of the MindEase project and follows the same license.

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review logs for error messages
3. Verify all dependencies are installed correctly
4. Test with file transcription first before trying live mic

---

**Version**: 1.0.0  
**Last Updated**: November 2025  
**Status**: Standalone module, ready for integration

