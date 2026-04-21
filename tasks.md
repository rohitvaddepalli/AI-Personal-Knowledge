# Second Brain - Product + Prompt Alignment Tasks

This task list aligns the current project with `Prompt.md` and adds the product improvements needed to make the app more user-friendly, habit-forming, and trustworthy.

## Current Alignment Snapshot

### Already aligned (good foundation)
- FastAPI backend and React + TypeScript frontend are in place.
- Core note CRUD, templates, collections, daily notes, basic versioning, and trash flows exist.
- Hybrid search and RAG chat endpoints exist.
- Local Ollama model selection and chat session persistence exist.
- Knowledge graph, review/spaced repetition, plugins page, and desktop runtime are present.
- URL import and voice memo/transcription support are already started.

### Partially aligned (needs upgrades)
- Hybrid search quality/re-ranking and retrieval controls need improvement.
- AI chat citations exist but trust UX and grounding transparency are limited.
- Smart tagging exists, but approval/rejection flow and NER pipeline are incomplete.
- Analytics and dashboard loops exist, but behavior-driven habit loops are weak.
- Writing assistant APIs exist, but editor-side integrated UX is incomplete.
- Export/import exists in parts but not full interoperability targets.

### Not aligned / missing (high gaps vs Prompt)
- Prompt asks for Postgres + Redis + Celery + full background task architecture; current app is mainly SQLite + immediate calls.
- Prompt asks for richer ingestion stack (Docling, YouTube deep handling, extension clipper).
- Prompt asks for streaming AI responses via SSE; current ask flow is mostly non-streaming response.
- Prompt asks for stronger security model (JWT+refresh, CSRF, rate limiting policy at scale).
- Prompt asks for stricter CI coverage and broader test matrix.
- Prompt asks for command-palette-first UX and richer search filters/history.

## Execution Plan (Prioritized)

## Phase 1 - Product Trust and UX Baseline (Must do now)

### 1.1 RAG trust and answer quality
- [x] Support both retrieval styles: default global retrieval across the knowledge base, plus optional `@mention`-scoped retrieval for explicit note targeting.
- [x] Add modes in Ask Brain: `Auto`, `Search only`, `Strict cited answers`.
- [x] Show per-answer confidence + retrieval explanation ("why these sources").
- [x] Add citation chips linking to exact note anchors/snippets.
- [x] Add fallback response policy when grounding is weak (ask clarifying question, suggest related notes).

### 1.2 Remove UX trust breakers
- [x] Replace all `alert`, `confirm`, `prompt` with app dialogs/toasts.
- [x] Hide or clearly badge unimplemented capture tabs (YouTube/upload/quick) until shipped.
- [x] Standardize loading, empty, and error states across Notes, Ask, Dashboard, Review.
- [x] Rename misleading labels (example: `NoteList` header "Analytics" -> "Notes").

### 1.3 API consistency and runtime reliability
- [x] Replace hardcoded API URLs in frontend with shared `apiUrl()` utility everywhere.
- [x] Audit desktop/web behavior for all fetch calls after migration.
- [x] Add global fetch error normalization and user-facing retry actions.

## Phase 2 - Habit Loop and User-Friendliness (Must)

### 2.1 Build a clear daily loop
- [x] Add "Inbox" as the first-class capture destination.
- [x] Add triage actions: summarize, tag, link, schedule review, archive.
- [x] Add dashboard "Today" section: Capture -> Connect -> Review progress.
- [x] Add "next best action" card to guide users when they open the app.

### 2.2 Onboarding and progressive disclosure
- [x] Add first-run onboarding with goal selection (student/researcher/creator/developer).
- [x] Import sample notes on first run to demonstrate RAG + graph quickly.
- [x] Add beginner mode with only 4 core actions (Capture, Search, Ask, Review) — core nav always visible; Advanced items behind expander.
- [x] Move advanced surfaces behind "Advanced" navigation.

