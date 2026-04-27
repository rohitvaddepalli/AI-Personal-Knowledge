"""
Phase 6.2 — Webhook ingestion router

Endpoints:
  POST /api/webhooks/register          — register a webhook source
  GET  /api/webhooks                   — list registered webhooks
  DELETE /api/webhooks/{id}            — remove a webhook
  POST /api/webhooks/ingest/{token}    — receive payload from external system (public endpoint)
"""

from __future__ import annotations

import hashlib
import hmac
import json
import secrets
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Header, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.note import Note
from app.services.embedding_service import add_note_embedding
from app.services.connection_engine import auto_connect_note

router = APIRouter(prefix="/api/webhooks", tags=["webhooks"])

# ─────────────────────────────────────────────────────────────────────────────
# In-process registry (persists to a JSON file in the app data dir)
# ─────────────────────────────────────────────────────────────────────────────

import os
from pathlib import Path
from app.config import settings

_REGISTRY_PATH = Path(getattr(settings, "data_dir", Path.home() / ".second-brain")) / "webhooks.json"


def _load_registry() -> list[dict]:
    if _REGISTRY_PATH.exists():
        try:
            return json.loads(_REGISTRY_PATH.read_text())
        except Exception:
            pass
    return []


def _save_registry(hooks: list[dict]) -> None:
    _REGISTRY_PATH.parent.mkdir(parents=True, exist_ok=True)
    _REGISTRY_PATH.write_text(json.dumps(hooks, indent=2))


# ─────────────────────────────────────────────────────────────────────────────
# Models
# ─────────────────────────────────────────────────────────────────────────────

class WebhookRegisterRequest(BaseModel):
    name: str                           # e.g. "Zapier capture", "Slack bot"
    source_label: str = "webhook"       # label shown on created notes
    secret: Optional[str] = None        # HMAC secret for signature verification
    extract_title_field: str = "title"  # JSON field to use as note title
    extract_body_field: str = "body"    # JSON field to use as note body
    extract_tags_field: Optional[str] = None
    auto_tag: bool = True


# ─────────────────────────────────────────────────────────────────────────────
# Registration endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/register", status_code=201)
def register_webhook(req: WebhookRegisterRequest):
    """Register a new webhook source and receive a unique ingest token."""
    token = secrets.token_urlsafe(32)
    hook = {
        "id": token[:8],
        "token": token,
        "name": req.name,
        "source_label": req.source_label,
        "secret": req.secret,
        "extract_title_field": req.extract_title_field,
        "extract_body_field": req.extract_body_field,
        "extract_tags_field": req.extract_tags_field,
        "auto_tag": req.auto_tag,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "call_count": 0,
    }
    hooks = _load_registry()
    hooks.append(hook)
    _save_registry(hooks)
    return {
        "id": hook["id"],
        "token": token,
        "ingest_url": f"/api/webhooks/ingest/{token}",
        "message": "Webhook registered. POST JSON to the ingest_url.",
    }


@router.get("")
def list_webhooks():
    """List all registered webhooks (tokens redacted)."""
    hooks = _load_registry()
    safe = [{k: v for k, v in h.items() if k != "token"} for h in hooks]
    return {"webhooks": safe, "count": len(safe)}


@router.delete("/{hook_id}")
def delete_webhook(hook_id: str):
    """Remove a webhook by its 8-character ID."""
    hooks = _load_registry()
    new_hooks = [h for h in hooks if h["id"] != hook_id]
    if len(new_hooks) == len(hooks):
        raise HTTPException(status_code=404, detail="Webhook not found.")
    _save_registry(new_hooks)
    return {"status": "deleted", "id": hook_id}


# ─────────────────────────────────────────────────────────────────────────────
# Ingest endpoint (public — authenticated by token)
# ─────────────────────────────────────────────────────────────────────────────

def _verify_signature(body: bytes, secret: str, signature_header: Optional[str]) -> bool:
    """Verify HMAC-SHA256 signature if a secret is configured."""
    if not secret:
        return True
    if not signature_header:
        return False
    expected = "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature_header)


def _extract_field(payload: dict, field: str) -> str:
    """Safely extract a potentially nested field from a dict using dot notation."""
    parts = field.split(".")
    val = payload
    for part in parts:
        if not isinstance(val, dict):
            return ""
        val = val.get(part, "")
    return str(val) if val else ""


async def _create_note_from_webhook(
    hook: dict, payload: dict, db: Session
) -> Note:
    title = _extract_field(payload, hook["extract_title_field"]) or "Webhook Note"
    body = _extract_field(payload, hook["extract_body_field"]) or json.dumps(payload, indent=2)
    tags: list[str] = []
    if hook.get("extract_tags_field"):
        raw_tags = _extract_field(payload, hook["extract_tags_field"])
        if raw_tags:
            tags = [t.strip() for t in raw_tags.split(",") if t.strip()]

    note = Note(
        title=title[:200],
        content=body[:50000],
        source=f"webhook:{hook['name']}",
        source_type=hook["source_label"],
        tags=json.dumps(tags),
    )
    db.add(note)
    db.commit()
    db.refresh(note)
    return note


@router.post("/ingest/{token}", status_code=202)
async def ingest_webhook(
    token: str,
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    x_hub_signature_256: Optional[str] = Header(default=None),
    x_second_brain_signature: Optional[str] = Header(default=None),
):
    """
    Receive a webhook payload. Accepts any JSON body.
    - If the webhook has a secret, validates HMAC-SHA256 signature.
    - Extracts title + body from configured field paths.
    - Creates a note and queues embedding + auto-connect.
    """
    hooks = _load_registry()
    hook = next((h for h in hooks if h["token"] == token), None)
    if not hook:
        raise HTTPException(status_code=404, detail="Invalid webhook token.")

    body_bytes = await request.body()

    # Support both GitHub-style and custom signature headers
    sig = x_hub_signature_256 or x_second_brain_signature
    if not _verify_signature(body_bytes, hook.get("secret") or "", sig):
        raise HTTPException(status_code=401, detail="Invalid signature.")

    try:
        payload = json.loads(body_bytes.decode("utf-8"))
    except Exception:
        payload = {"body": body_bytes.decode("utf-8", errors="replace")}

    note = await _create_note_from_webhook(hook, payload, db)

    # Update call count
    for h in hooks:
        if h["token"] == token:
            h["call_count"] = h.get("call_count", 0) + 1
            h["last_called"] = datetime.now(timezone.utc).isoformat()
    _save_registry(hooks)

    background_tasks.add_task(add_note_embedding, note.id, note.title, note.content)
    background_tasks.add_task(auto_connect_note, note.id)

    return {"status": "accepted", "note_id": note.id, "title": note.title}
