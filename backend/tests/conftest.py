import sys
import os

# Add the backend directory to sys.path so that 'app' can be imported
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Set test environment
os.environ.setdefault('DATABASE_URL', 'sqlite:///test.db')
os.environ.setdefault('SECRET_KEY', 'test-secret-key')
