"""
Emotion Detection Module using Fine-tuned DeBERTa
"""
import os
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import numpy as np
from typing import List, Tuple, Dict

# Emotion labels from GoEmotions dataset (27 emotions + neutral)
EMOTION_LABELS = [
    "admiration", "amusement", "anger", "annoyance", "approval", "caring",
    "confusion", "curiosity", "desire", "disappointment", "disapproval",
    "disgust", "embarrassment", "excitement", "fear", "gratitude", "grief",
    "joy", "love", "nervousness", "optimism", "pride", "realization",
    "relief", "remorse", "sadness", "surprise", "neutral"
]


class EmotionDetector:
    """Detects emotions from user text using fine-tuned DeBERTa model"""
    
    def __init__(self, model_path: str = None, device: str = None):
        """
        Initialize emotion detector
        
        Args:
            model_path: Path to fine-tuned DeBERTa model (default: deberta_best/)
            device: Device to run on ('cuda', 'cpu', or None for auto)
        """
        if model_path is None:
            # Get project root (assuming this is in backend/chatbot/)
            current_file = os.path.abspath(__file__)
            # Go up: chatbot -> backend -> project_root
            project_root = os.path.dirname(os.path.dirname(os.path.dirname(current_file)))
            model_path = os.path.join(project_root, "deberta_best")
            
            # Alternative: check if deberta_best is in current directory or one level up
            if not os.path.exists(model_path):
                # Try current working directory
                cwd_deberta = os.path.join(os.getcwd(), "deberta_best")
                if os.path.exists(cwd_deberta):
                    model_path = cwd_deberta
                else:
                    # Try parent of cwd
                    parent_deberta = os.path.join(os.path.dirname(os.getcwd()), "deberta_best")
                    if os.path.exists(parent_deberta):
                        model_path = parent_deberta
        
        self.device = device if device else ("cuda" if torch.cuda.is_available() else "cpu")
        self.model_path = model_path
        
        print(f"Loading emotion detection model from {model_path}...")
        print(f"Using device: {self.device}")
        
        # Load tokenizer with use_fast=False to avoid tokenizers lib format issues
        # (local tokenizer.json may use an older format incompatible with tokenizers >=0.15)
        self.tokenizer = AutoTokenizer.from_pretrained(model_path, use_fast=False)
        self.model = AutoModelForSequenceClassification.from_pretrained(model_path)
        self.model.to(self.device)
        self.model.eval()
        
        print("Emotion detection model loaded successfully!")
    
    def detect_emotions(
        self, 
        text: str, 
        top_k: int = 2, 
        threshold: float = 0.3
    ) -> List[Tuple[str, float]]:
        """
        Detect emotions from text
        
        Args:
            text: Input text to analyze
            top_k: Number of top emotions to return
            threshold: Minimum probability threshold
            
        Returns:
            List of (emotion, probability) tuples
        """
        # Tokenize and encode
        inputs = self.tokenizer(
            text,
            truncation=True,
            padding=True,
            max_length=512,
            return_tensors="pt"
        ).to(self.device)
        
        # Get model predictions
        with torch.no_grad():
            outputs = self.model(**inputs)
            logits = outputs.logits
            probabilities = torch.sigmoid(logits).cpu().numpy()[0]
        
        # Get emotion probabilities with labels
        emotion_probs = [
            (EMOTION_LABELS[i], float(prob)) 
            for i, prob in enumerate(probabilities)
        ]
        
        # Filter by threshold and sort
        filtered_emotions = [
            (emotion, prob) 
            for emotion, prob in emotion_probs 
            if prob >= threshold
        ]
        filtered_emotions.sort(key=lambda x: x[1], reverse=True)
        
        # Return top_k emotions
        top_emotions = filtered_emotions[:top_k]
        
        return top_emotions if top_emotions else [("neutral", 1.0)]
    
    def format_emotions_for_llm(self, emotions: List[Tuple[str, float]]) -> str:
        """
        Format detected emotions as a string for LLM prompt
        
        Args:
            emotions: List of (emotion, probability) tuples
            
        Returns:
            Formatted string describing emotions
        """
        if not emotions:
            return "No specific emotions detected."
        
        emotion_strs = [f"{emotion} ({prob:.2f})" for emotion, prob in emotions]
        return f"Detected emotions: {', '.join(emotion_strs)}"


if __name__ == "__main__":
    # Test the emotion detector
    detector = EmotionDetector()
    test_text = "I failed my exam again and I feel hopeless."
    emotions = detector.detect_emotions(test_text)
    print(f"\nInput: {test_text}")
    print(f"Detected emotions: {emotions}")
    print(f"Formatted: {detector.format_emotions_for_llm(emotions)}")

