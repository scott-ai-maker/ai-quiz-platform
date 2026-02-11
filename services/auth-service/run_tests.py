import pytest
import sys
import os

# Add the parent directory to the path so we can import src
sys.path.insert(0, os.path.abspath(
    os.path.join(os.path.dirname(__file__), '..')))


def run_tests():
    """Run all tests"""
    print("🧪 Running Authentication Service Tests...\n")

    # Run tests with verbose output
    exit_code = pytest.main([
        "tests/",
        "-v",
        "--tb=short",
        "-s"
    ])

    if exit_code == 0:
        print("\n✅ All tests passed!")
    else:
        print("\n❌ Some tests failed")

    return exit_code


if __name__ == "__main__":
    sys.exit(run_tests())
