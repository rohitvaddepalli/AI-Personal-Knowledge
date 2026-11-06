# Prerequisites

Before installing Second Brain, ensure you have the following installed.

## Required

| Dependency | Minimum Version | Purpose |
|-----------|----------------|---------|
| [Docker](https://docs.docker.com/get-docker/) | 24+ | Container runtime |
| [Docker Compose](https://docs.docker.com/compose/) | v2.20+ | Multi-service orchestration |
| [Ollama](https://ollama.ai/) | 0.1.30+ | Local LLM inference |

## Optional (for development)

| Dependency | Minimum Version | Purpose |
|-----------|----------------|---------|
| Python | 3.11+ | Backend development |
| Node.js | 20+ | Frontend development |
| Git | 2.40+ | Version control |

## Recommended Hardware

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| RAM | 8 GB | 16 GB |
| Storage | 10 GB | 50 GB (for models) |
| CPU | 4 cores | 8+ cores |
| GPU | None required | NVIDIA/AMD (10× faster inference) |

## Pulling Required Models

After installing Ollama, pull the default models:

```bash
# Default chat/summarization model (~500 MB)
ollama pull qwen2.5:0.5b

# Embedding model for semantic search (~300 MB)
ollama pull nomic-embed-text
```

> [!TIP]
> For better quality answers, also pull `qwen2.5:7b` or `llama3.2:3b`. You can switch models at runtime in Settings → AI Models.
