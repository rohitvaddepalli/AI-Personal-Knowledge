from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from app.database import Base, engine
from app.routers import notes, connections, graph, ask, search, import_, collections, insights, chat as chat_router, tasks, templates, attachments, note_versions, review, export, system, voice, plugins, benchmark
from app.models import note, connection, collection, insight, chat, task, template, attachment, note_version
from sqlalchemy import text
from app.config import settings
from app.runtime import ensure_app_directories, load_runtime_settings
import ipaddress
import secrets

ensure_app_directories()
load_runtime_settings()


def _is_loopback_host(host: str) -> bool:
    normalized = (host or "").strip().lower()
    if normalized in {"", "localhost", "testclient"}:
        return True

    try:
        return ipaddress.ip_address(normalized).is_loopback
    except Exception:
        return False


def _is_local_only_binding() -> bool:
    return _is_loopback_host(settings.api_host)

# Create all database tables
Base.metadata.create_all(bind=engine)

with engine.begin() as conn:
    try:
        existing_columns = {
            row[1]
            for row in conn.execute(text("PRAGMA table_info('notes')")).fetchall()
        }

        needed_columns = [
            ("is_pinned", "is_pinned BOOLEAN DEFAULT 0"),
            ("deleted_at", "deleted_at DATETIME"),
            ("review_count", "review_count INTEGER DEFAULT 0"),
            ("next_review_at", "next_review_at DATETIME"),
            ("last_reviewed_at", "last_reviewed_at DATETIME"),
            ("parent_note_id", "parent_note_id VARCHAR"),
            ("order", '"order" INTEGER DEFAULT 0'),
        ]

        for name, column_sql in needed_columns:
            if name in existing_columns:
                continue
            conn.execute(text(f"ALTER TABLE notes ADD COLUMN {column_sql}"))
    except Exception as e:
        print(f"DB migration check error: {e}")

# FTS5 Setup
with engine.begin() as conn:
    try:
        conn.execute(text("CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(id UNINDEXED, title, content, tags);"))
        
        # Populate initially if empty
        conn.execute(text("""
            INSERT INTO notes_fts(id, title, content, tags) 
            SELECT id, title, content, tags FROM notes 
            WHERE id NOT IN (SELECT id FROM notes_fts);
        """))

        # Triggers
        conn.execute(text("""
        CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
            INSERT INTO notes_fts(id, title, content, tags) VALUES (new.id, new.title, new.content, new.tags);
        END;"""))

        conn.execute(text("""
        CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
            DELETE FROM notes_fts WHERE id=old.id;
        END;"""))

        conn.execute(text("""
        CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
            DELETE FROM notes_fts WHERE id=old.id;
            INSERT INTO notes_fts(id, title, content, tags) VALUES (new.id, new.title, new.content, new.tags);
        END;"""))
    except Exception as e:
        print(f"FTS Table setup error (FTS5 might not be enabled on this SQLite build): {e}")

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data:; "
            f"connect-src 'self' {settings.ollama_base_url};"
        )
        return response

class AccessControlMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        # Protect the API surface area by default. This app is typically run locally.
        if request.url.path.startswith("/api/"):
            if settings.api_key:
                provided = request.headers.get("x-api-key") or ""
                if not secrets.compare_digest(provided, settings.api_key):
                    return JSONResponse({"detail": "Unauthorized"}, status_code=401)
            elif not settings.allow_remote_clients:
                # If the server itself is bound to loopback, the socket already limits access.
                if _is_local_only_binding():
                    return await call_next(request)

                # No API key configured: only allow loopback clients.
                host = (request.client.host if request.client else "") or ""
                if not _is_loopback_host(host):
                    return JSONResponse({"detail": "Remote access disabled"}, status_code=403)

        return await call_next(request)

app = FastAPI(
    title="Second Brain AI",
    description="AI-Powered Personal Knowledge System MVP API",
    version="0.1.0"
)

app.add_middleware(AccessControlMiddleware)
app.add_middleware(SecurityHeadersMiddleware)

# CORS setup
# In a desktop app/local environment, localhost is generally safe.
# Avoid "*" in any production-ready deployment.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:4173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:4173",
        "http://127.0.0.1:3000",
        "tauri://localhost",
        "http://tauri.localhost",
        "https://tauri.localhost",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(notes.router)
app.include_router(connections.router)
app.include_router(graph.router)
app.include_router(ask.router)
app.include_router(search.router)
app.include_router(import_.router)
app.include_router(collections.router)
app.include_router(insights.router)
app.include_router(chat_router.router)
app.include_router(tasks.router)
app.include_router(templates.router)
app.include_router(attachments.router)
app.include_router(note_versions.router)
app.include_router(review.router)
app.include_router(export.router)
app.include_router(system.router)
app.include_router(voice.router)
app.include_router(plugins.router)
app.include_router(benchmark.router)

@app.get("/")
def root():
    return {"message": "Welcome to Second Brain AI API"}

@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "port": settings.api_port,
        "sidecarMode": settings.sidecar_mode,
    }
