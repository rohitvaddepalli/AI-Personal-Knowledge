# PROJECT: Second Brain — Open-Source Second Brain with Local AI

## Mission
Build and publish, a fully open-source (MIT), privacy-first personal 
knowledge management (PKM) app. All AI runs locally via Ollama. No telemetry, no 
cloud calls, no vendor lock-in. Target audience: developers, researchers, and 
knowledge workers who want a self-hosted, AI-powered second brain.

## Tech stack (all free and open-source, no paid tiers required)

### Backend
- Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2.x (async)
- PostgreSQL 16 — primary data store for notes, metadata, user settings
- ChromaDB (persistent mode) — vector embeddings for semantic search
- Neo4j Community OR networkx + SQLite — knowledge graph storage 
  (use networkx for zero-dependency graph; offer Neo4j as optional upgrade)
- Redis 7 — Celery task queue, session cache, rate limiting
- Celery 5 + Flower — async background processing (ingestion, re-embedding)
- Alembic — database migrations
- Trafilatura — web page content extraction
- yt-dlp — YouTube video download
- faster-whisper — local speech-to-text for YouTube audio transcription
  (use openai-whisper as fallback; Whisper runs locally via Ollama whisper model 
   if available, otherwise run faster-whisper directly)
- Docling — PDF, DOCX, PPTX parsing into clean Markdown
- Sentence Transformers (sentence-transformers library) — local embedding generation
  as a fallback; prefer nomic-embed-text via Ollama as primary embedding model
- LangChain (langchain-community, langchain-ollama) — RAG orchestration
- rank_bm25 — BM25 keyword search; combine with ChromaDB for hybrid search
- spaCy (en_core_web_sm) — NER for auto-tagging (persons, orgs, places, dates)
- python-jose + passlib — JWT auth with bcrypt
- slowapi — rate limiting
- Loguru — structured logging
- pytest + pytest-asyncio + httpx — testing

### Frontend
- React 19, Vite 6, TypeScript 5, Tailwind CSS v4
- Zustand — global state management
- React Query (TanStack) — server state, caching, background refresh
- React Router v7 — SPA routing
- Monaco Editor — rich Markdown/code note editor with syntax highlighting
- react-force-graph-2d — interactive 2D knowledge graph visualization
  (renders note relationships as a force-directed graph; nodes = notes, 
   edges = auto-detected or manual links)
- Cytoscape.js — alternative graph renderer for hierarchical views
- Fuse.js — client-side fuzzy search fallback
- Recharts — analytics dashboard (notes per day, topics over time, etc.)
- react-dropzone — drag-and-drop file import
- EventSource / SSE — streaming AI chat responses
- shadcn/ui components (Button, Dialog, Command palette, Tooltip, etc.)
- Vitest + Testing Library — unit tests
- Playwright — E2E tests

### AI / LLM (Ollama — 100% local, zero cloud)
Default model recommendations (user can swap any Ollama-compatible model):
- Chat & RAG:     qwen3.5:0.8b (fast, low RAM) or qwen3.5:4b (high quality)
- Summarization:  qwen3.5:0.8b or gemma3:2b
- Embeddings:     nomic-embed-text:latest (768-dim, fast, free)
- OCR assist:     qwen3.5:0.8b (multimodal, optional)

All model configs are in a single config.yaml so users can swap models in one line.

### Infrastructure
- Docker 27 + Docker Compose v2 — full multi-service orchestration
- Nginx (official Docker image) — reverse proxy, static file serving, gzip
- Caddy (optional) — automatic HTTPS for LAN deployment
- MkDocs Material — documentation site (auto-deployed to GitHub Pages via CI)

---

## Functional requirements

### Core notes
- Create, edit, delete notes with Monaco Markdown editor
- Auto-save every 5 seconds (debounced)
- Full bidirectional linking: type [[note title]] to create wikilinks
- Tags: manual + AI-suggested (spaCy NER + LLM tagging)
- Folders / collections with drag-and-drop organisation
- Note versioning: keep last 20 versions, diffable via git-diff-style view
- Daily note: auto-creates a dated note on first open each day
- Templates: create note from template (meeting notes, book summary, etc.)
- Pinned notes and starred notes
- Bulk operations: multi-select → tag, move, delete, export

### Content ingestion (all run via Celery background tasks)
1. Web URL scraper
   - Input: URL → Trafilatura extracts clean article text + metadata
   - Fallback: Playwright headless browser for JS-heavy pages
   - Save as note with source URL, title, author, publish date
2. YouTube transcript importer
   - Input: YouTube URL → yt-dlp fetches auto-captions or downloads audio
   - If no captions: faster-whisper transcribes audio locally
   - Save transcript as note with timestamp links (e.g. [00:03:24])
   - LLM generates chapter summary and key takeaways
