@echo off
REM Run MindEase Chatbot Main Script
REM This script runs the main.py with verbose debugging output

cd /d %~dp0\..\..
call venv\Scripts\activate.bat

echo Running MindEase Chatbot (main.py)...
echo.
python backend\chatbot\main.py

pause

