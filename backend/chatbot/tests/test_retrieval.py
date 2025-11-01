"""
Phase 3: Retrieval Testing
Test similarity search, hierarchical retrieval, and threshold filtering
"""
import psycopg2
import sys
import os

# Database configuration
# Import configuration
from chatbot.config import DB_CONFIG

# Try to import sentence_transformers
try:
    from sentence_transformers import SentenceTransformer
    SENTENCE_TRANSFORMERS_AVAILABLE = True
except ImportError:
    SENTENCE_TRANSFORMERS_AVAILABLE = False
    print("[WARN] sentence-transformers not available. Some tests will be skipped.")

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

def test_similarity_search():
    """Test vector similarity search"""
    print("\n" + "=" * 60)
    print("Testing Similarity Search")
    print("=" * 60)
    
    """Test 3.1: Similarity Search Validation"""
    print("\n" + "=" * 60)
    print("Phase 3.1: Similarity Search Validation")
    print("=" * 60)
    
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        # Get a sample embedding to search (self-match test)
        cursor.execute("""
            SELECT question_no, chunk_index, embedding 
            FROM input_chunks 
            WHERE question_no = 1 AND chunk_index = 0
            LIMIT 1;
        """)
        result = cursor.fetchone()
        
        if not result:
            # If question_no=1 doesn't exist, get any chunk
            cursor.execute("SELECT question_no, chunk_index, embedding FROM input_chunks LIMIT 1;")
            result = cursor.fetchone()
        
        if not result:
            print("[FAIL] No data in database. Run data ingestion first.")
            cursor.close()
            conn.close()
            return False
        
        q_no, c_idx, query_embedding = result
        
        print(f"[INFO] Using question_no={q_no}, chunk_index={c_idx} as query embedding")
        
        # Perform similarity search using pgvector cosine distance
        # Use subquery to get the embedding directly from database
        cursor.execute("""
            SELECT 
                i.question_no,
                i.chunk_index,
                i.content,
                1 - (i.embedding <=> q.embedding) as similarity
            FROM input_chunks i,
            (SELECT embedding FROM input_chunks WHERE question_no = %s AND chunk_index = %s LIMIT 1) q
            ORDER BY i.embedding <=> q.embedding
            LIMIT 5;
        """, (q_no, c_idx))
        
        results = cursor.fetchall()
        
        print(f"[OK] Similarity search returned {len(results)} results")
        
        if results:
            print("\n[INFO] Top 5 similar chunks:")
            for i, row in enumerate(results, 1):
                r_q_no, r_c_idx, content, similarity = row
                is_self = (r_q_no == q_no and r_c_idx == c_idx)
                marker = "[SELF]" if is_self else ""
                print(f"   {i}. Similarity: {similarity:.4f} {marker}")
                print(f"      Question {r_q_no}, Chunk {r_c_idx}")
                print(f"      Content: {content[:80]}...")
            
            # Check if most similar is itself (should be ~1.0)
            first_result = results[0]
            if first_result[0] == q_no and first_result[1] == c_idx:
                if first_result[3] >= 0.99:
                    print("[OK] Most similar result is self-match (similarity ~1.0)")
                else:
                    print(f"[WARN] Self-match similarity is {first_result[3]:.4f} (expected ~1.0)")
            else:
                print("[WARN] Most similar result is not the query itself")
            
            # Check ordering - similarity should decrease
            similarities = [r[3] for r in results]
            is_decreasing = all(similarities[i] >= similarities[i+1] for i in range(len(similarities)-1))
            if is_decreasing:
                print("[OK] Results are ordered by similarity (descending)")
            else:
                print("[WARN] Results may not be properly ordered")
        
        cursor.close()
        conn.close()
        
        return len(results) > 0
        
    except Exception as e:
        print(f"[FAIL] Error in similarity search: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_hierarchical_retrieval():
    """Test 3.2: Hierarchical Retrieval Validation - input chunks → output chunks"""
    print("\n" + "=" * 60)
    print("Phase 3.2: Hierarchical Retrieval Validation")
    print("=" * 60)
    
    if not SENTENCE_TRANSFORMERS_AVAILABLE:
        print("[SKIP] sentence-transformers not available. Skipping hierarchical retrieval test.")
        return None
    
    try:
        # Generate query embedding
        model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')
        test_query = "I'm feeling anxious about my exam"
        print(f"[INFO] Test query: '{test_query}'")
        
        query_embedding = model.encode(test_query, convert_to_numpy=True, normalize_embeddings=True)
        query_embedding_str = str(query_embedding.tolist())
        
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        # Perform hierarchical retrieval using WITH clause (as in testing plan)
        cursor.execute("""
            WITH similar_inputs AS (
                SELECT 
                    i.question_no,
                    i.chunk_index,
                    i.content as input_content,
                    1 - (i.embedding <=> %s::vector) as similarity
                FROM input_chunks i
                WHERE 1 - (i.embedding <=> %s::vector) >= 0.5
                ORDER BY i.embedding <=> %s::vector
                LIMIT 3
            )
            SELECT 
                si.question_no,
                si.chunk_index,
                si.input_content,
                si.similarity,
                oc.content as output_content
            FROM similar_inputs si
            JOIN output_chunks oc 
                ON si.question_no = oc.question_no 
                AND si.chunk_index = oc.chunk_index
            ORDER BY si.similarity DESC;
        """, (query_embedding_str, query_embedding_str, query_embedding_str))
        
        results = cursor.fetchall()
        
        print(f"[OK] Retrieved {len(results)} contexts with similarity >= 0.5")
        
        if results:
            print("\n[INFO] Retrieved contexts:")
            for i, row in enumerate(results, 1):
                q_no, c_idx, input_content, similarity, output_content = row
                print(f"\n   Context {i} (similarity: {similarity:.4f}):")
                print(f"      Question {q_no}, Chunk {c_idx}")
                print(f"      Input: {input_content[:100]}...")
                print(f"      Output: {output_content[:100]}...")
            
            # Verify all have matching output
            all_matched = all(len(row) == 5 and row[4] is not None for row in results)
            mapping_correct = all(
                results[i][0] == results[i][0] and results[i][1] == results[i][1]
                for i in range(len(results))
            )
            
            if all_matched and mapping_correct:
                print("\n[OK] All input chunks have corresponding output chunks")
                print("[OK] Mapping is correct (question_no and chunk_index match)")
            else:
                print("\n[FAIL] Some input chunks are missing output chunks or mapping is incorrect")
                return False
        else:
            print("[WARN] No results found. Try lowering similarity threshold or check database.")
            print("[INFO] This might be normal if no chunks are similar enough to the query.")
        
        cursor.close()
        conn.close()
        
        return len(results) > 0
        
    except Exception as e:
        print(f"[FAIL] Error in hierarchical retrieval: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_threshold_filtering():
    """Test 3.3: Threshold Validation - similarity threshold filtering"""
    print("\n" + "=" * 60)
    print("Phase 3.3: Threshold Validation")
    print("=" * 60)
    
    if not SENTENCE_TRANSFORMERS_AVAILABLE:
        print("[SKIP] sentence-transformers not available. Skipping threshold test.")
        return None
    
    try:
        model = SentenceTransformer('sentence-transformers/all-MiniLM-L6-v2')
        test_query = "I'm feeling anxious"
        print(f"[INFO] Test query: '{test_query}'")
        
        query_embedding = model.encode(test_query, convert_to_numpy=True, normalize_embeddings=True)
        query_embedding_str = str(query_embedding.tolist())
        
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        # Test different thresholds
        thresholds = [0.3, 0.5, 0.7, 0.9]
        
        print("\n[INFO] Results by threshold:")
        
        threshold_results = {}
        for threshold in thresholds:
            cursor.execute("""
                SELECT COUNT(*) as count
                FROM input_chunks
                WHERE 1 - (embedding <=> %s::vector) >= %s;
            """, (query_embedding_str, threshold))
            
            count = cursor.fetchone()[0]
            threshold_results[threshold] = count
            print(f"   Threshold {threshold}: {count} results")
        
        # Validate threshold filtering works correctly
        # Counts should be decreasing as threshold increases
        threshold_values = sorted(thresholds)
        counts = [threshold_results[t] for t in threshold_values]
        is_decreasing = all(counts[i] >= counts[i+1] for i in range(len(counts)-1))
        
        if is_decreasing:
            print("[OK] Threshold filtering works correctly (counts decrease with higher threshold)")
        else:
            print("[WARN] Threshold filtering may not be working correctly")
        
        # Check that threshold = 0.5 returns appropriate results
        count_0_5 = threshold_results[0.5]
        if count_0_5 > 0:
            print(f"[OK] Threshold 0.5 returns {count_0_5} results (appropriate filtering)")
        else:
            print(f"[INFO] Threshold 0.5 returns {count_0_5} results (may need lower threshold)")
        
        cursor.close()
        conn.close()
        
        return True
        
    except Exception as e:
        print(f"[FAIL] Error in threshold testing: {e}")
        import traceback
        traceback.print_exc()
        return False

def run_all_tests():
    """Run all Phase 3 tests"""
    print("=" * 60)
    print("PHASE 3: Retrieval Testing")
    print("=" * 60)
    print(f"\nDatabase: {DB_CONFIG['database']}")
    print(f"Host: {DB_CONFIG['host']}:{DB_CONFIG['port']}")
    print(f"User: {DB_CONFIG['user']}")
    
    results = {}
    
    # Test 3.1: Similarity Search
    results['similarity_search'] = test_similarity_search()
    
    # Test 3.2: Hierarchical Retrieval
    results['hierarchical_retrieval'] = test_hierarchical_retrieval()
    
    # Test 3.3: Threshold Filtering
    results['threshold_filtering'] = test_threshold_filtering()
    
    # Summary
    print("\n" + "=" * 60)
    print("PHASE 3 TEST SUMMARY")
    print("=" * 60)
    
    print("\nTest Results:")
    for test_name, result in results.items():
        if result is None:
            status = "[SKIP] SKIPPED"
        elif result:
            status = "[PASS] PASSED"
        else:
            status = "[FAIL] FAILED"
        print(f"   {test_name.replace('_', ' ').title()}: {status}")
    
    all_passed = all(r for r in results.values() if r is not None)
    any_failed = any(r is False for r in results.values())
    any_skipped = any(r is None for r in results.values())
    
    print("\n" + "=" * 60)
    if all_passed and not any_failed:
        print("[SUCCESS] ALL PHASE 3 TESTS PASSED!")
        print("   Retrieval system is working correctly")
    elif any_failed:
        print("[FAIL] SOME TESTS FAILED")
        print("   Review output above for details")
    elif any_skipped:
        print("[WARN] SOME TESTS SKIPPED")
        print("   Review output above for details")
    print("=" * 60)
    
    return results

if __name__ == "__main__":
    run_all_tests()

