#!/usr/bin/env python
import os
import sys

# Avoid OpenMP conflict when multiple libraries (PyTorch, NumPy, MKL) each ship libiomp5md
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

# Add nvidia-cudnn-cu12 DLLs to PATH so cudnn_ops64_9.dll is found (fixes cuDNN errors during TTS/STT)
for _p in sys.path:
    if isinstance(_p, str):
        _cudnn_bin = os.path.join(_p, "nvidia", "cudnn", "bin")
        if os.path.isdir(_cudnn_bin) and os.path.exists(os.path.join(_cudnn_bin, "cudnn_ops64_9.dll")):
            os.environ["PATH"] = _cudnn_bin + os.pathsep + os.environ.get("PATH", "")
            break
    _cudnn_bin = None

import subprocess
import platform
import time

def check_ollama_running():
    """Check if Ollama is really running by hitting its HTTP API (port check alone can be wrong)."""
    try:
        import urllib.request
        req = urllib.request.Request("http://127.0.0.1:11434/api/tags", method="GET")
        with urllib.request.urlopen(req, timeout=3) as resp:
            return resp.status == 200
    except Exception:
        return False

def start_ollama_if_needed():
    """Start Ollama serve if it's not already running."""
    # Only start Ollama if we're running the server
    if len(sys.argv) > 1 and sys.argv[1] == 'runserver':
        if check_ollama_running():
            print("Ollama is already running!")
            return None

        print("Starting Ollama server...")
        process = None
        try:
            if platform.system() == "Windows":
                # Use shell so PATH is respected (e.g. Ollama installed for current user)
                process = subprocess.Popen(
                    "ollama serve",
                    shell=True,
                    creationflags=subprocess.CREATE_NEW_CONSOLE,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    cwd=os.path.expanduser("~"),
                )
            else:
                process = subprocess.Popen(
                    ["ollama", "serve"],
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                    start_new_session=True,
                )
        except FileNotFoundError:
            print("Warning: 'ollama' not found in PATH. Install Ollama or start it manually: ollama serve")
            return None
        except Exception as e:
            print(f"Warning: Could not start Ollama: {e}. Start manually: ollama serve")
            return None

        print("Waiting for Ollama to initialize...")
        for i in range(10):
            time.sleep(1)
            if check_ollama_running():
                print("Ollama server started successfully!")
                return process
            print(f"   Still waiting... ({i+1}/10)")
        print("Warning: Ollama may not have started in time. Start manually if needed: ollama serve")
        return process

    return None

def main():
    """Run administrative tasks."""
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')
    
    # Start Ollama if running the server
    ollama_process = start_ollama_if_needed()
    
    try:
        from django.core.management import execute_from_command_line
    except ImportError as exc:
        raise ImportError(
            "Couldn't import Django. Are you sure it's installed and available on your PYTHONPATH environment variable? Did you forget to activate a virtual environment?"
        ) from exc
    execute_from_command_line(sys.argv)

if __name__ == '__main__':
    main()
