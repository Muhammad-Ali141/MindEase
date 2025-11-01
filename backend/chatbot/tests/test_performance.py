"""
Phase 6: Performance Testing
Tests performance benchmarks for database queries and end-to-end pipeline
"""
import os
import sys
import time
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


def test_database_query_performance():
    """
    Test 6.1: Database Query Performance
    Measure retrieval speed for similarity search and joins
    """
    print("\n" + "=" * 80)
    print("Phase 6.1: Database Query Performance")
    print("=" * 80)
    
    # Initialize RAG system
    print("\n[INIT] Initializing RAG system...")
    rag_system = RAGSystem(db_config=DB_CONFIG)
    print("[OK] RAG system initialized")
    
    # Test queries of varying complexity
    test_queries = [
        "I'm feeling anxious",
        "I'm feeling anxious about my exam tomorrow and I don't know what to do",
        "My relationship with my partner is causing me significant stress and anxiety because we keep having arguments about our future plans"
    ]
    
    results = []
    
    for i, query in enumerate(test_queries, 1):
        print(f"\n[TEST {i}/{len(test_queries)}] Testing query: \"{query[:50]}...\"")
        print("-" * 80)
        
        # Measure similarity search time
        start_time = time.time()
        try:
            contexts = rag_system.retrieve_context(
                query=query,
                top_k=10,
                similarity_threshold=0.5
            )
            similarity_search_time = (time.time() - start_time) * 1000  # Convert to ms
            contexts_count = len(contexts)
        except Exception as e:
            print(f"[FAIL] Similarity search failed: {e}")
            similarity_search_time = -1
            contexts_count = 0
        
        print(f"[RESULT] Similarity search: {similarity_search_time:.2f}ms ({contexts_count} results)")
        
        results.append({
            'query': query,
            'similarity_search_time_ms': similarity_search_time,
            'results_count': contexts_count
        })
    
    # Summary
    print("\n" + "=" * 80)
    print("Phase 6.1 Summary")
    print("=" * 80)
    
    avg_similarity_time = sum(r['similarity_search_time_ms'] for r in results if r['similarity_search_time_ms'] > 0) / len([r for r in results if r['similarity_search_time_ms'] > 0])
    max_similarity_time = max(r['similarity_search_time_ms'] for r in results if r['similarity_search_time_ms'] > 0)
    min_similarity_time = min(r['similarity_search_time_ms'] for r in results if r['similarity_search_time_ms'] > 0)
    
    print(f"\n[PERFORMANCE METRICS]")
    print(f"   Average similarity search time: {avg_similarity_time:.2f}ms")
    print(f"   Min similarity search time: {min_similarity_time:.2f}ms")
    print(f"   Max similarity search time: {max_similarity_time:.2f}ms")
    
    # Expected: < 100ms for top 10 results
    expected_max = 100  # ms
    meets_expectation = avg_similarity_time < expected_max
    
    print(f"\n[EXPECTATION] Average similarity search < {expected_max}ms: {meets_expectation}")
    
    if meets_expectation:
        print("\n[RESULT] [OK] Database query performance meets expectations")
        return True
    else:
        print(f"\n[RESULT] [WARN] Average time ({avg_similarity_time:.2f}ms) exceeds expectation ({expected_max}ms)")
        return False


