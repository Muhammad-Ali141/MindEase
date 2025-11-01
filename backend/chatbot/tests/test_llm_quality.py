"""
Phase 5: LLM Response Quality Testing
Tests LLM response quality, format, and context integration
"""
import os
import sys
import re
from typing import List, Dict

# Add backend directory to Python path
current_file = os.path.abspath(__file__)
backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(current_file)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from chatbot.emotion_detector import EmotionDetector
from chatbot.rag_system_postgres import RAGSystem
from chatbot.llm_client import LLMClient
from chatbot.conversation_memory import ConversationMemory

# Import configuration
from chatbot.config import DB_CONFIG


def test_response_format_validation():
    """
    Test 5.1: Response Format Validation
    Verify LLM responses are well-formatted and appropriate
    """
    print("\n" + "=" * 80)
    print("Phase 5.1: Response Format Validation")
    print("=" * 80)
    
    # Initialize components
    print("\n[INIT] Initializing components...")
    emotion_detector = EmotionDetector()
    rag_system = RAGSystem(db_config=DB_CONFIG)
    memory = ConversationMemory(max_history_length=20)
    
    # Initialize LLM client
    try:
        llm_client = LLMClient()
        if not llm_client.model_name:
            print("[SKIP] LLM model not available. Skipping LLM quality tests.")
            print("[INFO] Please ensure Ollama is running and model is downloaded.")
            return False
        print(f"[OK] LLM client initialized with model: {llm_client.model_name}")
    except Exception as e:
        print(f"[SKIP] LLM client not available: {e}")
        print("[INFO] Please ensure Ollama is running: ollama serve")
        return False
    
    # Test queries with expected characteristics
    test_cases = [
        {
            "query": "I'm feeling anxious about my exam tomorrow",
            "expected_emotions": ["anxiety", "nervousness", "worry"],
            "should_have_context": True
        },
        {
            "query": "I've been feeling really down and hopeless lately",
            "expected_emotions": ["sadness", "depression", "hopelessness"],
            "should_have_context": True
        },
        {
            "query": "My relationship with my partner is causing me stress",
            "expected_emotions": ["stress", "anxiety", "worry"],
            "should_have_context": True
        },
        {
            "query": "I can't sleep because I'm worried about work",
            "expected_emotions": ["worry", "anxiety", "stress"],
            "should_have_context": True
        }
    ]
    
    results = []
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n[TEST {i}/{len(test_cases)}] Testing: \"{test_case['query']}\"")
        print("-" * 80)
        
        # Step 1: Emotion Detection
        try:
            emotions = emotion_detector.detect_emotions(
                test_case['query'], 
                top_k=2, 
                threshold=0.3
            )
            emotions_str = emotion_detector.format_emotions_for_llm(emotions)
            print(f"[OK] Emotions detected: {len(emotions)} emotion(s)")
            for emotion, prob in emotions:
                print(f"      • {emotion}: {prob:.3f}")
        except Exception as e:
            print(f"[FAIL] Emotion detection failed: {e}")
            emotions = []
            emotions_str = ""
        
        # Step 2: RAG Retrieval
        try:
            contexts = rag_system.retrieve_context(
                query=test_case['query'],
                top_k=3,
                similarity_threshold=0.5
            )
            context_str = rag_system.format_context_for_llm(contexts) if contexts else ""
            print(f"[OK] RAG retrieval: {len(contexts)} context(s) retrieved")
        except Exception as e:
            print(f"[FAIL] RAG retrieval failed: {e}")
            contexts = []
            context_str = ""
        
        # Step 3: Generate LLM Response
        try:
            conversation_history = memory.get_history_with_context()
            response = llm_client.generate_response(
                user_message=test_case['query'],
                emotions=emotions_str,
                context=context_str,
                conversation_history=conversation_history
            )
            
            # Update memory
            memory.add_exchange(test_case['query'], response)
            
            print(f"[OK] LLM response generated ({len(response)} characters)")
            
            # Validate response
            validation_results = validate_response_format(
                response, 
                test_case['query'], 
                emotions,
                test_case['expected_emotions']
            )
            
            results.append({
                'query': test_case['query'],
                'response': response,
                'validation': validation_results
            })
            
            print("\n[VALIDATION RESULTS]")
            for check, status in validation_results.items():
                icon = "[OK]" if status else "[FAIL]"
                print(f"      {icon} {check}: {status}")
            
        except Exception as e:
            print(f"[FAIL] LLM response generation failed: {e}")
            import traceback
            traceback.print_exc()
            results.append({
                'query': test_case['query'],
                'response': None,
                'validation': {'error': str(e)}
            })
    
    # Summary
    print("\n" + "=" * 80)
    print("Phase 5.1 Summary")
    print("=" * 80)
    
    successful_tests = sum(1 for r in results if r['response'] and all(
        v for k, v in r['validation'].items() if k != 'length_words'
    ))
    
    print(f"\n[OK] Successful tests: {successful_tests}/{len(test_cases)}")
    
    if successful_tests == len(test_cases):
        print("\n[RESULT] [OK] All response format validation tests PASSED")
        return True
    else:
        print(f"\n[RESULT] [WARN] {len(test_cases) - successful_tests} test(s) had issues")
        return False


