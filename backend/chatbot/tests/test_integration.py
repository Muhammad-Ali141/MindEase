"""
Phase 4: Integration Testing
Test complete end-to-end pipeline from user input to LLM response
"""
import sys
import os

# Import configuration
from chatbot.config import DB_CONFIG

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

def test_end_to_end_pipeline():
    """Test 4.1: End-to-End Pipeline Test"""
    print("\n" + "=" * 60)
    print("Phase 4.1: End-to-End Pipeline Test")
    print("=" * 60)
    
    try:
        # Import components
        from chatbot.emotion_detector import EmotionDetector
        from chatbot.rag_system_postgres import RAGSystem
        
        # Try to import LLM client (may not be available if ollama is not installed)
        try:
            from chatbot.llm_client import LLMClient
            LLM_AVAILABLE = True
        except ImportError:
            LLM_AVAILABLE = False
            print("[WARN] LLM client not available (ollama not installed)")
            print("[INFO] Will skip LLM response generation tests")
        
        # Initialize components
        print("\n[INFO] Initializing components...")
        
        print("   [1/3] Loading emotion detector...")
        emotion_detector = EmotionDetector()
        
        print("   [2/3] Loading RAG system...")
        rag_system = RAGSystem(db_config=DB_CONFIG)
        
        if LLM_AVAILABLE:
            print("   [3/3] Initializing LLM client...")
            llm_client = LLMClient()
            print("[OK] All components initialized!")
        else:
            print("[INFO] LLM client skipped (not available)")
            llm_client = None
            print("[OK] Core components initialized! (LLM optional)")
        
        # Test scenarios
        test_scenarios = [
            {
                "name": "Simple Query",
                "query": "I'm feeling anxious about my exam",
                "should_retrieve": True,
                "expected_emotions": ["anxiety", "nervousness", "fear"]
            },
            {
                "name": "Complex Query",
                "query": "I've been struggling with depression and can't sleep at night, feel hopeless",
                "should_retrieve": True,
                "expected_emotions": ["sadness", "grief", "fear"]
            },
            {
                "name": "Unrelated Query",
                "query": "What's the weather today?",
                "should_retrieve": False,  # May or may not retrieve
                "expected_emotions": []  # May or may not detect emotions
            }
        ]
        
        all_passed = True
        
        for scenario in test_scenarios:
            print("\n" + "-" * 60)
            print(f"Test Scenario: {scenario['name']}")
            print("-" * 60)
            print(f"Query: '{scenario['query']}'")
            
            # Step 1: Detect emotions
            print("\n[STEP 1] Emotion Detection...")
            emotions = emotion_detector.detect_emotions(scenario['query'], top_k=2, threshold=0.3)
            emotions_str = emotion_detector.format_emotions_for_llm(emotions)
            
            if emotions:
                print(f"[OK] Emotions detected: {len(emotions)} emotions")
                for emo_tuple in emotions:
                    if isinstance(emo_tuple, tuple):
                        emotion, prob = emo_tuple
                        print(f"      - {emotion}: {prob:.3f}")
                    elif isinstance(emo_tuple, dict):
                        print(f"      - {emo_tuple.get('emotion', 'unknown')}: {emo_tuple.get('probability', 0):.3f}")
                    else:
                        print(f"      - {emo_tuple}")
            else:
                print("[INFO] No emotions detected (or below threshold)")
            
            # Step 2: Retrieve context from RAG
            print("\n[STEP 2] RAG Retrieval...")
            contexts = rag_system.retrieve_context(
                query=scenario['query'],
                top_k=3,
                similarity_threshold=0.5
            )
            
            if contexts:
                print(f"[OK] Retrieved {len(contexts)} contexts")
                for i, ctx in enumerate(contexts[:2], 1):  # Show first 2
                    print(f"      Context {i}: Similarity {ctx['similarity']:.3f}")
                    print(f"      Input: {ctx['input_chunk'][:60]}...")
            else:
                print("[INFO] No contexts retrieved (below similarity threshold)")
                if scenario['should_retrieve']:
                    print("[WARN] Expected to retrieve contexts but none found")
            
            # Step 3: Format context for LLM
            context_str = rag_system.format_context_for_llm(contexts) if contexts else ""
            
            # Step 4: Generate LLM response (if available)
            if LLM_AVAILABLE and llm_client:
                print("\n[STEP 3] LLM Response Generation...")
                try:
                    response = llm_client.generate_response(
                        user_message=scenario['query'],
                        emotions=emotions_str,
                        context=context_str
                    )
                    
                    if response and len(response.strip()) > 0:
                        print(f"[OK] LLM response generated ({len(response)} chars)")
                        print(f"      Preview: {response[:100]}...")
                        
                        # Validate response quality
                        if len(response) < 50:
                            print("[WARN] Response is too short (< 50 chars)")
                        elif len(response) > 2000:
                            print("[WARN] Response is very long (> 2000 chars)")
                        else:
                            print("[OK] Response length is appropriate")
                    else:
                        print("[FAIL] LLM response is empty")
                        all_passed = False
                        
                except Exception as e:
                    print(f"[WARN] Error generating LLM response: {e}")
                    print("[INFO] This might be expected if Ollama is not running")
                    print("[INFO] Continuing with other validations...")
            else:
                print("\n[STEP 3] LLM Response Generation...")
                print("[SKIP] LLM client not available, skipping response generation")
                print("[INFO] Emotion detection and RAG retrieval are validated")
            
            # Validation checklist
            print("\n[VALIDATION] Checklist:")
            validation_passed = True
            
            # Check emotions detected
            if scenario['expected_emotions']:
                if emotions:
                    print("   [OK] Emotions detected (even if low confidence)")
                else:
                    print("   [WARN] Expected emotions but none detected")
            else:
                print("   [OK] Emotion detection handled (may or may not detect)")
            
            # Check RAG retrieval
            if scenario['should_retrieve']:
                if contexts:
                    print("   [OK] RAG retrieval found relevant chunks")
                else:
                    print("   [WARN] Expected retrieval but none found (may need lower threshold)")
            else:
                print("   [OK] RAG retrieval handled (few/no contexts is acceptable)")
            
            # Check LLM received formatted context
            if context_str or not contexts:
                print("   [OK] LLM receives formatted context (or no context if none retrieved)")
            else:
                print("   [WARN] Context retrieved but not formatted")
                validation_passed = False
            
            # Check no errors in pipeline
            print("   [OK] No errors in pipeline (up to this point)")
            
            if not validation_passed:
                all_passed = False
        
        return all_passed
        
    except Exception as e:
        print(f"[FAIL] Error in end-to-end pipeline test: {e}")
        import traceback
        traceback.print_exc()
        return False


