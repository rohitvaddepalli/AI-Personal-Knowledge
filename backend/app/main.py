from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from app.db_init import initialize_database
from app.routers import (
    notes, connections, graph, ask, search, import_, collections,
    insights, chat as chat_router, tasks, templates, attachments,
    note_versions, review, export, system, voice, plugins, benchmark, inbox,
    ingest, flashcards, auth,
)
from app.models import note, connection, collection, insight, chat, task, template, attachment, note_version
from app.config import settings
from app.runtime import ensure_app_directories, load_runtime_settings
from app.utils.auth import ACCESS_COOKIE_NAME, decode_token
from app.utils.rate_limit import check_rate_limit
import ipaddress
import secrets
import time

ensure_app_directories()
load_runtime_settings()
startup_started_at = time.perf_counter()


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


initialize_database()
startup_completed_at = time.perf_counter()


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
        if request.url.path.startswith("/api/"):
            if settings.api_key:
                provided = request.headers.get("x-api-key") or ""
                if not secrets.compare_digest(provided, settings.api_key):
                    return JSONResponse({"detail": "Unauthorized"}, status_code=401)
            elif not settings.allow_remote_clients:
                if _is_local_only_binding():
                    return await call_next(request)
                host = (request.client.host if request.client else "") or ""
                if not _is_loopback_host(host):
                    return JSONResponse({"detail": "Remote access disabled"}, status_code=403)

            if settings.auth_mode == "multi_user" and not request.url.path.startswith("/api/auth"):
                access_token = request.cookies.get(ACCESS_COOKIE_NAME)
                if not access_token:
                    return JSONResponse({"detail": "Authentication required"}, status_code=401)
                try:
                    decode_token(access_token, "access")
                except Exception as exc:
                    return JSONResponse({"detail": str(exc)}, status_code=401)
        return await call_next(request)


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if not request.url.path.startswith("/api/"):
            return await call_next(request)

        host = (request.client.host if request.client else "unknown") or "unknown"
        path = request.url.path
        if path.startswith("/api/ask") or path.startswith("/api/notes/suggest-tags"):
            ok = check_rate_limit(f"ai:{host}", settings.rate_limit_ai_per_minute)
        elif path.startswith("/api/import") or path.startswith("/api/ingest") or path.startswith("/api/voice"):
            ok = check_rate_limit(f"ingest:{host}", settings.rate_limit_ingest_per_minute)
        elif path.startswith("/api/auth"):
            ok = check_rate_limit(f"auth:{host}", settings.rate_limit_auth_per_minute)
        else:
            ok = True

        if not ok:
            return JSONResponse({"detail": "Rate limit exceeded"}, status_code=429)
        return await call_next(request)


app = FastAPI(
    title="Second Brain AI",
    description="AI-Powered Personal Knowledge System MVP API",
    version="0.1.0",
)
app.state.startup_profile = {
    "bootDurationMs": round((startup_completed_at - startup_started_at) * 1000, 2),
}

app.add_middleware(RateLimitMiddleware)
app.add_middleware(AccessControlMiddleware)
app.add_middleware(SecurityHeadersMiddleware)

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
app.include_router(inbox.router)
app.include_router(ingest.router)
app.include_router(flashcards.router)
app.include_router(auth.router)


@app.get("/")
def root():
    return {"message": "Welcome to Second Brain AI API"}


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "port": settings.api_port,
        "sidecarMode": settings.sidecar_mode,
        "databaseBackend": settings.database_backend,
        "databaseMode": settings.database_mode,
    }