### 2.3 Command-driven productivity
- [x] Implement global command palette (`Ctrl/Cmd+K`) with actions + search.
- [x] Support quick actions: new note, open daily note, ask question, import URL, review due.
- [x] Persist recent commands and search history locally.

## Phase 3 - Core Feature Completion vs Prompt (Should)

### 3.1 Ingestion pipeline completion
- [ ] Implement production-grade URL ingestion with metadata extraction and robust fallback.
- [ ] Complete YouTube ingestion pipeline (captions -> audio -> transcription fallback).
- [ ] Complete file upload ingestion pipeline (PDF/DOCX/PPTX/MD/TXT/HTML).
- [ ] Add voice dictation note capture (speech-to-text): user dictates, sees live transcript, and saves directly to a new note or Inbox.
- [ ] Add push-to-talk and hands-free modes with pause/resume, punctuation assist, and language/accent selection.
- [ ] Add optional post-processing on dictated text (cleanup, paragraph formatting, title suggestion, tag suggestion).
- [ ] Add ingestion job queue status and progress UI.

### 3.2 Smart tagging and connections
- [ ] Add NER-powered tag suggestion pipeline.
- [ ] Add user review flow for tag suggestions (accept/reject/edit).
- [ ] Add related-notes sidebar in note detail/editor with one-click bidirectional links.
- [ ] Add stale note resurfacing signals to related suggestions.

### 3.3 Writing assistant in editor
- [ ] Integrate autocomplete and AI edit APIs in `NoteEditor` UX.
- [ ] Add "Continue writing", "Rewrite", "Explain", "Translate" actions for selection.
- [ ] Add keyboard shortcuts for assistant actions and inline accept/reject.

### 3.4 Flashcards + review depth
- [ ] Add AI flashcard generation from note content.
- [ ] Add flashcard set management and quality-of-recall analytics.
- [ ] Add export to Anki-compatible format.

## Phase 4 - Architecture Alignment with Prompt (Should/Longer Track)

### 4.1 Data and job architecture migration
- [ ] Introduce Postgres as primary store while keeping local-first defaults clear.
- [ ] Introduce Redis + Celery for ingestion, embedding, summarization, re-indexing jobs.
- [ ] Add Alembic migration baseline and migration workflow docs.
- [ ] Move heavy tasks out of request-response path.

### 4.2 Search + RAG pipeline hardening
- [ ] Implement stronger hybrid pipeline (BM25 + vector + RRF merge).
- [ ] Add configurable top-k, filters (tags/date/source/summary/flashcards), and rerank tuning.
- [ ] Add prompt-injection-safe context handling for all ingestion sources.
- [ ] Add streaming answer transport (SSE) for chat and long AI operations.

### 4.4 Low-end PC optimization track
- [ ] Add "Low Resource Mode" toggle (smaller models, lower context window, reduced concurrency).
- [ ] Provide model presets by RAM tier (4 GB / 8 GB / 16 GB+) with safe defaults.
- [ ] Defer heavy embeddings/summarization to background queue and throttle CPU usage.
- [ ] Add lazy loading and route-level code splitting checks for all heavy frontend pages.
- [ ] Add lightweight graph mode (cap nodes/edges, progressive rendering, optional static preview).
- [ ] Add "battery/performance saver" UI mode (reduced animations, lower refresh frequency).
- [ ] Add startup profiling and memory budget checks in desktop runtime.
- [ ] Add a compact always-visible resource monitor widget pinned to a screen corner (user-configurable corner).
- [ ] Show quick stats in collapsed state (CPU, RAM, active model/task indicator) with very low polling overhead.
- [ ] Expand on click into detailed panel (CPU/RAM history, queue depth, model usage, embedding/indexing status, recent heavy operations).
- [ ] Add thresholds and visual warnings (yellow/red) for high CPU/RAM and suggest one-click actions (pause indexing, switch to low resource mode).
- [ ] Ensure monitor works in both web and desktop runtime with graceful fallback where system metrics are unavailable.

