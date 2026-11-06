# Contributing to Second Brain

We welcome contributions! This guide will get you set up quickly.

## Development Setup

```bash
git clone https://github.com/your-org/second-brain.git
cd second-brain

# Backend
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp ../.env.example ../.env
uvicorn app.main:app --reload

# Frontend (new terminal)
cd frontend
npm ci
npm run dev
```

## Running Tests

```bash
# Backend
cd backend
pytest tests/ --tb=short -q

# Frontend
cd frontend
npm run type-check
npm run lint
npm test
```

## Code Style

- **Backend**: `ruff format` + `ruff check` (configured in `pyproject.toml`)
- **Frontend**: ESLint + TypeScript strict mode
- All CI checks must pass before merge

## Commit Convention

```
feat: add daily digest page
fix: correct SM-2 scheduling off-by-one
docs: add ingestion guide
chore: bump ruff to 0.8
```

## Pull Request Process

1. Fork → feature branch (`feat/my-feature`)
2. Write tests for new functionality
3. Ensure all CI checks pass
4. Open PR with description of what/why/how
5. Wait for review — we aim to respond within 48 hours

## Reporting Bugs

Use GitHub Issues. Include:
- Steps to reproduce
- Expected vs actual behavior
- Backend version (`/api/health`)
- Logs from `docker compose logs backend`

## Security Issues

**Do not** open public GitHub Issues for security vulnerabilities. See [SECURITY.md](../SECURITY.md) for the responsible disclosure process.
