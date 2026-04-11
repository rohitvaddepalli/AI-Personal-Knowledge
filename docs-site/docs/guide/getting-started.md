# Getting Started

Second Brain is a local-first personal knowledge management app. It combines the editing experience of Notion with the bidirectional linking of Obsidian, powered by local LLMs via Ollama.

## Prerequisites

- **Node.js** ≥ 18
- **Python** ≥ 3.10
- **Ollama** — [Install Ollama](https://ollama.com/download) and pull a model: `ollama pull qwen2.5:0.5b`

## Installation

### 1. Clone the repository

```bash
git clone https://github.com/rohitvaddepalli/AI-Personal-Knowledge.git
cd AI-Personal-Knowledge
```

### 2. Start the Python backend

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 3. Start the React frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## First Steps

1. **Create your first note** — Click "+ New Note" or press `Ctrl+N`
2. **Try the block editor** — Type `/` to open the slash command menu
3. **Link notes** — Use `[[Note Title]]` to create wiki-links
4. **Ask the AI** — Navigate to "Ask Brain" and chat with your knowledge base
5. **Explore Database View** — Click "Database" in the sidebar to see Table/Kanban/Calendar

## Running as a Desktop App (Tauri)

```bash
cd frontend
npm run tauri:dev
```

The Tauri desktop app bundles the Python backend as a sidecar automatically.

## Configuration

All key settings are accessible via the **Settings** page:
- **Active AI Model** — choose which Ollama model to use
- **Ollama Host** — change if running Ollama on a remote machine
- **Privacy/Telemetry** — opt-in to anonymous usage analytics
- **Appearance** — adjust font size and reduce motion
