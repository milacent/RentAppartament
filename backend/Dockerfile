# Backend Dockerfile - Optimized for faster builds
FROM python:3.12-slim

WORKDIR /app

# Install system dependencies (combined to reduce layers)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Upgrade pip first (important for caching)
RUN pip install --upgrade pip --no-cache-dir

# Copy only requirements first (for better layer caching)
COPY backend/requirements.txt ./

# Install Python dependencies with no-cache to reduce image size
# This layer will be cached if requirements.txt doesn't change
RUN pip install --no-cache-dir -r ./requirements.txt

# Copy application code (this layer is rebuilt if app changes)
COPY backend/app ./app

# Create upload directory
RUN mkdir -p uploads

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/health')"

# Use exec form for proper signal handling
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
