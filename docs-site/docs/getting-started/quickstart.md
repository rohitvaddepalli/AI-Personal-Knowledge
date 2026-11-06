# Quick Start

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) 24+
- [Ollama](https://ollama.com/) (installed separately — for AI features)
- 8 GB RAM recommended (4 GB minimum with Low Resource Mode)

## 1. Clone & Configure

```bash
git clone https://github.com/your-username/AI-Personal-Knowledge.git
cd AI-Personal-Knowledge

# Copy and review the env file
cp .env.example .env
```

!!! warning "Change the secret key"
    Before running in a network-accessible environment, set a strong `SECOND_BRAIN_AUTH_SECRET_KEY` in `.env`:
    ```bash
    openssl rand -hex 32
    ```

## 2. Pull Recommended AI Models

```bash
ollama pull qwen2.5:0.5b          # Fast chat & summarisation
ollama pull nomic-embed-text       # Embedding model for search
```

## 3. Start Everything

```bash
docker compose up -d
```

This starts: **backend**, **frontend**, **nginx**, **postgres**, **redis**, **chromadb**, **celery-worker**, and **ollama** (pointing to your host Ollama instance).

## 4. Open the App

| URL | Service |
|-----|---------|
| `http://localhost` | Second Brain UI |
| `http://localhost/api/docs` | FastAPI Swagger UI |
| `http://localhost:5555` | Celery Flower (dev profile) |

## 5. Create Your First Note

1. Click **Quick Capture** in the sidebar
2. Give it a title and start writing Markdown
3. The note is automatically embedded for search

## Next Steps

- [Configure your LLM models](../configuration/models.md)
- [Import content](../guide/ingestion.md) from YouTube, URLs, or files
- [Ask your brain](../guide/ask-brain.md) questions about your notes