def validate_response_format(
    response: str, 
    query: str, 
    detected_emotions: List[tuple],
    expected_emotions: List[str]
) -> Dict[str, bool]:
    """
    Validate LLM response format and quality
    
    Returns:
        Dictionary of validation checks and their results
    """
    validation = {}
    
    # Check 1: Non-empty response
    validation['non_empty'] = len(response.strip()) > 0
    
    # Check 2: Length check (50-500 words)
    words = len(response.split())
    validation['length_appropriate'] = 50 <= words <= 500
    validation['length_words'] = words
    
    # Check 3: Therapist-like tone (empathetic keywords)
    empathetic_keywords = [
        'understand', 'feel', 'emotion', 'support', 'help', 
        'difficult', 'challenging', 'acknowledge', 'validate',
        'there for you', 'you\'re not alone', 'it\'s okay'
    ]
    response_lower = response.lower()
    has_empathetic_tone = any(keyword in response_lower for keyword in empathetic_keywords)
    validation['empathetic_tone'] = has_empathetic_tone
    
    # Check 4: References emotions if detected
    if detected_emotions:
        emotion_names = [e[0] for e in detected_emotions]
        response_lower = response.lower()
        references_emotions = any(emotion.lower() in response_lower for emotion in emotion_names)
        validation['references_emotions'] = references_emotions
    else:
        validation['references_emotions'] = True  # N/A if no emotions
    
    # Check 5: Coherent structure (sentences with periods, question marks, etc.)
    has_ending_punctuation = any(p in response for p in ['.', '!', '?'])
    has_multiple_sentences = response.count('.') + response.count('!') + response.count('?') >= 1
    validation['coherent_structure'] = has_ending_punctuation and has_multiple_sentences
    
    # Check 6: Relevant to query (mentions some keywords from query)
    query_keywords = set(re.findall(r'\b\w+\b', query.lower()))
    # Remove common words
    common_words = {'i', 'am', 'is', 'are', 'the', 'a', 'an', 'and', 'or', 'but', 'my', 'me', 'about', 'been'}
    query_keywords = query_keywords - common_words
    response_lower_words = set(re.findall(r'\b\w+\b', response.lower()))
    has_query_relevance = len(query_keywords & response_lower_words) > 0
    validation['relevant_to_query'] = has_query_relevance
    
    # Check 7: No excessive repetition (same phrase more than 3 times)
    words_list = response.lower().split()
    word_counts = {}
    for word in words_list:
        if len(word) > 4:  # Only check meaningful words
            word_counts[word] = word_counts.get(word, 0) + 1
    max_repetition = max(word_counts.values()) if word_counts else 0
    validation['no_excessive_repetition'] = max_repetition <= 5
    
    return validation


