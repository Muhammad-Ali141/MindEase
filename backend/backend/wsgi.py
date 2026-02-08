"""
WSGI config for backend project.

It exposes the WSGI callable as a module-level variable named ``application``.
"""

import os
import sys

# Add nvidia-cudnn-cu12 DLLs to PATH so cudnn_ops64_9.dll is found (fixes cuDNN errors during TTS/STT)
for _p in sys.path:
    if isinstance(_p, str):
        _cudnn_bin = os.path.join(_p, "nvidia", "cudnn", "bin")
        if os.path.isdir(_cudnn_bin) and os.path.exists(os.path.join(_cudnn_bin, "cudnn_ops64_9.dll")):
            os.environ["PATH"] = _cudnn_bin + os.pathsep + os.environ.get("PATH", "")
            break

from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'backend.settings')

application = get_wsgi_application()
