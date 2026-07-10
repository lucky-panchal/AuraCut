# Auracut Backend — Dockerfile
FROM python:3.11-slim

# Install system dependencies: FFmpeg, netcat (for entrypoint wait), libmagic
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    netcat-openbsd \
    libmagic1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies first (layer cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy project source
COPY . .

# Make entrypoint executable
RUN chmod +x entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["./entrypoint.sh"]