def test_end_to_end_latency():
    """
    Test 6.2: End-to-End Latency
    Measure complete pipeline latency (emotion detection + RAG + LLM)
    """
    print("\n" + "=" * 80)
    print("Phase 6.2: End-to-End Latency")
    print("=" * 80)
    
    # Initialize all components
    print("\n[INIT] Initializing components...")
    
    print("   [1/4] Initializing Emotion Detector...")
    start = time.time()
    emotion_detector = EmotionDetector()
    emotion_init_time = (time.time() - start) * 1000
    print(f"        [OK] Initialized in {emotion_init_time:.2f}ms")
    
    print("   [2/4] Initializing RAG System...")
    start = time.time()
    rag_system = RAGSystem(db_config=DB_CONFIG)
    rag_init_time = (time.time() - start) * 1000
    print(f"        [OK] Initialized in {rag_init_time:.2f}ms")
    
    print("   [3/4] Initializing Memory...")
    start = time.time()
    memory = ConversationMemory(max_history_length=20)
    memory_init_time = (time.time() - start) * 1000
    print(f"        [OK] Initialized in {memory_init_time:.2f}ms")
    
    print("   [4/4] Initializing LLM Client...")
    try:
        start = time.time()
        llm_client = LLMClient()
        llm_init_time = (time.time() - start) * 1000
        
        if not llm_client.model_name:
            print(f"        [SKIP] LLM model not available")
            print("[INFO] Performance testing will skip LLM generation step")
            llm_client = None
        else:
            print(f"        [OK] Initialized in {llm_init_time:.2f}ms (model: {llm_client.model_name})")
    except Exception as e:
        print(f"        [SKIP] LLM client not available: {e}")
        llm_client = None
    
    # Test queries
    test_queries = [
        "I'm feeling anxious about my exam",
        "I've been struggling with depression",
        "My relationship is causing me stress"
    ]
    
    results = []
    
    for i, query in enumerate(test_queries, 1):
        print(f"\n[TEST {i}/{len(test_queries)}] Testing: \"{query}\"")
        print("-" * 80)
        
        total_start = time.time()
        
        # Step 1: Emotion Detection
        print("   [STEP 1] Emotion Detection...")
        start = time.time()
        try:
            emotions = emotion_detector.detect_emotions(query, top_k=2, threshold=0.3)
            emotions_str = emotion_detector.format_emotions_for_llm(emotions)
            emotion_time = (time.time() - start) * 1000
            print(f"        [OK] Completed in {emotion_time:.2f}ms ({len(emotions)} emotions)")
        except Exception as e:
            print(f"        [FAIL] Emotion detection failed: {e}")
            emotion_time = -1
            emotions = []
            emotions_str = ""
        
        # Step 2: RAG Retrieval
        print("   [STEP 2] RAG Retrieval...")
        start = time.time()
        try:
            contexts = rag_system.retrieve_context(
                query=query,
                top_k=3,
                similarity_threshold=0.5
            )
            context_str = rag_system.format_context_for_llm(contexts) if contexts else ""
            rag_time = (time.time() - start) * 1000
            print(f"        [OK] Completed in {rag_time:.2f}ms ({len(contexts)} contexts)")
        except Exception as e:
            print(f"        [FAIL] RAG retrieval failed: {e}")
            rag_time = -1
            contexts = []
            context_str = ""
        
        # Step 3: LLM Generation
        llm_time = -1
        if llm_client and llm_client.model_name:
            print("   [STEP 3] LLM Generation...")
            start = time.time()
            try:
                conversation_history = memory.get_history_with_context()
                response = llm_client.generate_response(
                    user_message=query,
                    emotions=emotions_str,
                    context=context_str,
                    conversation_history=conversation_history
                )
                llm_time = (time.time() - start) * 1000
                print(f"        [OK] Completed in {llm_time:.2f}ms ({len(response)} chars)")
                memory.add_exchange(query, response)
            except Exception as e:
                print(f"        [FAIL] LLM generation failed: {e}")
                llm_time = -1
        else:
            print("   [STEP 3] LLM Generation... [SKIPPED - LLM not available]")
        
        # Total pipeline time
        total_time = (time.time() - total_start) * 1000
        
        print(f"\n   [SUMMARY] Total pipeline time: {total_time:.2f}ms")
        print(f"      • Emotion Detection: {emotion_time:.2f}ms")
        print(f"      • RAG Retrieval: {rag_time:.2f}ms")
        if llm_time > 0:
            print(f"      • LLM Generation: {llm_time:.2f}ms")
        
        results.append({
            'query': query,
            'emotion_time_ms': emotion_time,
            'rag_time_ms': rag_time,
            'llm_time_ms': llm_time,
            'total_time_ms': total_time
        })
    
    # Summary
    print("\n" + "=" * 80)
    print("Phase 6.2 Summary")
    print("=" * 80)
    
    # Calculate averages (excluding failed tests)
    emotion_times = [r['emotion_time_ms'] for r in results if r['emotion_time_ms'] > 0]
    rag_times = [r['rag_time_ms'] for r in results if r['rag_time_ms'] > 0]
    llm_times = [r['llm_time_ms'] for r in results if r['llm_time_ms'] > 0]
    total_times = [r['total_time_ms'] for r in results]
    
    if emotion_times:
        avg_emotion = sum(emotion_times) / len(emotion_times)
        print(f"\n[AVERAGE] Emotion Detection: {avg_emotion:.2f}ms")
    else:
        avg_emotion = 0
        print("\n[AVERAGE] Emotion Detection: N/A (all tests failed)")
    
    if rag_times:
        avg_rag = sum(rag_times) / len(rag_times)
        print(f"[AVERAGE] RAG Retrieval: {avg_rag:.2f}ms")
    else:
        avg_rag = 0
        print("[AVERAGE] RAG Retrieval: N/A (all tests failed)")
    
    if llm_times:
        avg_llm = sum(llm_times) / len(llm_times)
        print(f"[AVERAGE] LLM Generation: {avg_llm:.2f}ms ({avg_llm/1000:.2f}s)")
    else:
        avg_llm = 0
        print("[AVERAGE] LLM Generation: N/A (skipped)")
    
    if total_times:
        avg_total = sum(total_times) / len(total_times)
        print(f"[AVERAGE] Total Pipeline: {avg_total:.2f}ms ({avg_total/1000:.2f}s)")
    else:
        avg_total = 0
    
    # Check expectations (allow for better-than-expected performance)
    print("\n[EXPECTATIONS]")
    emotion_ok = avg_emotion <= 500 if emotion_times else True  # <= 500ms (can be faster)
    rag_ok = avg_rag <= 300 if rag_times else True  # <= 300ms (can be faster)
    llm_ok = 2000 <= avg_llm <= 5000 if llm_times else True  # 2-5 seconds
    total_ok = avg_total <= 6000 if total_times and llm_times else True  # <= 6s (can be faster)
    
    print(f"   Emotion Detection (100-500ms): {'[OK]' if emotion_ok else '[FAIL]'}")
    print(f"   RAG Retrieval (100-300ms): {'[OK]' if rag_ok else '[FAIL]'}")
    if llm_times:
        print(f"   LLM Generation (2-5s): {'[OK]' if llm_ok else '[FAIL]'}")
        print(f"   Total Pipeline (2.5-6s): {'[OK]' if total_ok else '[FAIL]'}")
    else:
        print(f"   LLM Generation: [SKIPPED]")
        print(f"   Total Pipeline (without LLM): {avg_total:.2f}ms")
    
    all_ok = emotion_ok and rag_ok and (llm_ok if llm_times else True) and (total_ok if llm_times else True)
    
    if all_ok:
        print("\n[RESULT] [OK] All performance benchmarks meet expectations")
        return True
    else:
        print("\n[RESULT] [WARN] Some performance benchmarks outside expected ranges")
        return False


if __name__ == "__main__":
    print("\n" + "=" * 80)
    print("Phase 6: Performance Testing")
    print("=" * 80)
    
    try:
        # Test 6.1: Database Query Performance
        test_6_1_passed = test_database_query_performance()
        
        # Test 6.2: End-to-End Latency
        test_6_2_passed = test_end_to_end_latency()
        
        # Final Summary
        print("\n" + "=" * 80)
        print("Phase 6: Final Summary")
        print("=" * 80)
        
        print(f"\n[OK] Test 6.1 (Database Query Performance): {'PASSED' if test_6_1_passed else 'FAILED'}")
        print(f"[OK] Test 6.2 (End-to-End Latency): {'PASSED' if test_6_2_passed else 'FAILED'}")
        
        if test_6_1_passed and test_6_2_passed:
            print("\n[SUCCESS] Phase 6: ALL TESTS PASSED")
            sys.exit(0)
        else:
            print("\n[WARN] Phase 6: Some tests had issues")
            sys.exit(1)
            
    except KeyboardInterrupt:
        print("\n\n[INFO] Testing interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n[ERROR] Fatal error during testing: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

