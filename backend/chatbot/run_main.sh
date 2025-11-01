#!/bin/bash
# Run MindEase Chatbot Main Script
# This script runs the main.py with verbose debugging output

cd "$(dirname "$0")/../.."

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    source venv/bin/activate
fi

echo "Running MindEase Chatbot (main.py)..."
echo ""

python backend/chatbot/main.py

