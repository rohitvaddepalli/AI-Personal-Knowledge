FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    ffmpeg \
    nodejs \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml .

# Install dependencies using pip 
RUN pip install --no-cache-dir hatchling \
    && pip install --no-cache-dir . \
    || (pip install --no-cache-dir -e . || pip install fastapi uvicorn sqlalchemy chromadb networkx pydantic-settings httpx beautifulsoup4 youtube-transcript-api yt-dlp python-multipart)

COPY app /app/app

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