def test_context_integration():
    """
    Test 5.2: Context Integration Test
    Verify LLM uses retrieved context appropriately
    """
    print("\n" + "=" * 80)
    print("Phase 5.2: Context Integration Test")
    print("=" * 80)
    
    # Initialize components
    print("\n[INIT] Initializing components...")
    emotion_detector = EmotionDetector()
    rag_system = RAGSystem(db_config=DB_CONFIG)
    memory = ConversationMemory(max_history_length=20)
    
    # Initialize LLM client
    try:
        llm_client = LLMClient()
        if not llm_client.model_name:
            print("[SKIP] LLM model not available. Skipping context integration tests.")
            print("[INFO] Please ensure Ollama is running and model is downloaded.")
            return False
        print(f"[OK] LLM client initialized with model: {llm_client.model_name}")
    except Exception as e:
        print(f"[SKIP] LLM client not available: {e}")
        print("[INFO] Please ensure Ollama is running: ollama serve")
        return False
    
    # Test queries designed to retrieve specific contexts
    test_cases = [
        {
            "query": "I'm really anxious about my upcoming exam",
            "context_keywords": ["exam", "test", "study", "anxiety", "nervous"],
            "should_incorporate_context": True
        },
        {
            "query": "My relationship with my partner is causing me stress",
            "context_keywords": ["relationship", "partner", "stress", "communication"],
            "should_incorporate_context": True
        },
        {
            "query": "I've been having trouble sleeping because I'm worried",
            "context_keywords": ["sleep", "worry", "insomnia", "anxiety", "rest"],
            "should_incorporate_context": True
        }
    ]
    
    results = []
    
    for i, test_case in enumerate(test_cases, 1):
        print(f"\n[TEST {i}/{len(test_cases)}] Testing: \"{test_case['query']}\"")
        print("-" * 80)
        
        # Step 1: Emotion Detection
        try:
            emotions = emotion_detector.detect_emotions(
                test_case['query'], 
                top_k=2, 
                threshold=0.3
            )
            emotions_str = emotion_detector.format_emotions_for_llm(emotions)
            print(f"[OK] Emotions detected: {len(emotions)} emotion(s)")
        except Exception as e:
            print(f"[FAIL] Emotion detection failed: {e}")
            emotions = []
            emotions_str = ""
        
        # Step 2: RAG Retrieval
        try:
            contexts = rag_system.retrieve_context(
                query=test_case['query'],
                top_k=3,
                similarity_threshold=0.5
            )
            context_str = rag_system.format_context_for_llm(contexts) if contexts else ""
            
            if contexts:
                print(f"[OK] Retrieved {len(contexts)} context(s)")
                print(f"[INFO] Context preview (first 100 chars): {context_str[:100]}...")
            else:
                print("[INFO] No contexts retrieved (similarity below threshold)")
            
        except Exception as e:
            print(f"[FAIL] RAG retrieval failed: {e}")
            contexts = []
            context_str = ""
        
        # Step 3: Generate LLM Response
        try:
            conversation_history = memory.get_history_with_context()
            
            # Generate response WITH context
            response_with_context = llm_client.generate_response(
                user_message=test_case['query'],
                emotions=emotions_str,
                context=context_str,
                conversation_history=conversation_history
            )
            
            # Generate response WITHOUT context (for comparison)
            response_without_context = llm_client.generate_response(
                user_message=test_case['query'],
                emotions=emotions_str,
                context="",  # No context
                conversation_history=[]
            )
            
            print(f"[OK] Generated responses:")
            print(f"      • With context: {len(response_with_context)} chars")
            print(f"      • Without context: {len(response_without_context)} chars")
            
            # Validate context integration
            integration_results = validate_context_integration(
                response_with_context,
                response_without_context,
                contexts,
                test_case['context_keywords']
            )
            
            results.append({
                'query': test_case['query'],
                'contexts_count': len(contexts),
                'integration': integration_results
            })
            
            print("\n[INTEGRATION VALIDATION]")
            for check, status in integration_results.items():
                icon = "[OK]" if status else "[FAIL]"
                print(f"      {icon} {check}: {status}")
            
            # Update memory with context version
            memory.add_exchange(test_case['query'], response_with_context)
            
        except Exception as e:
            print(f"[FAIL] LLM response generation failed: {e}")
            import traceback
            traceback.print_exc()
            results.append({
                'query': test_case['query'],
                'contexts_count': len(contexts) if contexts else 0,
                'integration': {'error': str(e)}
            })
    
    # Summary
    print("\n" + "=" * 80)
    print("Phase 5.2 Summary")
    print("=" * 80)
    
    successful_tests = sum(1 for r in results if 'error' not in r['integration'] and all(
        v for k, v in r['integration'].items() if isinstance(v, bool)
    ))
    
    print(f"\n[OK] Successful tests: {successful_tests}/{len(test_cases)}")
    
    if successful_tests == len(test_cases):
        print("\n[RESULT] [OK] All context integration tests PASSED")
        return True
    else:
        print(f"\n[RESULT] [WARN] {len(test_cases) - successful_tests} test(s) had issues")
        return False


