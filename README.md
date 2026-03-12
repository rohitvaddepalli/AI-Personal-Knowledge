# 🧠 Second Brain AI

Welcome to your **AI-Powered Personal Knowledge Management System**. This project is a "local-first" second brain designed to help you capture, organize, and synthesize your thoughts with the power of private LLMs.

---

## ✨ Core Features

### 🔍 Intelligence & Search
- **Ask Your Brain**: RAG-based (Retrieval-Augmented Generation) chat allowing you to query your entire knowledge base.
- **Hybrid Search**: Combines traditional keyword search with vector-based semantic search using **ChromaDB**.
- **AI Insights**: Automatically generate summaries, key takeaways, and connections between your notes.

### 📥 Smart Captures
- **YouTube Imports**: Automatically extract transcripts and metadata from YouTube videos using `yt-dlp`.
- **Web Scraping**: Import content directly from URLs with clean text extraction.
- **Attachments**: Support for various file types attached directly to your notes.

### 🕸️ Knowledge Visualization
- **Interactive Graph**: Visualize your notes as nodes in a 2D knowledge graph, revealing hidden connections.
- **Connections API**: Manually or automatically link related notes together.

### 🛠️ Advanced Organization
- **Daily Notes**: A dedicated space for journaling and daily logs.
- **Collections**: Group related notes into logical buckets.
- **Templates**: Create and reuse note structures for meetings, project logs, etc.
- **Version Control**: Full history of note edits with the ability to revert to previous versions.
- **Spaced Repetition**: A dedicated "Review" system for active recall of your knowledge.

---

## 🚀 Tech Stack

- **Frontend**: React 18, Vite, TypeScript, Tailwind CSS, Framer Motion.
- **Backend**: FastAPI (Python 3.11), SQLAlchemy, Pydantic.
- **AI/LLM**: Ollama (Local), ChromaDB (Vector DB), NetworkX (Graph Analysis).
- **Database**: SQLite (Relational data).

---

## 🛠️ Getting Started

### Prerequisites
- [Docker & Docker Compose](https://www.docker.com/products/docker-desktop/) (Recommended)
- [Ollama](https://ollama.com/) (For local AI)
- [Node.js](https://nodejs.org/) & [Python 3.11+](https://www.python.org/) (For manual setup)

### Option 1: Docker (Preferred)
1. **Clone & Setup**:
   ```bash
   git clone https://github.com/rohitvaddepalli/AI-Personal-Knowledge.git
   cd "AI Personal Knowledge"
   ```
2. **Run Everything**:
   ```bash
   docker-compose up -d --build
   ```
3. **Access**:
   - **Frontend**: [http://localhost:3000](http://localhost:3000)
   - **API Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)

### Option 2: Manual Development Setup
#### Backend
1. Navigate to backend: `cd backend`
2. Install dependencies: `pip install -r pyproject.toml` (or use `.venv`)
3. Run server: `uvicorn app.main:app --reload`

#### Frontend
1. Navigate to frontend: `cd frontend`
2. Install dependencies: `npm install`
3. Run dev server: `npm run dev`

---

## 🤖 Model Configuration

This system relies on **Ollama** for privacy. Ensure Ollama is running, then pull the recommended models:

```bash
# Pull the default LLM
ollama pull qwen2.5:0.5b

# Pull embedding model (if configured)
ollama pull nomic-embed-text
```

You can manage and change models directly from the **Settings** page within the app.

---

## 🎨 Design Philosophy
The UI follows an **"Organic & Calm"** aesthetic. It prioritizes focus, clarity, and smooth transitions to reduce cognitive load while managing your knowledge.

---

## 📄 License
MIT License. See [LICENSE](LICENSE) for details.
