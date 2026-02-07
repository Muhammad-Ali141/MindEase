"""
Qwen3-TTS experiment: generate a WAV from text using CustomVoice (no reference audio).
Run from experiments/qwen3-tts with the venv activated. Does not touch MindEase backend/tts.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate speech from text with Qwen3-TTS (CustomVoice).")
    parser.add_argument(
        "--text",
        type=str,
        default="Hello. I'm here to listen. How are you feeling today?",
        help="Text to synthesize.",
    )
    parser.add_argument(
        "--speaker",
        type=str,
        default="Serena",
        choices=["Vivian", "Serena", "Uncle_Fu", "Dylan", "Eric", "Ryan", "Aiden", "Ono_Anna", "Sohee"],
        help="CustomVoice speaker name.",
    )
    parser.add_argument(
        "--language",
        type=str,
        default="English",
        help="Language (e.g. English, Chinese, Japanese, Korean, German, French, Spanish, Italian, Portuguese, Russian).",
    )
    parser.add_argument(
        "--instruct",
        type=str,
        default="",
        help="Optional instruction for tone/emotion (e.g. 'Speak in a calm, supportive tone').",
    )
    parser.add_argument(
        "--out",
        type=str,
        default="output_qwen3_tts.wav",
        help="Output WAV path.",
    )
    parser.add_argument(
        "--model",
        type=str,
        default="1.7B",
        choices=["0.6B", "1.7B"],
        help="Model size: 0.6B (faster, less VRAM) or 1.7B (higher quality).",
    )
    args = parser.parse_args()

    try:
        import torch
        import soundfile as sf
        from qwen_tts import Qwen3TTSModel
    except ImportError as e:
        print("Missing dependency. Install with: pip install -r requirements.txt", file=sys.stderr)
        raise SystemExit(1) from e

    model_id = (
        "Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice"
        if args.model == "0.6B"
        else "Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice"
    )
    device = "cuda" if torch.cuda.is_available() else "cpu"
    dtype = torch.bfloat16 if (device == "cuda" and torch.cuda.is_bf16_supported()) else torch.float16
    device_map = "cuda:0" if device == "cuda" else "cpu"

    print(f"Loading {model_id} on {device_map} (dtype={dtype})...")
    load_kwargs: dict = {
        "device_map": device_map,
        "torch_dtype": dtype,
    }
    # Use FlashAttention 2 if installed (saves VRAM)
    try:
        import flash_attn  # noqa: F401
        load_kwargs["attn_implementation"] = "flash_attention_2"
    except ImportError:
        pass
    model = Qwen3TTSModel.from_pretrained(model_id, **load_kwargs)

    print(f"Generating: \"{args.text[:60]}{'...' if len(args.text) > 60 else ''}\"")
    wavs, sr = model.generate_custom_voice(
        text=args.text,
        language=args.language,
        speaker=args.speaker,
        instruct=args.instruct or None,
    )

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(out_path), wavs[0], sr)
    print(f"Saved: {out_path.resolve()}")


if __name__ == "__main__":
    main()
