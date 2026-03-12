# Second Brain AI

This is an AI-powered Personal Knowledge System ("Second Brain").

## Phase 1 MVP

Currently implemented:
- Full-stack local-first project structure
- FastAPI Backend with SQLite Models
- Hybrid Search Database using ChromaDB and NetworkX
- React + Vite + TypeScript Frontend
- Note Create, List APIs and basic UI

### Quickstart

Use Docker Compose to run the full stack:

```bash
docker-compose up -d --build
```

Then visit:
- Frontend: `http://localhost:3000`
- API Docs: `http://localhost:8000/docs`

Ensure you have Ollama running locally or via Docker and pull the necessary models:
```bash
docker exec -it second-brain-ollama-1 ollama run qwen2.5:0.5b
```
