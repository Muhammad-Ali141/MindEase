"""
Run all tests for MindEase Chatbot
"""
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

def run_tests():
    """Run all test modules"""
    print("=" * 60)
    print("MindEase Chatbot - Test Suite")
    print("=" * 60)
    
    tests = [
        ("Database Setup", "tests.test_database_setup"),
        ("Data Ingestion", "tests.test_data_ingestion"),
        ("Retrieval", "tests.test_retrieval"),
        ("Integration", "tests.test_integration"),
    ]
    
    results = {}
    
    for test_name, test_module in tests:
        print(f"\n{'='*60}")
        print(f"Running {test_name} Tests")
        print('='*60)
        
        try:
            module = __import__(test_module, fromlist=[''])
            
            # Run main function if exists
            if hasattr(module, 'main'):
                result = module.main()
            else:
                # Try to find and run test functions
                result = True
                for attr_name in dir(module):
                    if attr_name.startswith('test_'):
                        test_func = getattr(module, attr_name)
                        if callable(test_func):
                            test_result = test_func()
                            result = result and test_result
            
            results[test_name] = result
        except Exception as e:
            print(f"❌ Error running {test_name} tests: {e}")
            import traceback
            traceback.print_exc()
            results[test_name] = False
    
    # Print summary
    print("\n" + "=" * 60)
    print("Test Summary")
    print("=" * 60)
    
    for test_name, result in results.items():
        status = "✅ PASSED" if result else "❌ FAILED"
        print(f"{test_name}: {status}")
    
    all_passed = all(results.values())
    
    print("\n" + "=" * 60)
    if all_passed:
        print("✅ All tests passed!")
    else:
        print("❌ Some tests failed. Check output above.")
    print("=" * 60)
    
    return all_passed

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)