### 4.3 Security hardening
- [ ] Add auth modes: single-user localhost mode and optional multi-user mode.
- [ ] Add JWT access/refresh flow with secure cookies and CSRF strategy.
- [ ] Add rate limiting on ingestion and AI endpoints.
- [ ] Add markdown sanitization and stricter upload validation.

### 4.5 Multi-provider API key support (user-managed)
- [ ] Add provider abstraction layer for LLM calls (Ollama local + external providers).
- [ ] Add settings UI for user-provided API keys: Google, OpenAI, OpenRouter, Anthropic, and extensible custom providers.
- [ ] Add per-feature provider/model routing (chat, summarize, embeddings, edit, transcription assist).
- [ ] Store secrets securely (desktop secure storage/keychain where available; encrypted-at-rest fallback).
- [ ] Add key validation and health checks without exposing keys in logs/errors.
- [ ] Add privacy controls: explicit opt-in for cloud providers, with local-only mode as default.
- [ ] Add cost/usage guardrails (token caps, per-provider limits, warning thresholds).
- [ ] Add provider fallback chain (preferred provider -> backup provider -> local Ollama fallback).
- [ ] Refactor backend AI code into `backend/app/llm/` to avoid scattered logic across routers/services.
- [ ] Create `backend/app/llm/providers/` modules (ollama, openai, anthropic, google, openrouter, custom).
- [ ] Add shared `backend/app/llm/router.py` for provider selection, fallback chain, and policy checks.
- [ ] Add `backend/app/llm/prompts.py` and `backend/app/llm/types.py` for reusable prompt templates and typed request/response contracts.
- [ ] Migrate current AI call sites (`ask.py`, `notes.py`, `rag_service.py`, `insight_engine.py`) to use the new `app.llm` abstraction.

## Phase 5 - Retention and "Addictive" Product Layer (Healthy)

### 5.1 Personal momentum surfaces
- [ ] Add streaks and small daily targets (e.g., 5-minute knowledge ritual).
- [ ] Add weekly digest with "what you captured", "what you connected", "what to revisit".
- [ ] Add "On this day" and "forgotten notes" resurfacing widgets.

### 5.2 Insight-driven delight loops
- [ ] Add automatic cross-note synthesis notes (weekly).
- [ ] Add "surprise me" upgrades: random note + why it matters now.
- [ ] Add milestone moments (first 100 notes, first 50 links, first 7-day streak).

### 5.3 Personalization
- [ ] Learn user pattern and adapt dashboard cards (writer/researcher/student mode).
- [ ] Let users configure cadence for resurfacing and digest style.
- [ ] Add focus mode presets (capture mode, writing mode, review mode).

## Phase 6 - Interoperability and Ecosystem (Could)

### 6.1 Import/export parity
- [ ] Full Obsidian vault export/import parity with attachments.
- [ ] Notion/Roam import polish.
- [ ] Graph export as JSON/SVG with compatibility docs.

### 6.2 Plugin + automation ecosystem
- [ ] Finalize plugin loading lifecycle and safety boundaries.
- [ ] Add webhook ingestion endpoints.
- [ ] Add CLI workflows for ingest/chat/export.

### 6.3 Public garden and extension
- [ ] Add opt-in public notes/garden mode.
- [ ] Build browser clipper extension (MV3) with selection/full-page modes.

## Quality Gates (Do for each phase)
- [ ] Add/expand unit tests for backend services and routers.
- [ ] Add component and integration tests for key frontend flows.
- [ ] Add E2E tests for capture -> ask -> review -> export paths.
- [ ] Update docs for every shipped feature.
- [ ] Ensure no placeholder UI for unavailable features.

## Immediate Next Sprint (Recommended)
- [ ] Replace browser dialogs and unify toast/modal UX.
- [ ] Migrate all frontend API calls to `apiUrl()` path handling.
- [ ] Improve Ask Brain retrieval defaults + add trust/citation UX.
- [ ] Ship Inbox + triage flow as the first daily habit loop.
- [ ] Add onboarding with sample data and guided first "aha".