3. File import
   - PDF: Docling → clean Markdown
   - DOCX / PPTX / XLSX: Docling → Markdown
   - Plain text, Markdown, HTML: direct import
   - Images: pass to llava:7b for description + OCR (optional feature flag)
4. Browser extension (Chromium MV3)
   - "Clip to NeuronVault" toolbar button
   - Clip modes: full page, selection only, metadata only (bookmark)
   - Sends to backend API; shows success toast

### AI features (all via Ollama — stream responses via SSE)
1. AI Chat (RAG)
   - Multi-turn conversation grounded in the knowledge base
   - Hybrid retrieval: BM25 keyword search + ChromaDB semantic search,
     results re-ranked by cosine similarity, top-k=5 context chunks injected
   - Show source citations: each AI answer links to source notes
   - System prompt configurable by user (tone, language, expertise level)
   - Conversation history persisted per session, exportable
   - "Search only" mode: retrieve notes without generating an LLM response
2. Auto-summarization
   - On ingest: generate TL;DR (3 sentences) + key points (5 bullets)
   - On demand: full note summary, ELI5 summary, executive summary
   - Background re-summarize if note is edited significantly
3. Smart tagging
   - spaCy NER pass (persons, organisations, locations, dates, products)
   - LLM pass: suggest up to 8 semantic tags per note
   - User reviews and approves/rejects suggestions
4. Note connections (AI-suggested links)
   - After embedding, find top-5 semantically similar notes
   - Display in sidebar as "Related notes"
   - One-click to create a bidirectional link
5. Flashcard generation
   - LLM generates Q&A flashcard pairs from a note
   - Export to Anki (.apkg) via genanki, or built-in spaced-repetition mode
6. Writing assistant
   - "Continue writing" — LLM expands selected paragraph
   - "Rewrite" — rephrase selection (formal / concise / casual modes)
   - "Explain" — explain selected technical term in context
   - "Translate" — translate selection to any language
7. Daily digest
   - Scheduled Celery task (runs at configurable time, default 08:00)
   - LLM synthesises a brief digest from notes created/edited in the past 7 days
   - Surfaces forgotten notes ("You haven't visited this note in 30 days")

### Knowledge graph
- Auto-built from: explicit [[wikilinks]], shared tags, AI-suggested links,
  NER entity co-occurrence
- react-force-graph-2d renders interactive force-directed graph
- Node = note; edge = relationship type (link / tag / ai-suggested / entity)
- Click node → open note; hover → show note preview
- Filter by tag, date range, connection type
- Cluster view: group nodes by dominant tag or topic
- Export graph as SVG or JSON (Obsidian-compatible)

### Search
- Hybrid search pipeline:
  1. BM25 (rank_bm25) over full-text note content and titles
  2. Semantic search (ChromaDB, nomic-embed-text embeddings)
  3. Merge and re-rank results by RRF (Reciprocal Rank Fusion)
- Filters: tags, date range, source type, has-summary, has-flashcards
- Keyboard-first command palette (⌘K / Ctrl+K): search + actions
- Search history persisted locally

### Export & interoperability
- Export single note: Markdown, PDF (via WeasyPrint), HTML
- Export all notes: Obsidian-compatible vault (zip of .md files + attachments)
- Export graph: JSON (Gephi/Cytoscape compatible), SVG
- Import from Obsidian vault (drag-drop zip or folder path)
- Import from Notion export (Markdown + CSV)
- Import from Roam Research JSON export
- Atom/RSS feed of recent notes (for public "digital garden" mode, opt-in)

### Analytics dashboard
- Notes created per day (Recharts bar chart)
- Top 10 tags over time (line chart)
- Knowledge graph density over time
- Word count trends
- Longest gaps (notes not visited in N days)
- Ingestion source breakdown (web / YouTube / file / manual)

### Settings
- Ollama model selector: list available models from Ollama API, pick per feature
- Re-embed all notes (background Celery task)
- Backup: one-click export of full database dump + ChromaDB snapshot
- Restore from backup
- API key management (for optional OpenAI-compatible fallback)
- Theme: light / dark / system
- Language / locale
- Keyboard shortcut customisation

---

## Docker Compose architecture

Services:
- backend      — FastAPI app (port 8000 internal, exposed via nginx)
- frontend     — Nginx serving React build (port 3000)
- postgres     — PostgreSQL 16 (port 5432, not exposed externally)
- chromadb     — ChromaDB server (port 8001, internal only)
- redis        — Redis 7 (port 6379, internal only)
- celery       — Celery worker (no port)
- flower       — Celery monitoring UI (port 5555, dev only)
- nginx        — Reverse proxy (port 80, or 443 with Caddy)
- ollama       — Ollama (port 11434, can point to host Ollama instead)
- neo4j        — Neo4j Community (optional, port 7474/7687, profile: graph)

