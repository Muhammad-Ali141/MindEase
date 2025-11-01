#!/bin/bash

# Run MindEase Clean Chat Interface (Linux/macOS)

echo "Starting MindEase Chat..."
echo ""

# Navigate to the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR/../.."

# Activate virtual environment if it exists
if [ -f "backend/venv/bin/activate" ]; then
    source "backend/venv/bin/activate"
elif [ -f "venv/bin/activate" ]; then
    source "venv/bin/activate"
fi

# Run clean chat
python -m chatbot.chat

echo ""
echo "Press any key to continue..."
read -n 1 -s

