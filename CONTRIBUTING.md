# Contributing to Second Brain AI

Thank you for considering contributing to **Second Brain AI**! Every contribution — bug reports, feature requests, documentation improvements, or code — helps make this project better for everyone.

---

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Architecture Overview](#architecture-overview)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Backend Setup](#backend-setup)
  - [Frontend Setup](#frontend-setup)
  - [Desktop (Tauri) Setup](#desktop-tauri-setup)
- [Development Workflow](#development-workflow)
- [Code Style & Conventions](#code-style--conventions)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Reporting Bugs & Requesting Features](#reporting-bugs--requesting-features)

---

## Code of Conduct

This project follows the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating you agree to uphold it. Please report unacceptable behaviour to the maintainers.

---

## Architecture Overview

```
AI-Personal-Knowledge/
├── backend/               # FastAPI (Python 3.11+)
│   ├── app/
│   │   ├── main.py        # App entry, middleware, router registration
│   │   ├── config.py      # Pydantic settings (env / .env)
│   │   ├── database.py    # SQLAlchemy engine + session
│   │   ├── runtime.py     # Desktop-specific directory setup
│   │   ├── models/        # SQLAlchemy ORM models
│   │   ├── schemas/       # Pydantic request/response schemas
│   │   ├── routers/       # API route handlers
│   │   ├── services/      # Business logic (RAG, search, embeddings, graph)
│   │   └── tasks/         # Background tasks (insight engine)
│   ├── pyproject.toml     # Python dependencies & build config
│   └── run_sidecar.py     # Entry point when running as Tauri sidecar
│
├── frontend/              # React 18 + Vite + TypeScript + Tailwind CSS
│   ├── src/
│   │   ├── App.tsx        # Root layout, routing, navigation
│   │   ├── index.css      # Global CSS variables & Tailwind imports
│   │   ├── main.tsx       # React DOM render entry
│   │   ├── components/    # Shared UI components
│   │   ├── context/       # React contexts (Desktop runtime, Download)
│   │   └── pages/         # Route-level page components
│   ├── src-tauri/         # Tauri (Rust) desktop shell
│   │   ├── tauri.conf.json
│   │   └── src/           # Rust glue code
│   ├── package.json
│   └── tailwind.config.cjs
│
├── scripts/               # Build & release helper scripts
│   └── build_sidecar.py   # Package Python backend as Tauri sidecar
│
├── docker-compose.yml     # One-command Docker dev environment
└── .github/               # CI/CD workflows, issue & PR templates
```

### Key Concepts

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Database** | SQLite + SQLAlchemy | Relational storage for notes, collections, tasks, etc. |
| **Vector DB** | ChromaDB | Semantic search via embeddings |
| **LLM** | Ollama (local) | RAG chat, AI insights, summarisation |
| **Graph** | NetworkX | Knowledge graph analysis |
| **Frontend** | React + Vite + Tailwind | SPA with lazy-loaded pages |
| **Desktop** | Tauri v2 | Native desktop shell; bundles a Python sidecar |

---

## Getting Started

### Prerequisites

| Tool | Version | Required For |
|------|---------|-------------|
| **Python** | 3.11+ | Backend |
| **Node.js** | 20+ | Frontend |
| **npm** | 10+ | Frontend |
| **Ollama** | latest | Local AI inference |
| **Rust** | stable | Desktop (Tauri) only |
| **Docker** | latest | Docker-based dev (optional) |

### Backend Setup

```bash
cd backend

# Create a virtual environment (recommended)
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS / Linux
source .venv/bin/activate

# Install dependencies
pip install -e .

# Start the API server (hot-reload)
uvicorn app.main:app --reload
```

The API will be available at **http://localhost:8000** with interactive docs at `/docs`.

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start Vite dev server
npm run dev
```

The UI will be available at **http://localhost:5173** (or the port Vite assigns).

### Desktop (Tauri) Setup

> Only needed if you're working on the native desktop wrapper.

```bash
# 1. Install frontend deps
cd frontend && npm install

# 2. Install backend with desktop extras
cd ../backend && pip install -e .[desktop]

# 3. Build the Python sidecar binary
cd ..
python scripts/build_sidecar.py --target x86_64-pc-windows-msvc

# 4. Launch the Tauri dev shell
cd frontend && npm run tauri:dev
```

---

## Development Workflow

1. **Fork** the repository and clone your fork.
2. Create a **feature branch** from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```
3. Make your changes with clear, atomic commits.
4. Run linting and tests locally before pushing (see [Code Style](#code-style--conventions)).
5. Push your branch and open a **Pull Request** against `main`.

### Branch Naming Convention

| Prefix | Purpose | Example |
|--------|---------|---------|
| `feat/` | New feature | `feat/block-editor` |
| `fix/` | Bug fix | `fix/search-crash` |
| `docs/` | Documentation | `docs/api-reference` |
| `refactor/` | Code refactor | `refactor/note-service` |
| `test/` | Adding/updating tests | `test/rag-service` |
| `ci/` | CI/CD changes | `ci/add-lint-action` |

---

## Code Style & Conventions

### Python (Backend)

- **Formatter**: Follow PEP 8. We recommend using `black` and `isort`.
- **Type hints**: Use type annotations for all function signatures.
- **Pydantic**: Use Pydantic models for request/response schemas.
- **SQL**: All DB access goes through SQLAlchemy models — no raw SQL in routers.

### TypeScript (Frontend)

- **Strict mode**: `tsconfig.json` has strict checks enabled.
- **Components**: Use functional components with hooks.
- **Styling**: Tailwind CSS utility classes + CSS variables defined in `index.css`.
- **Imports**: Use path aliases where configured; prefer named exports.

### General

- Keep PRs small and focused on a single concern.
- Write meaningful commit messages (imperative mood: "Add search filter", not "Added search filter").
- Add/update tests for any behaviour changes.
- Don't commit IDE config, `.env` files, or `node_modules/`.

---

## Submitting a Pull Request

1. Ensure your branch is up to date with `main`.
2. Confirm all checks pass locally (lint, type-check, tests).
3. Fill in the **PR template** — describe *what* changed and *why*.
4. Link any related issues (e.g., `Closes #42`).
5. Request review from a maintainer.

### What We Look For in Reviews

- [ ] Code follows the conventions above
- [ ] No unrelated changes mixed in
- [ ] New features include tests
- [ ] Public API changes are documented
- [ ] No secrets, credentials, or personal data committed

---

## Reporting Bugs & Requesting Features

- **Bug reports**: Use the [Bug Report](.github/ISSUE_TEMPLATE/bug_report.md) template.
- **Feature requests**: Use the [Feature Request](.github/ISSUE_TEMPLATE/feature_request.md) template.
- **Questions**: Open a Discussion or reach out in Issues.

Thank you for helping build Second Brain AI! 🧠
