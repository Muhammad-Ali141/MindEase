# Qwen3-TTS Experiment (Separate from MindEase TTS)

This folder is for **testing Qwen3-TTS** in isolation. Nothing here changes the existing MindEase voice chat or XTTS in `backend/tts/`.

---

## What Qwen3-TTS Is

**Qwen3-TTS** is a **text-to-speech** model (Alibaba/Qwen): you give it **text** and optional voice/instruction, and it returns **audio**. So it’s a direct alternative to your current TTS (XTTS): same pipeline (STT → your backend → **TTS** → audio), only the TTS component changes.

- **Code:** [GitHub – QwenLM/Qwen3-TTS](https://github.com/QwenLM/Qwen3-TTS)
- **Demo:** [Hugging Face – Qwen/Qwen3-TTS](https://huggingface.co/spaces/Qwen/Qwen3-TTS)
- **Blog:** [Qwen3-TTS](https://qwen.ai/blog?id=qwen3tts-0115)

**Features:** Custom voices (9 speakers), voice design (natural-language description), voice clone (~3 s reference), streaming, instruction control (tone/emotion). **Languages:** Chinese, English, Japanese, Korean, German, French, Russian, Portuguese, Spanish, Italian.

---

## Prerequisites

- **Python 3.12** recommended (separate venv so MindEase is untouched).
- **GPU** recommended (0.6B / 1.7B models); can run on CPU but slower.
- Optional: **FlashAttention 2** to reduce VRAM (`pip install flash-attn --no-build-isolation`).

---

## Setup (Terminal-Only)

### 1. Create a dedicated venv

Do **not** use the MindEase backend venv:

```powershell
cd B:\Uni\FYP\Implementation\MindEase\MindEase\experiments\qwen3-tts
python -m venv venv
.\venv\Scripts\Activate.ps1
```

### 2. Install dependencies

```powershell
pip install -r requirements.txt
```

Optional (lower VRAM, needs compatible GPU):

```powershell
pip install -U flash-attn --no-build-isolation
```

### 3. Run a sample (CustomVoice, no reference audio)

Generates a WAV from text using a built-in speaker (e.g. Serena):

```powershell
python run_sample.py
```

With options (optional):

```powershell
python run_sample.py --text "Hello, how are you feeling today?" --speaker Ryan --language English --out my_output.wav
```

**Speakers (CustomVoice):** Vivian, Serena, Uncle_Fu, Dylan, Eric, Ryan, Aiden, Ono_Anna, Sohee. Use the speaker’s native language for best quality, or any supported language.

**Languages:** Chinese, English, Japanese, Korean, German, French, Russian, Portuguese, Spanish, Italian.

To use the smaller/faster 0.6B model instead of 1.7B:

```powershell
python run_sample.py --model 0.6B
```

---

## Do / Don’t

| Do | Don’t |
|----|--------|
| Run Qwen3-TTS in this venv and folder | Use the MindEase backend venv or change `backend/tts/` |
| Test via terminal with `run_sample.py` | Wire Qwen3-TTS into the app until you’re happy with it |
| Try different `--speaker`, `--language`, `--text` | Commit large model caches or generated WAVs if you don’t want them in git |

---

## Testing Qwen3-TTS in the pipeline (voice chat)

You can run Qwen3-TTS **inside the same flow** as production (STT → chat → TTS) without changing the default:

1. **Backend:** Install Qwen3-TTS in the **backend** venv (so the API can use it):
   ```powershell
   cd B:\Uni\FYP\Implementation\MindEase\MindEase\backend
   .\venv\Scripts\Activate.ps1   # or your backend venv
   pip install qwen-tts soundfile
   ```
2. **Start** the backend and frontend as usual.
3. **Voice chat:** Open the voice chat page; use the **TTS** dropdown (next to “End Chat”) and select **Qwen3 (experiment)**. All subsequent replies (welcome + assistant) will use Qwen3-TTS. Select **XTTS (default)** to switch back.

The pipeline (RAG, emotion, Ollama) is unchanged; only the TTS engine used for playback is switched so you can compare quality and speed.

### Use only Qwen3-TTS (disable XTTS for a while)

To use **only** Qwen3-TTS and never load XTTS, set this in your **backend** `.env` (e.g. `backend/.env`):

```env
TTS_BACKEND=qwen3
```

Then restart the backend. All TTS requests will use Qwen3; XTTS is not loaded. To switch back to XTTS, remove the line or set `TTS_BACKEND=xtts` and restart.

---

## If You Like It Later

After you’re satisfied with quality and speed here, we can design how to plug Qwen3-TTS into MindEase (e.g. a new TTS backend option in `backend/tts/` that uses Qwen3-TTS instead of XTTS, keeping RAG + emotion + Ollama unchanged).
