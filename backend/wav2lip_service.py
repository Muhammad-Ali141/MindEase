"""
Wav2Lip inference server — FastAPI on port 8002
Optimised for low latency: fp16 inference, no seamless clone, fast unsharp sharpening.
"""

import os, sys, uuid, asyncio, subprocess, traceback
from pathlib import Path
from contextlib import asynccontextmanager
from concurrent.futures import ThreadPoolExecutor

import cv2
import numpy as np
import torch
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import Response

# ── ffmpeg ────────────────────────────────────────────────────────────────────
try:
    import imageio_ffmpeg
    FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()
except Exception:
    FFMPEG = "ffmpeg"

# ── paths ─────────────────────────────────────────────────────────────────────
BASE_DIR  = Path(__file__).parent
W2L_DIR   = BASE_DIR / "wav2lip"
CKPT      = W2L_DIR / "checkpoints" / "wav2lip_gan.pth"
FACE_IMG  = BASE_DIR.parent / "public" / "avatar.jpg"
TEMP_DIR  = BASE_DIR / "wav2lip" / "temp"
TEMP_DIR.mkdir(exist_ok=True)

sys.path.insert(0, str(W2L_DIR))
import audio as w2l_audio
import face_detection as fd
from models import Wav2Lip

device = "cuda" if torch.cuda.is_available() else "cpu"
USE_FP16 = device == "cuda"
print(f"[wav2lip] device={device}  fp16={USE_FP16}")

# ── globals ───────────────────────────────────────────────────────────────────
_w2l_model: Wav2Lip | None     = None
_face_det_results: list | None = None
_full_frame: np.ndarray | None = None
_executor = ThreadPoolExecutor(max_workers=1)

IMG_SIZE   = 96
MEL_STEP   = 16
FPS        = 20          # 20fps → 20% fewer frames vs 25fps
BATCH_SIZE = 128
MAX_DIM    = 720         # pre-resize avatar to max 720p — fewer pixels per frame
PADS       = [0, 10, 0, 0]


def _load_wav2lip():
    if not CKPT.exists():
        raise FileNotFoundError(f"Missing: {CKPT}")
    model = Wav2Lip()
    ckpt  = torch.load(str(CKPT), map_location=device, weights_only=False)
    model.load_state_dict({k.replace("module.", ""): v for k, v in ckpt["state_dict"].items()})
    model = model.to(device).eval()
    if USE_FP16:
        model = model.half()
    print("[wav2lip] model loaded (fp16={})".format(USE_FP16))
    return model


def _resize_to_max(img: np.ndarray, max_dim: int) -> np.ndarray:
    h, w = img.shape[:2]
    if max(h, w) <= max_dim:
        return img
    scale = max_dim / max(h, w)
    return cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)


def _detect_face(frame: np.ndarray) -> list:
    detector = fd.FaceAlignment(fd.LandmarksType._2D, flip_input=False, device=device)
    preds    = detector.get_detections_for_batch(np.array([frame]))
    del detector
    pady1, pady2, padx1, padx2 = PADS
    rect = preds[0]
    if rect is None:
        raise ValueError("No face detected in avatar image!")
    y1 = max(0, rect[1] - pady1)
    y2 = min(frame.shape[0], rect[3] + pady2)
    x1 = max(0, rect[0] - padx1)
    x2 = min(frame.shape[1], rect[2] + padx2)
    return [[frame[y1:y2, x1:x2], (y1, y2, x1, x2)]]


def _build_mouth_mask(h: int, w: int) -> np.ndarray:
    """
    Gradient alpha mask (H, W, 1) float32 in [0, 1].
    Top 45% of face → 0 (keep original sharp frame).
    45-60% → linear ramp (feathered blend boundary).
    Bottom 60% → 1 (wav2lip mouth output).
    """
    mask = np.zeros((h, w), dtype=np.float32)
    ramp_start = int(h * 0.45)
    ramp_end   = int(h * 0.60)
    ramp_len   = max(ramp_end - ramp_start, 1)
    mask[ramp_start:ramp_end] = np.linspace(0.0, 1.0, ramp_len, dtype=np.float32)[:, np.newaxis]
    mask[ramp_end:] = 1.0
    return mask[:, :, np.newaxis]   # (H, W, 1)


# Per-face-region mask cache (rebuilt when face region size changes)
_mouth_mask_cache: dict[tuple[int, int], np.ndarray] = {}


def _blend_mouth(original_crop: np.ndarray, wav2lip_crop: np.ndarray) -> np.ndarray:
    """Replace only the mouth region from wav2lip; keep upper face from original."""
    h, w = original_crop.shape[:2]
    key  = (h, w)
    if key not in _mouth_mask_cache:
        _mouth_mask_cache[key] = _build_mouth_mask(h, w)
    mask = _mouth_mask_cache[key]

    # Sharpen only the wav2lip portion before blending
    sharp = _sharpen(wav2lip_crop)
    blended = (sharp.astype(np.float32) * mask +
               original_crop.astype(np.float32) * (1.0 - mask))
    return blended.clip(0, 255).astype(np.uint8)


def _sharpen(img: np.ndarray) -> np.ndarray:
    blur = cv2.GaussianBlur(img, (0, 0), 2.0)
    return np.clip(cv2.addWeighted(img, 1.8, blur, -0.8, 0), 0, 255).astype(np.uint8)


