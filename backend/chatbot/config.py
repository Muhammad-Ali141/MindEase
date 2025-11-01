"""
Configuration file for MindEase Chatbot
Loads settings from environment variables with defaults
"""
import os
from typing import Dict

# Try to load from .env file if python-dotenv is available
try:
    from dotenv import load_dotenv
    # Try loading .env from chatbot directory first, then parent directories
    current_dir = os.path.dirname(__file__)
    env_path = os.path.join(current_dir, '.env')
    
    if os.path.exists(env_path):
        load_dotenv(env_path)
    else:
        # Try parent directories
        parent_env = os.path.join(os.path.dirname(current_dir), '.env')
        if os.path.exists(parent_env):
            load_dotenv(parent_env)
        else:
            root_env = os.path.join(os.path.dirname(os.path.dirname(current_dir)), '.env')
            if os.path.exists(root_env):
                load_dotenv(root_env)
except ImportError:
    pass  # python-dotenv not installed, use environment variables only
except Exception as e:
    # Silently fail if .env doesn't exist
    pass

# Database configuration
# Load from environment variables or use defaults
# Default password 'pakistan' for local development - change via .env file
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': int(os.getenv('DB_PORT', '5432')),
    'database': os.getenv('DB_NAME', 'mentalhealthdb'),
    'user': os.getenv('DB_USER', 'postgres'),
    'password': os.getenv('DB_PASSWORD', 'pakistan')  # Local default
}

# Model paths
DEBERTA_MODEL_PATH = os.getenv('DEBERTA_MODEL_PATH', os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    'deberta_best'
))

DATASET_PATH = os.getenv('DATASET_PATH', os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
    'dataset',
    'MentalChat16K.csv'
))

# Ollama configuration
OLLAMA_MODEL = os.getenv('OLLAMA_MODEL', 'llama3.1:8b-instruct')

# RAG configuration
RAG_CONFIG = {
    'embedding_model': 'sentence-transformers/all-MiniLM-L6-v2',
    'chunk_size': 512,
    'chunk_overlap': 50,
    'top_k': 3,
    'similarity_threshold': 0.5
}

# Emotion detection configuration
EMOTION_CONFIG = {
    'top_k': 2,
    'threshold': 0.3
}

