# 🧠 Second Brain AI

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Python: 3.11](https://img.shields.io/badge/python-3.11-blue.svg)](https://www.python.org/)
[![React: 18](https://img.shields.io/badge/react-18-61dafb.svg)](https://react.dev/)
[![Docker: Compose](https://img.shields.io/badge/docker-compose-2496ed.svg)](https://www.docker.com/)

A production-grade, local-first **AI-Powered Personal Knowledge Management System**. Second Brain AI helps you capture, synthesize, and interconnect your notes, web captures, and multimedia using private local LLMs.

The application natively supports a dual-target architecture: run it as a **hardened, containerized web service** or as a **lightweight, offline-first desktop application**.

---

## ✨ Key Features

### 🔍 Intelligence & Semantic Search
- **Ask Your Brain (RAG)**: Chat with your entire knowledge vault with citation-grounded Retrieval-Augmented Generation.
- **Hybrid Search**: Combines keyword search with vector semantic search powered by **ChromaDB**.
- **Automated Insights**: Automatically generates summaries, action items, and topic linkages.

### 📥 Smart Capture & Ingestion
- **YouTube Ingestion**: Extracts video transcripts, chapters, and metadata using `yt-dlp`.
- **Web Scraping**: Imports articles and web pages with clean markdown text extraction.
- **File Attachments**: Stores and indexes documents, PDFs, and images.

### 🕸️ Knowledge Visualization & Synthesis
- **Interactive 2D Graph**: Explores notes and conceptual linkages visually with force-directed physics.
- **Bi-Directional Connections**: Links related thoughts automatically or manually.
- **Daily Notes & Journaling**: Fast calendar-linked daily logging.
- **Collections & Templates**: Organizes notes into workspaces and reusable structured templates.
- **Spaced Repetition Review**: Flashcard system for active recall of critical concepts.

### 🛡️ Production-Grade Architecture
- **Dual Runtime Target**: Seamlessly switches between `APP_MODE=web` (multi-tenant containerized web) and `APP_MODE=desktop` (local loopback SQLite mode).
- **Hardened Security**: Startup validation requires strong `SECRET_KEY` in production; secure cookie flags, strict reverse-proxy headers, and non-root Docker execution (`UID 10001`).
- **Observability**: Healthcheck endpoint (`/api/system/health`) reports database, vector store, and LLM statuses with automatic degradation handling.
- **Client Bundle Optimization**: Route-level code-splitting with `React.lazy` and manual Rollup vendor chunks for fast page loads (~47 kB entry bundle).

---

## 🚀 Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, TypeScript 5, Vite 5, Tailwind CSS, TipTap Editor, Lucide Icons |
| **Backend** | FastAPI, Python 3.11, SQLAlchemy 2, Pydantic 2, Alembic, Celery |
| **Data & Storage** | PostgreSQL 16 (production) / SQLite (desktop), ChromaDB (Vector DB), Redis 7 (Broker/Cache) |
| **AI / Inference** | Ollama (Local LLMs, e.g. `qwen2.5:0.5b`, `nomic-embed-text`), Optional Cloud APIs (OpenAI, Anthropic, Gemini) |
| **Infra & Tooling** | Docker & Docker Compose, Nginx Alpine, `uv` package manager, Vitest, Ruff, Pytest, Tauri |

---

## 🏁 Getting Started

### Prerequisites
- [Docker & Docker Compose](https://www.docker.com/products/docker-desktop/) (Recommended for web deployment)
- [Ollama](https://ollama.com/) (For private local AI inference)
- [Node.js 20+](https://nodejs.org/) & [Python 3.11+](https://www.python.org/) with [`uv`](https://docs.astral.sh/uv/) (For manual/desktop setup)

---

### Option 1: Docker Compose (Recommended for Web)

Run the full production stack (Nginx, React Frontend, FastAPI Backend, Celery Worker, PostgreSQL, Redis, and Ollama) with a single command:

1. **Clone the repository**:
   ```bash
   git clone https://github.com/rohitvaddepalli/AI-Personal-Knowledge.git
   cd AI-Personal-Knowledge
   ```

2. **Configure environment (optional)**:
   ```bash
   cp .env.example .env
   # In production, make sure to generate a strong secret key:
   # SECOND_BRAIN_AUTH_SECRET_KEY=$(openssl rand -hex 32)
   ```

3. **Start the stack**:
   ```bash
   docker compose up -d --build
   ```

4. **Access the application**:
   - **Web UI**: [http://localhost](http://localhost) (Nginx reverse proxy on port 80)
   - **System Health**: [http://localhost/api/system/health](http://localhost/api/system/health)
   - **API Documentation**: [http://localhost:8000/docs](http://localhost:8000/docs)

---

### Option 2: Local Development Setup

#### 1. Backend Setup
```bash
cd backend

# Create virtual environment and install dependencies using uv
uv venv
# On Windows: .venv\Scripts\activate; On Linux/macOS: source .venv/bin/activate
uv pip install -e .

# Run the FastAPI server
uv run uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

#### 2. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

### Option 3: Tauri Desktop Application

The desktop target embeds the React UI and launches the FastAPI backend as an offline Python sidecar on `127.0.0.1:31415`.

```bash
# 1. Install frontend & backend dependencies
cd frontend && npm install
cd ../backend && pip install -e .[desktop]

# 2. Package sidecar for your target architecture
cd ..
python scripts/build_sidecar.py --target x86_64-pc-windows-msvc

# 3. Launch Tauri in development mode
cd frontend
npm run tauri:dev
```

To build a standalone desktop installer:
```bash
cd frontend
npm run tauri:build
```

---

## ⚙️ Configuration Reference

Configuration is managed via environment variables (or `.env` file). All variables are prefixed with `SECOND_BRAIN_`:

| Variable | Default | Description |
| :--- | :--- | :--- |
| `SECOND_BRAIN_APP_MODE` | `desktop` | Runtime mode: `desktop` (SQLite, loopback) or `web` (PostgreSQL, CORS, reverse proxy) |
| `SECOND_BRAIN_ENVIRONMENT` | `development` | Environment: `development`, `production`, or `test` |
| `SECOND_BRAIN_DATABASE_MODE` | `local` | Database engine: `local` (SQLite) or `postgres` |
| `SECOND_BRAIN_DATABASE_URL` | Auto-generated | Connection string (e.g. `postgresql+psycopg://user:pass@host:5432/db`) |
| `SECOND_BRAIN_AUTH_SECRET_KEY` | `change-me-in-production` | Secret key for JWT auth tokens. Enforced in `production` + `web` mode. |
| `SECOND_BRAIN_AUTH_COOKIE_SECURE`| `false` | Set `true` when serving behind HTTPS/TLS |
| `SECOND_BRAIN_OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama API endpoint (`http://ollama:11434` in Docker) |
| `SECOND_BRAIN_LLM_MODEL` | `qwen2.5:0.5b` | Default Ollama model for chat and synthesis |
| `SECOND_BRAIN_EMBEDDING_MODEL` | `nomic-embed-text` | Vector embedding model name |
| `SECOND_BRAIN_REDIS_URL` | `redis://127.0.0.1:6379/0` | Redis URL for Celery background workers and rate limiting |

---

## 🤖 Model Setup (Ollama)

Second Brain utilizes **Ollama** for private local inference. Ensure Ollama is running and pull the recommended models:

```bash
# Chat and synthesis model
ollama pull qwen2.5:0.5b

# Vector embeddings model
ollama pull nomic-embed-text
```

You can customize the active models anytime under the **Settings** tab in the UI.

---

## 🧪 Quality Gates & Testing

Run the test and verification suites across the codebase:

```bash
# Frontend Linting (ESLint 9, 0 warnings required)
cd frontend && npm run lint

# Frontend Unit Tests (Vitest)
cd frontend && npm run test:run

# Frontend Production Build (Zero chunk warnings)
cd frontend && npm run build

# Backend Linting (Ruff)
cd backend && uv run ruff check app tests

# Backend Test Suite (Pytest - 90 tests)
cd backend && uv run pytest

# Docker Compose Configuration Validation
docker compose config
```

---

## 📂 Project Structure

```
AI-Personal-Knowledge/
├── backend/
│   ├── app/
│   │   ├── models/        # SQLAlchemy database models
│   │   ├── routers/       # FastAPI REST endpoints
│   │   ├── schemas/       # Pydantic request/response schemas
│   │   ├── services/      # Business logic & AI/RAG pipelines
│   │   └── config.py      # Dual-mode runtime settings & validation
│   ├── tests/             # Pytest test suite (90 tests)
│   ├── Dockerfile         # Multi-stage non-root Python 3.11 container
│   └── pyproject.toml     # Backend dependencies & metadata
├── frontend/
│   ├── src/
│   │   ├── components/    # Reusable UI & block editor components
│   │   ├── pages/         # Route pages (code-split via React.lazy)
│   │   └── context/       # State and runtime context providers
│   ├── Dockerfile         # Multi-stage Nginx static web container
│   └── vite.config.ts     # Vite configuration with manual vendor chunks
├── nginx.conf             # Hardened reverse proxy configuration
├── docker-compose.yml     # Multi-container orchestration definition
└── .env.example           # Environment variable template
```

---

## 📄 License

This project is open-source under the [MIT License](LICENSE).