def _run_inference(audio_path: str, out_path: str):
    assert _w2l_model is not None and _face_det_results is not None

    wav = w2l_audio.load_wav(audio_path, 16000)
    mel = w2l_audio.melspectrogram(wav)
    if np.isnan(mel.reshape(-1)).sum() > 0:
        raise ValueError("Mel contains NaN")

    mel_idx_mult = 80.0 / FPS
    mel_chunks   = []
    i = 0
    while True:
        start = int(i * mel_idx_mult)
        if start + MEL_STEP > mel.shape[1]:
            mel_chunks.append(mel[:, mel.shape[1] - MEL_STEP:])
            break
        mel_chunks.append(mel[:, start: start + MEL_STEP])
        i += 1

    frames = [_full_frame.copy()] * len(mel_chunks)

    avi_path = out_path.replace(".mp4", ".avi")
    h, w     = _full_frame.shape[:2]
    writer   = cv2.VideoWriter(avi_path, cv2.VideoWriter_fourcc(*"DIVX"), FPS, (w, h))

    face_crop, coords = _face_det_results[0]

    img_batch, mel_batch, frame_batch, coords_batch = [], [], [], []

    def _flush(ib, mb, fb, cb):
        ib = np.asarray(ib, dtype=np.float32)
        mb = np.asarray(mb, dtype=np.float32)
        masked = ib.copy(); masked[:, IMG_SIZE // 2:] = 0
        ib = np.concatenate((masked, ib), axis=3) / 255.0
        mb = mb.reshape(len(mb), mb.shape[1], mb.shape[2], 1)

        ib_t = torch.FloatTensor(np.transpose(ib, (0, 3, 1, 2))).to(device)
        mb_t = torch.FloatTensor(np.transpose(mb, (0, 3, 1, 2))).to(device)

        if USE_FP16:
            ib_t = ib_t.half(); mb_t = mb_t.half()

        with torch.no_grad():
            pred = _w2l_model(mb_t, ib_t)

        pred = pred.float().cpu().numpy().transpose(0, 2, 3, 1) * 255.0

        for p, f, c in zip(pred, fb, cb):
            y1, y2, x1, x2 = c
            p = cv2.resize(p.astype(np.uint8), (x2 - x1, y2 - y1))
            # Blend only mouth region — upper face stays sharp from original frame
            f[y1:y2, x1:x2] = _blend_mouth(f[y1:y2, x1:x2].copy(), p)
            writer.write(f)

    for idx, m in enumerate(mel_chunks):
        face = cv2.resize(face_crop, (IMG_SIZE, IMG_SIZE))
        img_batch.append(face)
        mel_batch.append(m)
        frame_batch.append(frames[idx].copy())
        coords_batch.append(coords)

        if len(img_batch) >= BATCH_SIZE or idx == len(mel_chunks) - 1:
            _flush(img_batch, mel_batch, frame_batch, coords_batch)
            img_batch, mel_batch, frame_batch, coords_batch = [], [], [], []

    writer.release()

    cmd = [
        FFMPEG, "-y",
        "-i", audio_path,
        "-i", avi_path,
        "-c:v", "libx264", "-preset", "ultrafast",
        "-c:a", "aac", "-strict", "-2",
        out_path,
    ]
    subprocess.run(cmd, check=True, capture_output=True)
    os.remove(avi_path)


@asynccontextmanager
async def lifespan(app: FastAPI):
    global _w2l_model, _face_det_results, _full_frame
    _w2l_model = _load_wav2lip()
    img = cv2.imread(str(FACE_IMG))
    if img is None:
        raise FileNotFoundError(f"Avatar image not found: {FACE_IMG}")
    img               = _resize_to_max(img, MAX_DIM)   # pre-resize once
    _full_frame       = img
    _face_det_results = _detect_face(img)
    print("[wav2lip] ready — avatar {}x{}".format(img.shape[1], img.shape[0]))
    yield


app = FastAPI(lifespan=lifespan)


@app.post("/wav2lip")
async def wav2lip_endpoint(audio: UploadFile = File(...)):
    job_id   = uuid.uuid4().hex
    tmp_dir  = TEMP_DIR / job_id
    tmp_dir.mkdir()
    in_ext   = Path(audio.filename or "audio.mp3").suffix or ".mp3"
    in_path  = str(tmp_dir / f"in{in_ext}")
    wav_path = str(tmp_dir / "audio.wav")
    out_path = str(tmp_dir / "out.mp4")

    try:
        with open(in_path, "wb") as f:
            f.write(await audio.read())

        subprocess.run(
            [FFMPEG, "-y", "-i", in_path, "-ar", "16000", "-ac", "1", wav_path],
            check=True, capture_output=True,
        )

        loop = asyncio.get_event_loop()
        await loop.run_in_executor(_executor, _run_inference, wav_path, out_path)

        with open(out_path, "rb") as f:
            video_bytes = f.read()

        return Response(content=video_bytes, media_type="video/mp4")

    except Exception as e:
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        import shutil
        shutil.rmtree(str(tmp_dir), ignore_errors=True)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("wav2lip_service:app", host="0.0.0.0", port=8002, reload=False)
