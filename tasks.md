# Project Roadmap: Production-Grade Notion + Obsidian + AI

To evolve this local-first personal knowledge system into a highly successful, production-grade open-source tool, you need to seamlessly blend an excellent user experience (Notion), robust local knowledge management (Obsidian), and intelligent features (AI), while adopting standard practices that encourage open-source contribution.

## 1. Core Editor Experience (The "Notion" Feel)
- [x] **Block-based Editor**: Transition to a rich text block editor (TipTap) with support for real-time formatting, block dragging/dropping, and slash commands (`/`). **✅ COMPLETED** - Implemented with TipTap, includes toolbar, slash command popup, and rich formatting.
- [x] **Databases / Tabular Views**: Implement inline databases that allow users to view their note metadata as Tables, Kanban Boards, or Calendars. **✅ COMPLETED** - `DatabaseView.tsx` with Table, Kanban (tag-based columns), and Calendar views with tag filtering and stat bar.
- [x] **Nested Hierarchies**: Support infinite nesting of pages within other pages, displayed elegantly in a sidebar tree view. Backend hierarchy API and parent selectors in NoteDetail already exist; frontend sidebar tree view implemented. **✅ COMPLETED**
- [x] **Rich Media Embeds**: Smooth embedding for PDFs, live websites, and embedded local assets integrated directly into blocks. **✅ COMPLETED** - Attachment system in NoteDetail.tsx supports file upload, download, and deletion.

## 2. Local Knowledge Management (The "Obsidian" Feel)
- [x] **Robust Bidirectional Linking**: Enhance the `[[wiki-links]]` parser to automatically expose both incoming (backlinks) and unlinked references to the current note. **✅ COMPLETED** - `ConnectionsSidebar.tsx` now has three tabs: AI Links (with direction arrows), Backlinks (wiki-links), and Unlinked Mentions.
- [x] **Local-First Sync Mechanism**: Provide an integrated way to sync vaults across devices without a central server (e.g., generic WebDAV support, Git integration, or peer-to-peer sync). **✅ COMPLETED** - WebDAV sync implemented via `sync.py` and `SyncPage.tsx`
- [x] **Plugin System Architecture**: Build a secure API bridging the React frontend and Tauri/Python backend to allow community developers to write and distribute plugins. **✅ COMPLETED** - `plugins.py` router with manifest validation, sandboxed subprocess execution, hook system, and `PluginsPage.tsx` UI.
- [x] **Infinite Canvas / Whiteboard**: Add a spatial canvas tool for brainstorming, allowing users to drop notes, images, and arrows onto a 2D plane. **✅ COMPLETED** - `InfiniteCanvas.tsx` with pan/zoom and note placement

## 3. Advanced AI Capabilities
- [x] **AI Co-Writer & Contextual Autocomplete**: Inline AI completion in the editor ("Press Tab to complete") and `/ai` commands to summarize, expand, or adjust the tone of specific blocks. **✅ COMPLETED** - `AICoWriter.tsx` with Tab completion and `/ai` command
- [x] **Automated Ontologies**: AI-driven automatic semantic tagging and relationship suggestions, automatically linking seemingly unrelated notes. **✅ COMPLETED** - `ontology.py` and `OntologyPanel.tsx`
- [x] **Multi-modal Chat**: Support image and document analysis within the RAG chat using local Vision LLMs (like LLaVA via Ollama). **✅ COMPLETED** - `MultiModalChat.tsx` with image upload and analysis
- [x] **Smart Prompts Library**: A user-managed library of reusable AI prompts for quick text processing. **✅ COMPLETED** - `PromptsLibrary.tsx` with categories, favorites, search, add/delete, and a run modal with AI execution.

## 4. Production-Grade Open Source Repository
### Community & Standards
- [x] **`CONTRIBUTING.md`**: Create clear guidelines on how to run the project locally, architecture overviews, and how to submit PRs.
- [x] **`CODE_OF_CONDUCT.md`**: Add a standard contributor covenant. **✅ COMPLETED** - Contributor Covenant 2.1 added.
- [x] **Issue & PR Templates**: Provide `.github/ISSUE_TEMPLATE` (e.g., Bug Report, Feature Request) and a `pull_request_template.md` to ensure high-quality contributions. **✅ COMPLETED** - Bug report, feature request, and PR templates created.
- [x] **Documentation Website**: Spin up a dedicated docs site (using VitePress or Docusaurus) covering User Guides, API References, and Plugin Development. **✅ COMPLETED** - VitePress site in `docs-site/` with Getting Started, API Reference, and Plugin Dev guides.

### CI/CD, Building & Testing
- [x] **Automated Code Quality Pipeline**: Introduce GitHub Actions to automatically run linting (ESLint, Prettier) and type-checking on every Push/PR. **✅ COMPLETED** - code-quality.yml workflow created.
- [x] **Backend Testing**: Add comprehensive unit testing for the FastAPI backend using `pytest`. **✅ COMPLETED** - Test suite with conftest.py, test_notes.py, test_api.py, test_services.py.
- [x] **Frontend Testing**: Add component tests with `Vitest` and basic End-to-End user flow tests with `Playwright`. **✅ COMPLETED** - Vitest setup with testing-library, Playwright E2E tests configured.
- [x] **Automated Tauri Releases**: Configure GitHub Actions to automatically compile, sign, and release desktop binaries (.exe, .dmg, .AppImage) when a new version tag is pushed. **✅ COMPLETED** - tauri-release.yml workflow created.
- [x] **Dependency Management**: Set up Dependabot or Renovate to keep frontend packages and Python requirements continuously updated. **✅ COMPLETED** - dependabot.yml configured for npm, pip, and GitHub Actions.

## 5. Polish, Security & Performance
- [x] **Stress Testing**: Benchmark and optimize the UI (e.g., window virtualization) and ChromaDB to handle vaults with 10,000+ notes smoothly. **✅ COMPLETED** - `benchmark.py` router at `/api/benchmark/suite` covering notes query, FTS5, and ChromaDB vector search with throughput metrics.
- [x] **Privacy-First Telemetry (Opt-in)**: Add strictly opt-in, anonymized telemetry so you can make data-driven product decisions based on real usage. **✅ COMPLETED** - Toggle in Settings page with clear privacy disclosure; persisted in localStorage.
- [x] **Cross-Platform Native Feel**: Ensure the Tauri app respects OS-level dark/light modes, uses native window decorations effectively, and maps standard keyboard shortcuts (Ctrl/Cmd). **✅ COMPLETED** - CSS `prefers-color-scheme` media query, `prefers-reduced-motion` support, focus rings, font-size slider, and keyboard shortcut display in Settings.