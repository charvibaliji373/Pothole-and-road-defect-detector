# =============================================================================
# RoadVision AI — Autonomous Road Defect & Pothole Intelligence Platform
# Production Multi-Platform Docker Container
# Compatible with Hugging Face Spaces (Docker), Render, Railway, AWS, GCP, Azure
# =============================================================================

FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000 \
    HOST=0.0.0.0

# Install system dependencies for OpenCV, PyTorch CPU, and ReportLab PDF font engines
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Upgrade pip and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy entire application code, neural model weights, and frontend assets
COPY . .

# Ensure data directories exist and are writable
RUN mkdir -p backend/data/uploads backend/data/exports

# Expose HTTP port (Hugging Face Spaces defaults to 7860, Cloud Run to 8080, Render to 10000 or 8000)
EXPOSE 8000

# Start unified FastAPI server with frontend & backend
CMD ["python", "run_app.py"]
