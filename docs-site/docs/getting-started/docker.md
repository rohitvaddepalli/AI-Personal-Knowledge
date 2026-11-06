# Docker Installation

The recommended way to run Second Brain in production is Docker Compose.

## 1. Clone & Configure

```bash
git clone https://github.com/your-org/second-brain.git
cd second-brain
cp .env.example .env
```

Open `.env` and set at minimum:

```dotenv
SECOND_BRAIN_AUTH_SECRET_KEY=<generate with: openssl rand -hex 32>
SECOND_BRAIN_DATA_DIR=/path/to/your/data
```

## 2. Pull Models First

```bash
ollama pull qwen2.5:0.5b
ollama pull nomic-embed-text
```

## 3. Start Services

```bash
docker compose up -d
```

This starts: **nginx** (port 80), **backend** (FastAPI), **frontend** (React), **ChromaDB**, **Redis**, **PostgreSQL**, **Ollama**.

## 4. Verify

```bash
curl http://localhost/api/health
# → {"status":"ok","databaseBackend":"postgres",...}
```

Open [http://localhost](http://localhost) in your browser.

## Development Mode

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up
```

This enables hot-reload for both frontend and backend, exposes Flower at port 5555.

## Useful Commands

```bash
# View logs
docker compose logs -f backend

# Restart a single service
docker compose restart backend

# Stop everything
docker compose down

# Full reset (WARNING: destroys data)
docker compose down -v
```

> [!CAUTION]
> `docker compose down -v` deletes all volumes including your notes and database. Always back up `SECOND_BRAIN_DATA_DIR` first.