def validate_context_integration(
    response_with_context: str,
    response_without_context: str,
    contexts: List[Dict],
    context_keywords: List[str]
) -> Dict[str, bool]:
    """
    Validate that LLM appropriately uses retrieved context
    
    Returns:
        Dictionary of validation checks and their results
    """
    validation = {}
    
    # Check 1: Context is incorporated (response is different from no-context version)
    responses_different = response_with_context != response_without_context
    validation['context_influences_response'] = responses_different
    
    # Check 2: Response doesn't directly copy context (not verbatim copy)
    if contexts:
        context_text = ' '.join([ctx['output_chunk'] for ctx in contexts])
        # Check if response contains large verbatim chunks from context (more than 20 words)
        response_words = response_with_context.lower().split()
        context_words = context_text.lower().split()
        
        # Check for verbatim copying (sequences of 20+ consecutive words)
        is_verbatim = False
        for i in range(len(response_words) - 20):
            chunk = ' '.join(response_words[i:i+20])
            if chunk in context_text.lower():
                is_verbatim = True
                break
        
        validation['not_verbatim_copy'] = not is_verbatim
    else:
        validation['not_verbatim_copy'] = True  # N/A if no context
    
    # Check 3: Context keywords appear in response (natural integration)
    if contexts:
        response_lower = response_with_context.lower()
        keyword_matches = sum(1 for keyword in context_keywords if keyword.lower() in response_lower)
        validation['incorporates_context_themes'] = keyword_matches > 0
    else:
        validation['incorporates_context_themes'] = True  # N/A if no context
    
    # Check 4: Response style matches context style (therapeutic, empathetic)
    if contexts:
        # Check if response maintains therapeutic tone
        therapeutic_keywords = ['understand', 'support', 'help', 'feel', 'emotion', 'care']
        response_has_therapeutic_tone = any(kw in response_with_context.lower() for kw in therapeutic_keywords)
        validation['maintains_therapeutic_tone'] = response_has_therapeutic_tone
    else:
        validation['maintains_therapeutic_tone'] = True  # N/A if no context
    
    return validation


if __name__ == "__main__":
    print("\n" + "=" * 80)
    print("Phase 5: LLM Response Quality Testing")
    print("=" * 80)
    
    try:
        # Test 5.1: Response Format Validation
        test_5_1_passed = test_response_format_validation()
        
        # Test 5.2: Context Integration Test
        test_5_2_passed = test_context_integration()
        
        # Final Summary
        print("\n" + "=" * 80)
        print("Phase 5: Final Summary")
        print("=" * 80)
        
        print(f"\n[OK] Test 5.1 (Response Format): {'PASSED' if test_5_1_passed else 'FAILED'}")
        print(f"[OK] Test 5.2 (Context Integration): {'PASSED' if test_5_2_passed else 'FAILED'}")
        
        if test_5_1_passed and test_5_2_passed:
            print("\n[SUCCESS] Phase 5: ALL TESTS PASSED")
            sys.exit(0)
        else:
            print("\n[WARN] Phase 5: Some tests had issues")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n\n[INFO] Testing interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n[ERROR] Fatal error during testing: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