Environment variables in a single .env file (documented in .env.example).

docker compose up -d             # start everything
docker compose --profile graph up # include Neo4j
docker compose -f docker-compose.dev.yml up  # hot-reload dev mode

Health checks on all services. Restart policy: unless-stopped.
Use named Docker volumes for all persistent data.

---

## Security requirements
- JWT access tokens (15 min) + refresh tokens (7 days) stored in httpOnly cookies
- CSRF protection via double-submit cookie pattern
- Ollama and all databases are NOT exposed outside the Docker network
- Content-Security-Policy and security headers set by Nginx
- Optional: single-user mode (no auth, localhost only) for solo deployment
- Optional: multi-user mode with per-user note isolation (row-level security)
- Input sanitisation on all markdown content (DOMPurify client-side)
- Rate limiting on ingestion and AI endpoints (slowapi)

---

## CI/CD and open-source project setup

GitHub Actions workflows:
1. ci.yml — on every PR:
   - Python: ruff lint, mypy type check, pytest (with postgres + chromadb services)
   - Frontend: ESLint, TypeScript check, Vitest, Playwright E2E
   - Docker: docker compose build (smoke test)
2. release.yml — on tag push (v*.*.*):
   - Build multi-arch Docker images (linux/amd64, linux/arm64)
   - Push to GitHub Container Registry (ghcr.io)
   - Create GitHub Release with auto-generated CHANGELOG
3. docs.yml — on push to main:
   - Build and deploy MkDocs to GitHub Pages

Repository hygiene:
- CONTRIBUTING.md: setup guide, code style, PR process
- CODE_OF_CONDUCT.md (Contributor Covenant)
- SECURITY.md: vulnerability reporting policy
- GitHub issue templates: bug report, feature request, question
- PR template
- Dependabot for weekly dependency updates
- Pre-commit hooks: ruff, black, mypy, prettier, hadolint (Dockerfile linting)

---

## Documentation (MkDocs Material)
Pages:
- Getting Started (quick start, prerequisites, first run)
- Configuration Reference (.env, config.yaml, model selection)
- User Guide (notes, ingestion, AI chat, knowledge graph, search)
- API Reference (auto-generated from FastAPI OpenAPI spec)
- Architecture Overview (diagram of all services)
- Contributing Guide
- Roadmap

---

## Implementation order (build in this sequence)
1. Docker Compose skeleton — all services start, health checks pass
2. Database schema (Alembic migrations) + FastAPI CRUD for notes
3. React frontend scaffold — router, auth pages, notes list + editor
4. Hybrid search (BM25 + ChromaDB + nomic-embed-text via Ollama)
5. AI chat endpoint (RAG pipeline, SSE streaming)
6. Content ingestion pipeline (web, YouTube, file — Celery tasks)
7. Knowledge graph (networkx build + react-force-graph-2d render)
8. Auto-summarisation + smart tagging (background Celery tasks)
9. Browser extension (Chromium MV3 clipper)
10. Analytics dashboard, flashcard export, writing assistant
11. Export/import (Obsidian vault, Notion, Roam)
12. Tests, docs, CI/CD, GitHub repository polish

---

## Additional features to include (open-source differentiators)
- Plugin system: a /plugins directory where community Python modules can add
  new ingestion sources or AI actions, loaded at startup via importlib
- MCP server: expose NeuronVault notes as an MCP tool so external agents
  (Claude Code, Cursor, etc.) can read/write the knowledge base
- CLI tool (Typer): `neuronvault ingest <url>`, `neuronvault chat`, 
  `neuronvault export` — full headless operation for power users
- Obsidian sync compatibility: watch a folder path and auto-import changes
  (for users who edit in Obsidian but want AI features in NeuronVault)
- Voice note capture: record audio in browser → faster-whisper transcribes
  → saved as note (uses local Whisper, no cloud)
- Periodic re-scoring: background job detects stale notes (not opened in 
  30+ days) and surfaces them in the digest and sidebar
- Webhook support: POST to /webhooks/ingest from Zapier/n8n/Make automations
- "Public garden" mode: opt-in flag makes selected notes publicly browsable
  at /garden (static HTML, no auth required, great for digital gardens)

---

## Output format
For each implementation phase, produce:
1. All source files (complete, no placeholders, no TODOs)
2. Updated docker-compose.yml if new services are added
3. Alembic migration files for any schema changes
4. Tests for new functionality
5. Relevant documentation additions

Write production-quality code: async throughout, typed (TypeScript + Pydantic),
error handling, structured logging, no hardcoded secrets.