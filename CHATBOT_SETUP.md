# MindEase Chatbot Setup Guide

## Quick Start

### 1. Install Dependencies

```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows PowerShell
# or
source venv/bin/activate  # Linux/Mac

pip install -r requirements.txt
```

### 2. Setup Ollama

1. **Download Ollama**: Visit https://ollama.ai/download and install
2. **Start Ollama Service**:
   ```bash
   ollama serve
   ```
   Keep this terminal window open.

3. **Download Llama Model** (in a new terminal):
   ```bash
   ollama pull llama3.1:8b-instruct
   ```
   
   Note: If the model name doesn't match, update `backend/chatbot/llm_client.py` line 13 with your model name.

### 3. Run the Chatbot

From the **project root** (MindEase folder):

```bash
cd backend
python -m chatbot.chatbot_terminal
```

Or use the convenience script:

**Windows:**
```bash
backend\chatbot\run_chatbot.bat
```

**Linux/Mac:**
```bash
chmod +x backend/chatbot/run_chatbot.sh
./backend/chatbot/run_chatbot.sh
```

## What Was Created

### Module Structure

```
backend/chatbot/
├── __init__.py              # Module init
├── emotion_detector.py      # DeBERTa emotion detection
├── rag_system.py           # RAG with hierarchical retrieval
├── llm_client.py           # Ollama LLM integration
├── chatbot_terminal.py     # Main terminal chatbot
├── README.md               # Detailed documentation
├── run_chatbot.bat         # Windows run script
└── run_chatbot.sh          # Linux/Mac run script
```

### How It Works

1. **User Input** → User types a message
2. **Emotion Detection** → DeBERTa analyzes and detects top 2 emotions (threshold: 0.3)
3. **RAG Retrieval** → Searches MentalChat16K dataset for similar contexts (top 3, similarity ≥ 0.5)
4. **LLM Generation** → Llama 3.1 8B generates empathetic therapist response
5. **Display** → Response shown to user

### First Run

- **First run** will build the vector database from `dataset/MentalChat16K.csv`
- This may take **5-10 minutes** depending on your CPU
- The database is persisted in `backend/chatbot/chroma_db/`
- Subsequent runs will load the existing database instantly

## Troubleshooting

### Model Not Found Errors

**DeBERTa Model:**
- Ensure `deberta_best/` folder exists in project root
- Check that it contains: `config.json`, `model.safetensors`, `tokenizer.json`, etc.

**Dataset:**
- Ensure `dataset/MentalChat16K.csv` exists in project root
- Verify the CSV has columns: `instruction`, `input`, `output`

### Ollama Issues

**Connection Error:**
```bash
# Make sure Ollama is running
ollama serve

# Check if model is downloaded
ollama list

# If model name is different, update llm_client.py line 13
```

**Model Not Found:**
- Download: `ollama pull llama3.1:8b-instruct`
- Or use quantized: `ollama pull llama3.1:8b-instruct-q4_K_M`
- Update `llm_client.py` with correct model name

### Import Errors

- Make sure virtual environment is activated
- Install dependencies: `pip install -r requirements.txt`
- Run from project root or adjust paths

### ChromaDB Issues

- If vector database is corrupted, delete `backend/chatbot/chroma_db/` folder
- Restart the chatbot to rebuild the database

## Configuration

### Adjust Emotion Detection

In `chatbot_terminal.py`, line 39-42:
```python
emotions = self.emotion_detector.detect_emotions(
    user_input, 
    top_k=2,           # Number of emotions
    threshold=0.3      # Minimum probability
)
```

### Adjust RAG Retrieval

In `chatbot_terminal.py`, line 45-49:
```python
rag_contexts = self.rag_system.retrieve_context(
    query=user_input,
    top_k=3,                    # Number of contexts
    similarity_threshold=0.5    # Minimum similarity
)
```

### Adjust LLM Settings

In `llm_client.py`, line 60-64:
```python
options={
    "temperature": 0.7,  # 0.0-1.0 (lower = more focused)
    "top_p": 0.9,        # Nucleus sampling
    "top_k": 40,         # Top-k sampling
}
```

## Next Steps

### For Frontend Integration

1. Create Django API endpoints in `backend/api/views.py`
2. Import chatbot modules
3. Handle HTTP requests
4. Return JSON responses
5. Connect to frontend chat UI

### For PostgreSQL Migration

1. Install pgvector extension
2. Create tables for embeddings
3. Modify `rag_system.py` to use PostgreSQL instead of ChromaDB
4. Update chunk storage to use PostgreSQL

## Files Modified

- ✅ `backend/requirements.txt` - Added ML dependencies
- ✅ `backend/chatbot/` - Created complete chatbot module
- ✅ `.gitignore` - Added chroma_db and model files

## Notes

- Chatbot runs independently from Django (doesn't interfere with existing code)
- Vector database is built locally (not committed to git)
- First run requires all dependencies installed and Ollama running
- Conversation history maintained in-memory (last 20 messages)

## Support

If you encounter issues:
1. Check all dependencies are installed
2. Verify Ollama is running
3. Ensure model paths are correct
4. Check dataset exists and is valid
5. Review error messages for specific issues

---

**Happy Chatting! 💙**