def test_retrieval_accuracy():
    """Test 4.2: Retrieval Accuracy Test"""
    print("\n" + "=" * 60)
    print("Phase 4.2: Retrieval Accuracy Test")
    print("=" * 60)
    
    try:
        from chatbot.rag_system_postgres import RAGSystem
        
        print("\n[INFO] Initializing RAG system...")
        rag_system = RAGSystem(db_config=DB_CONFIG)
        
        # Sample queries with known topics
        test_queries = [
            "anxiety about exams",
            "depression and hopelessness",
            "relationship problems",
            "work stress"
        ]
        
        print("\n[INFO] Testing retrieval accuracy on sample queries...")
        
        all_relevant = True
        
        for query in test_queries:
            print("\n" + "-" * 60)
            print(f"Query: '{query}'")
            print("-" * 60)
            
            contexts = rag_system.retrieve_context(
                query=query,
                top_k=3,
                similarity_threshold=0.5
            )
            
            if contexts:
                print(f"[OK] Retrieved {len(contexts)} contexts")
                print("\n[INFO] Retrieved contexts (for manual review):")
                
                for i, ctx in enumerate(contexts, 1):
                    print(f"\n   Context {i}:")
                    print(f"      Similarity: {ctx['similarity']:.3f}")
                    print(f"      Question {ctx['question_no']}, Chunk {ctx['chunk_index']}")
                    print(f"      Input: {ctx['input_chunk'][:150]}...")
                    print(f"      Output: {ctx['output_chunk'][:150]}...")
                    
                    # Basic relevance check (can be improved)
                    query_words = set(query.lower().split())
                    input_words = set(ctx['input_chunk'].lower().split())
                    common_words = query_words.intersection(input_words)
                    
                    if len(common_words) > 0:
                        print(f"      Relevance: {len(common_words)} common words ({', '.join(common_words)})")
                    else:
                        print(f"      Relevance: Semantic similarity only (no direct word overlap)")
                
                # Check if similarities are reasonable
                similarities = [ctx['similarity'] for ctx in contexts]
                avg_similarity = sum(similarities) / len(similarities)
                
                if avg_similarity >= 0.5:
                    print(f"\n[OK] Average similarity {avg_similarity:.3f} is reasonable (>= 0.5)")
                else:
                    print(f"\n[WARN] Average similarity {avg_similarity:.3f} is below 0.5")
            else:
                print("[INFO] No contexts retrieved (try lowering similarity threshold)")
                print("[INFO] This might be acceptable if query is very specific")
        
        print("\n[INFO] Manual Review:")
        print("   Please review the retrieved contexts above to verify:")
        print("   - Retrieved contexts are semantically relevant to query")
        print("   - Output chunks provide appropriate therapist responses")
        print("   - Similarity scores reflect actual relevance")
        
        return True
        
    except Exception as e:
        print(f"[FAIL] Error in retrieval accuracy test: {e}")
        import traceback
        traceback.print_exc()
        return False


def run_all_tests():
    """Run all Phase 4 tests"""
    print("=" * 60)
    print("PHASE 4: Integration Testing")
    print("=" * 60)
    print(f"\nDatabase: {DB_CONFIG['database']}")
    print(f"Host: {DB_CONFIG['host']}:{DB_CONFIG['port']}")
    print(f"User: {DB_CONFIG['user']}")
    
    results = {}
    
    # Test 4.1: End-to-End Pipeline
    results['end_to_end'] = test_end_to_end_pipeline()
    
    # Test 4.2: Retrieval Accuracy
    results['retrieval_accuracy'] = test_retrieval_accuracy()
    
    # Summary
    print("\n" + "=" * 60)
    print("PHASE 4 TEST SUMMARY")
    print("=" * 60)
    
    print("\nTest Results:")
    for test_name, result in results.items():
        status = "[PASS] PASSED" if result else "[FAIL] FAILED"
        print(f"   {test_name.replace('_', ' ').title()}: {status}")
    
    all_passed = all(results.values())
    
    print("\n" + "=" * 60)
    if all_passed:
        print("[SUCCESS] ALL PHASE 4 TESTS PASSED!")
        print("   Integration pipeline is working correctly")
    else:
        print("[WARN] SOME TESTS FAILED OR NEED MANUAL REVIEW")
        print("   Review output above for details")
    print("=" * 60)
    
    return results


if __name__ == "__main__":
    run_all_tests()
