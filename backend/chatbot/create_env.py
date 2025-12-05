"""Helper script to create .env file"""
import os

env_content = """# MindEase Chatbot Configuration

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=mentalhealthdb
DB_USER=postgres
DB_PASSWORD=Abcd1234

# Ollama Configuration
OLLAMA_MODEL=llama3.1:8b-instruct
"""

current_dir = os.path.dirname(__file__)
env_path = os.path.join(current_dir, '.env')

with open(env_path, 'w') as f:
    f.write(env_content)

print(f"[OK] Created .env file at: {env_path}")
print("\n[IMPORTANT] .env file contains your password!")
print("   Make sure it's in .gitignore (it already is)")

