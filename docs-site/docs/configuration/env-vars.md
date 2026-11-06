# Environment Variables

All configuration is done via environment variables, typically set in `.env`.

## Core

| Variable | Default | Description |
|----------|---------|-------------|
| `SECOND_BRAIN_DATA_DIR` | `./data` | Root directory for all persistent data |
| `SECOND_BRAIN_API_HOST` | `127.0.0.1` | API bind address |
| `SECOND_BRAIN_API_PORT` | `8000` | API port |
| `SECOND_BRAIN_ALLOW_REMOTE_CLIENTS` | `false` | Allow non-localhost API access |
| `SECOND_BRAIN_SIDECAR_MODE` | `false` | Running as Tauri desktop sidecar |

## Database

| Variable | Default | Description |
|----------|---------|-------------|
| `SECOND_BRAIN_DATABASE_URL` | SQLite path | Full SQLAlchemy URL. Use `postgresql+psycopg2://` for Postgres |
| `SECOND_BRAIN_DATABASE_BACKEND` | `sqlite` | `sqlite` or `postgres` |

## Authentication

| Variable | Default | Description |
|----------|---------|-------------|
| `SECOND_BRAIN_AUTH_MODE` | `localhost` | `localhost` (no auth) or `multi_user` |
| `SECOND_BRAIN_AUTH_SECRET_KEY` | `change-me-in-production` | JWT signing secret — **always change in production** |
| `SECOND_BRAIN_API_KEY` | _(empty)_ | Static API key for bearer auth (alternative to cookies) |

## AI / LLM

| Variable | Default | Description |
|----------|---------|-------------|
| `SECOND_BRAIN_OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API endpoint |
| `SECOND_BRAIN_DEFAULT_MODEL` | `qwen2.5:0.5b` | Default LLM model |
| `SECOND_BRAIN_EMBEDDING_MODEL` | `nomic-embed-text` | Embedding model |
| `SECOND_BRAIN_OPENAI_API_KEY` | _(empty)_ | Enables OpenAI as cloud fallback |
| `SECOND_BRAIN_ANTHROPIC_API_KEY` | _(empty)_ | Enables Anthropic as cloud fallback |

## Rate Limiting

| Variable | Default | Description |
|----------|---------|-------------|
| `SECOND_BRAIN_RATE_LIMIT_AI_PER_MINUTE` | `20` | AI endpoint calls per minute per IP |
| `SECOND_BRAIN_RATE_LIMIT_INGEST_PER_MINUTE` | `10` | Ingest calls per minute per IP |
| `SECOND_BRAIN_RATE_LIMIT_AUTH_PER_MINUTE` | `5` | Auth calls per minute per IP |

> [!IMPORTANT]
> The `SECOND_BRAIN_AUTH_SECRET_KEY` **must** be changed before exposing the app to any network. Generate a secure value with `openssl rand -hex 32`.
