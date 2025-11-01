@echo off
REM Run MindEase Clean Chat Interface (Windows)

echo Starting MindEase Chat...
echo.

cd /d %~dp0
cd ..\..

REM Activate virtual environment if it exists
if exist "backend\venv\Scripts\activate.bat" (
    call backend\venv\Scripts\activate.bat
) else if exist "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
)

REM Run clean chat
python -m chatbot.chat

pause

