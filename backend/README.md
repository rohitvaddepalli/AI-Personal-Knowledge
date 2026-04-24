# Second Brain Backend
AI-Powered Personal Knowledge System backend.

## Database modes

The backend now supports two database paths:

- `local` mode: default desktop/local-first behavior. If no database env vars are set, the app uses SQLite in `backend/data/brain.db`.
- `postgres` mode: intended for containerized or multi-service deployments. If `SECOND_BRAIN_DATABASE_MODE=postgres` and no explicit `SECOND_BRAIN_DATABASE_URL` is provided, the backend builds a Postgres URL from the `SECOND_BRAIN_POSTGRES_*` settings.

Relevant environment variables:

- `SECOND_BRAIN_DATABASE_MODE=local|postgres`
- `SECOND_BRAIN_DATABASE_URL=...`
- `SECOND_BRAIN_POSTGRES_HOST=127.0.0.1`
- `SECOND_BRAIN_POSTGRES_PORT=5432`
- `SECOND_BRAIN_POSTGRES_DB=second_brain`
- `SECOND_BRAIN_POSTGRES_USER=second_brain`
- `SECOND_BRAIN_POSTGRES_PASSWORD=second_brain`

## Local development

SQLite remains the default, so this still works without extra setup:

```powershell
cd backend
pip install -e .
uvicorn app.main:app --reload
```

## Docker Compose

The root `docker-compose.yml` now starts the backend against Postgres by default:

```powershell
docker compose up --build
```

This stack now includes:

- `postgres` for primary relational storage
- `redis` as the queue/result broker
- `celery-worker` for background job execution
- `ollama` for local model hosting

## Phase 4 runtime surfaces

- `/api/ask/stream` provides SSE streaming for grounded AI responses
- `/api/system/status` returns runtime settings, provider health, and resource metrics
- `/api/system/metrics` returns CPU/RAM/task queue stats for the frontend monitor
- `/api/auth/*` enables optional multi-user JWT cookie auth with CSRF checks when `SECOND_BRAIN_AUTH_MODE=multi_user`

The `/api/health` response includes `databaseBackend` and `databaseMode` so you can verify which store is active at runtime.

## Alembic workflow

Phase 4 now includes an Alembic baseline:

```powershell
cd backend
alembic upgrade head
```

Create a new migration after schema changes:

```powershell
cd backend
alembic revision --autogenerate -m "describe change"
```
