# CUDA + cuDNN setup for Windows (RTX 4070)

Your RTX 4070 is fully supported by **CUDA 12** and **cuDNN 9**. These steps fix the errors:

- `Could not locate cudnn_ops64_9.dll`
- `Invalid handle. Cannot load symbol cudnnCreateTensorDescriptor`

---

## Option A: cuDNN via pip (recommended, no system install)

The backend `requirements.txt` includes **nvidia-cudnn-cu12**, which provides the cuDNN 9 DLLs inside your Python environment. After installing dependencies, the DLL is found automatically.

```powershell
cd backend
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

If you already have the venv and only need cuDNN:

```powershell
pip install "nvidia-cudnn-cu12>=9.9.0"
```

Restart the Django server and try the voice/TTS endpoints again.

---

## Option B: Install CUDA Toolkit + cuDNN (full GPU stack)

Use this if you need the full CUDA Toolkit (e.g. for other dev tools or building from source).

### 1. Install CUDA Toolkit 12.x

- **Download:** [NVIDIA CUDA Toolkit](https://developer.nvidia.com/cuda-downloads)
- Choose: **Windows → x86_64 → your OS version** (e.g. 10 or 11)
- Install **CUDA 12.1** or **12.4** (both work with RTX 4070)
- Default install path: `C:\Program Files\NVIDIA GPU Computing Toolkit\CUDA\v12.x`
- After install, reboot if prompted.

### 2. Install cuDNN 9 for CUDA 12

- **Download:** [NVIDIA cuDNN](https://developer.nvidia.com/cudnn) (create a free NVIDIA Developer account if needed)
- Select **cuDNN 9.x for CUDA 12**, **Windows**, **x86_64**
- Either:
  - **Graphical installer:** run the `.exe` and choose CUDA 12 when asked, or
  - **Zip (tarball):** extract and copy:
    - `bin\cudnn*.dll` → `C:\Program Files\NVIDIA\CUDNN\v9.x\bin`
    - `include\cudnn*.h` → `C:\Program Files\NVIDIA\CUDNN\v9.x\include`
    - `lib\x64\cudnn*.lib` → `C:\Program Files\NVIDIA\CUDNN\v9.x\lib`

### 3. Add cuDNN to PATH (tarball install only)

1. Press **Win + R**, type `sysdm.cpl`, Enter  
2. **Advanced** tab → **Environment Variables**  
3. Under **System variables**, select **Path** → **Edit** → **New**  
4. Add: `C:\Program Files\NVIDIA\CUDNN\v9.x\bin` (use your actual path)  
5. OK all dialogs. **Restart the terminal** (and Django server) so PATH is updated.

### 4. Verify

In a **new** PowerShell:

```powershell
nvidia-smi
```

You should see your RTX 4070 and the CUDA version. Then start the backend and test TTS/voice again.

---

## PyTorch (already in requirements)

The project uses **PyTorch 2.3.1 with CUDA 12.1**:

```text
torch==2.3.1
torchvision==0.18.1
```

If you installed from the PyTorch index:

```powershell
pip install torch==2.3.1 torchvision==0.18.1 --index-url https://download.pytorch.org/whl/cu121
```

That build works with RTX 4070 and expects cuDNN 8 or 9; **nvidia-cudnn-cu12** (Option A) provides the required DLLs.

---

## Forcing TTS/STT to use CUDA or CPU

TTS and STT auto-detect CUDA. To override (e.g. force GPU or force CPU), set:

- **`MINDEASE_TTS_DEVICE`** — `cuda` or `cpu` (TTS)
- **`MINDEASE_STT_DEVICE`** — `cuda` or `cpu` (STT)

Example (PowerShell, before starting the server):

```powershell
$env:MINDEASE_TTS_DEVICE = "cuda"
$env:MINDEASE_STT_DEVICE = "cuda"
python manage.py runserver
```

When CUDA is used, the server log will show e.g. `TTS using CUDA (GPU acceleration)` and `STT using CUDA (GPU acceleration)`.
