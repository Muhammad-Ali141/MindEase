# PersonaPlex Experiment (Separate from MindEase Voice Chat)

This folder is for **testing NVIDIA PersonaPlex** in isolation. Nothing here touches the existing MindEase voice chat or XTTS.

---

## What PersonaPlex Is (Important)

**PersonaPlex is not a TTS (text-to-speech) engine.** It is a **full-duplex speech-to-speech conversational model**:

| | Current MindEase voice chat | PersonaPlex |
|---|-----------------------------|-------------|
| **Flow** | User speaks → STT (text) → Chat API (LLM) → TTS (audio) | User speaks (audio) → **model responds with speech (audio)** directly |
| **Input** | Mic → WebM → WAV → text | User speech (WAV, 24 kHz) + optional text prompt (persona) |
| **Output** | TTS audio (XTTS) | Model’s spoken response (audio) + text |
| **Use case** | STT + RAG/LLM + TTS pipeline | Single model: speech in, speech out (turn-taking, interruptions) |

So PersonaPlex is an alternative **voice conversation** stack (speech→speech), not a drop-in replacement for “text → speech” only. You can still test it here and, if you like it, later design how it could replace or sit alongside the current STT+Chat+TTS flow.

---

## Official Links

- **Code:** [GitHub – NVIDIA/personaplex](https://github.com/NVIDIA/personaplex)
- **Weights:** [Hugging Face – nvidia/personaplex-7b-v1](https://huggingface.co/nvidia/personaplex-7b-v1)
- **Demo:** [PersonaPlex Project Page](https://research.nvidia.com/labs/adlr/personaplex/)

---

## Prerequisites

- **Python 3.10+** (separate venv recommended so MindEase is untouched).
- **Opus:** Required by the stack.
  - **Windows:** Install [Opus](https://opus-codec.org/) or use a build that provides `opus` (e.g. [opus-win64](https://github.com/xiph/opus/releases)); add to PATH if needed. Some installs use `vcpkg install opus` or copy DLLs into the project.
  - **Linux:** `sudo apt install libopus-dev` (Ubuntu/Debian) or `sudo dnf install opus-devel` (Fedora).
  - **macOS:** `brew install opus`
- **Hugging Face:** Accept the [model license](https://huggingface.co/nvidia/personaplex-7b-v1) and create a token.
- **Hardware:** 7B model; NVIDIA GPU (e.g. A100, or consumer GPU with enough VRAM) is recommended. CPU offload is supported with `--cpu-offload` (and `pip install accelerate`).

---

## Setup (Terminal-Only, No MindEase Code Changes)

### 1. Clone PersonaPlex

Clone **outside** the MindEase app (e.g. a sibling folder or `experiments/personaplex/repo`):

```bash
# Example: clone into this experiment folder
cd B:\Uni\FYP\Implementation\MindEase\MindEase\experiments\personaplex
git clone https://github.com/NVIDIA/personaplex.git repo
cd repo
```

Or clone to any directory you prefer and run the steps below from there.

### 2. Create a Dedicated Venv (Recommended)

Do **not** use the MindEase backend venv. Use a new one for this experiment:

```powershell
cd path\to\personaplex\repo
python -m venv venv
.\venv\Scripts\Activate.ps1
```

### 3. Install PersonaPlex

From the **repo root** (where `moshi/` lives):

```powershell
pip install moshi/.
```

Optional (Blackwell GPUs):  
`pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu130`

For CPU offload (low VRAM):  
`pip install accelerate`

### 4. Hugging Face Token

1. Accept the model license: [nvidia/personaplex-7b-v1](https://huggingface.co/nvidia/personaplex-7b-v1).
2. Create a token at [Hugging Face → Settings → Access Tokens](https://huggingface.co/settings/tokens).
3. Set it in the terminal (same session where you’ll run the app):

```powershell
$env:HF_TOKEN = "your_token_here"
```

---

## How to Run (Terminal Only)

All commands are run from the **PersonaPlex repo** with its **venv activated** and **HF_TOKEN** set. MindEase stays unused.

### Option A: Live server (Web UI)

Starts an HTTPS server and a Web UI for real-time voice conversation:

```powershell
# Windows PowerShell: create a temp dir for SSL and run server
$SSL_DIR = "$env:TEMP\personaplex_ssl"; New-Item -ItemType Directory -Path $SSL_DIR -Force; python -m moshi.server --ssl $SSL_DIR
```

If GPU memory is tight:

```powershell
$SSL_DIR = "$env:TEMP\personaplex_ssl"; New-Item -ItemType Directory -Path $SSL_DIR -Force; python -m moshi.server --ssl $SSL_DIR --cpu-offload
```

Then open the URL shown (e.g. `https://localhost:8998`) in the browser. You can talk and get speech responses there.

### Option B: Offline (input WAV → output WAV)

Uses a single input WAV and writes the model’s response to an output WAV (no server, no MindEase):

**Assistant-style (default persona):**

```powershell
$env:HF_TOKEN = "your_token"
python -m moshi.offline `
  --voice-prompt "NATF2.pt" `
  --input-wav "assets/test/input_assistant.wav" `
  --seed 42424242 `
  --output-wav "output.wav" `
  --output-text "output.json"
```

**With a custom text prompt (e.g. therapist-style):**

Create a text file (e.g. `prompt_therapist.txt`) with one line:

```
You are a supportive mental health ally. You listen, reflect, and respond with warmth and clarity. Keep responses concise and natural.
```

Then:

```powershell
python -m moshi.offline `
  --voice-prompt "NATF2.pt" `
  --text-prompt (Get-Content prompt_therapist.txt -Raw) `
  --input-wav "assets/test/input_assistant.wav" `
  --seed 42424242 `
  --output-wav "output.wav" `
  --output-text "output.json"
```

Play `output.wav` to judge quality and style. Voice options (from the repo) include NATF0–3, NATM0–3, VARF0–4, VARM0–4 (see [README](https://github.com/NVIDIA/personaplex#voices)).

---

## Do / Don’t

| Do | Don’t |
|----|--------|
| Run PersonaPlex in its own venv and folder | Use the MindEase backend venv or modify MindEase TTS/voice code |
| Test via terminal (server or offline script) | Wire PersonaPlex into the app until you’re happy with it |
| Use HF_TOKEN only in the experiment terminal | Commit or hardcode HF_TOKEN |
| Try different `--voice-prompt` and `--text-prompt` values | Change anything under `backend/tts/` or the voice-chat UI for this experiment |

---

## If You Like It Later

After you’re satisfied with quality and latency in the terminal:

- We can design integration options, e.g.:
  - A separate “PersonaPlex mode” in the app (separate route or toggle), or
  - Replacing the current voice chat path (STT → Chat API → TTS) with a single PersonaPlex speech-to-speech call (different architecture).
- Until then, MindEase voice chat and XTTS remain unchanged.
