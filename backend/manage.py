#!/usr/bin/env python
import os
import sys
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
        
        # Determine the command based on OS
        if platform.system() == "Windows":
            # On Windows, start Ollama in a new window
            process = subprocess.Popen(
                ["ollama", "serve"],
                creationflags=subprocess.CREATE_NEW_CONSOLE,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
        else:
            # On Linux/Mac, start in background
            process = subprocess.Popen(
                ["ollama", "serve"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                start_new_session=True
            )
        
        # Wait a bit for Ollama to start
        print("Waiting for Ollama to initialize...")
        for i in range(10):  # Wait up to 10 seconds
            time.sleep(1)
            if check_ollama_running():
                print("Ollama server started successfully!")
                return process
            print(f"   Still waiting... ({i+1}/10)")
        
        print("Warning: Ollama may not have started properly. Continuing anyway...")
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
