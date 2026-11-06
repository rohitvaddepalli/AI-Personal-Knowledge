# Architecture Overview

## Service Architecture

```mermaid
graph TD
    Browser["🌐 Browser / Desktop App"]
    Nginx["Nginx Reverse Proxy\n:80"]
    Frontend["React Frontend\nVite + TypeScript"]
    Backend["FastAPI Backend\n:8000"]
    Celery["Celery Workers\nBackground Jobs"]
    Postgres["PostgreSQL 16\nRelational Data"]
    ChromaDB["ChromaDB\nVector Embeddings"]
    Redis["Redis 7\nBroker + Cache"]
    Ollama["Ollama\nLocal LLM :11434"]

    Browser --> Nginx
    Nginx --> Frontend
    Nginx --> Backend
    Backend --> Postgres
    Backend --> ChromaDB
    Backend --> Redis
    Backend --> Ollama
    Celery --> Postgres
    Celery --> ChromaDB
    Celery --> Redis
    Celery --> Ollama
```

## Component Breakdown

### Backend (FastAPI)

| Module | Purpose |
|--------|---------|
| `app/routers/notes.py` | Note CRUD, search, versioning, AI assist |
| `app/routers/ask.py` | RAG chat, SSE streaming |
| `app/routers/search.py` | Hybrid search (BM25 + semantic) |
| `app/routers/ingest.py` | File upload pipeline |
| `app/routers/import_.py` | URL/YouTube import |
| `app/routers/flashcards.py` | Flashcard generation + SM-2 scheduling |
| `app/routers/analytics.py` | Knowledge base statistics |
| `app/routers/digest.py` | Daily AI digest |
| `app/routers/garden.py` | Public garden + RSS |
| `app/routers/auth.py` | JWT auth (single-user / multi-user) |
| `app/services/search_service.py` | Hybrid BM25 + ChromaDB RRF search |
| `app/services/rag_service.py` | RAG context building + LLM chat |
| `app/services/embedding_service.py` | ChromaDB embedding management |
| `app/llm/router.py` | Multi-provider LLM routing + fallbacks |

### Frontend (React)

| Page | Route |
|------|-------|
| Dashboard | `/` |
| Notes List | `/notes` |
| Note Editor | `/notes/new`, `/notes/:id` |
| Ask Brain | `/ask` |
| Knowledge Graph | `/graph` |
| Flashcards | `/flashcards` |
| Analytics | `/analytics` |
| Review | `/review` |
| Settings | `/settings` |

### Data Flow: RAG Chat

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant BE as Backend
    participant CS as ChromaDB
    participant DB as PostgreSQL
    participant LLM as Ollama

    U->>FE: "What did I learn about Rust?"
    FE->>BE: POST /api/ask/stream
    BE->>CS: Semantic search (nomic-embed-text)
    BE->>DB: BM25 keyword search
    BE->>BE: RRF merge + rerank
    BE->>LLM: Prompt with top-5 context chunks
    LLM-->>BE: Stream tokens
    BE-->>FE: SSE stream
    FE-->>U: Incremental response + citations
```

## Security Architecture

- All services on a private Docker network — only Nginx exposed
- Ollama, Postgres, Redis, ChromaDB: **not reachable from outside**
- SSRF protection on URL import (IP range validation + DNS rebinding defence)
- Input sanitisation on all LLM prompts (prompt injection defence)
- JWT access tokens (30 min) + refresh tokens (7 days) in `httpOnly` cookies
- CSRF double-submit cookies
- CSP, `X-Frame-Options`, `X-Content-Type-Options` headers

