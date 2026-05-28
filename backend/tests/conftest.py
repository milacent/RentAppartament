import sys
import os
from pathlib import Path

# Add the backend directory to sys.path so that 'app' can be imported
# This works whether pytest is run from backend/ or from project root
tests_dir = Path(__file__).parent
backend_dir = tests_dir.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Set test environment
os.environ.setdefault('DATABASE_URL', 'sqlite:///test.db')
os.environ.setdefault('SECRET_KEY', 'test-secret-key')
