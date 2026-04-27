"""
Phase 5.2 — Synthesis router
- POST /api/synthesis/weekly     — generate weekly cross-note synthesis note
- GET  /api/synthesis/latest     — get latest synthesis insight

Phase 5.3 — Personalization router
- GET  /api/personalization/preferences          — all preferences
- PUT  /api/personalization/preferences/{key}    — upsert a preference
- GET  /api/personalization/focus-presets        — list focus presets
"""

from __future__ import annotations

import json
from datetime import datetime, timedelta
from typing import Any, Dict, List

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.insight import Insight
from app.models.note import Note
from app.models.user_activity import UserPreferences

router = APIRouter(tags=["synthesis-personalization"])

# ─────────────────────────────────────────────────────────────────────────────
# Synthesis
# ─────────────────────────────────────────────────────────────────────────────

synthesis_router = APIRouter(prefix="/api/synthesis")


def _build_synthesis_prompt(notes: List[Note]) -> str:
    excerpts = []
    for note in notes[:12]:
        excerpt = (note.content or "")[:300]
        excerpts.append(f"### {note.title or 'Untitled'}\n{excerpt}")
    joined = "\n\n".join(excerpts)
    return (
        "You are a personal knowledge synthesis engine. "
        "The user captured the following notes this week. "
        "Identify 3–5 cross-cutting themes, surprising connections, or emerging ideas. "
        "Write in a warm, insightful tone as if you're a brilliant study partner.\n\n"
        f"{joined}\n\n"
        "Respond with a structured synthesis titled '## Weekly Synthesis' with subsections."
    )


def _run_synthesis(db: Session) -> None:
    """Background task: LLM synthesis of the week's notes."""
    try:
        from app.llm.router import complete
        week_ago = datetime.utcnow() - timedelta(days=7)
        notes = (
            db.query(Note)
            .filter(Note.is_archived == False, Note.deleted_at == None, Note.created_at >= week_ago)
            .order_by(Note.created_at.desc())
            .limit(20)
            .all()
        )
        if not notes:
            return

        prompt = _build_synthesis_prompt(notes)
        result = complete(prompt, max_tokens=1200)
        content = result.get("text") or result.get("content") or ""
        if not content:
            return

        related_ids = json.dumps([n.id for n in notes[:5]])
        insight = Insight(
            insight_type="weekly_synthesis",
            content=content,
            related_note_ids=related_ids,
        )
        db.add(insight)
        db.commit()
    except Exception as e:
        print(f"[Synthesis] Error: {e}")


@synthesis_router.post("/weekly")
def trigger_weekly_synthesis(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    background_tasks.add_task(_run_synthesis, db)
    return {"status": "Synthesis started in background."}


@synthesis_router.get("/latest")
def get_latest_synthesis(db: Session = Depends(get_db)):
    insight = (
        db.query(Insight)
        .filter(Insight.insight_type == "weekly_synthesis", Insight.is_dismissed == False)
        .order_by(Insight.created_at.desc())
        .first()
    )
    if not insight:
        return {"synthesis": None}
    return {
        "synthesis": {
            "id": insight.id,
            "content": insight.content,
            "created_at": insight.created_at.isoformat(),
        }
    }


# ─────────────────────────────────────────────────────────────────────────────
# Personalization
# ─────────────────────────────────────────────────────────────────────────────

personalization_router = APIRouter(prefix="/api/personalization")

FOCUS_PRESETS = [
    {
        "id": "capture",
        "label": "Capture Mode",
        "description": "Distraction-free writing. Editor is the hero.",
        "icon": "PenTool",
        "sidebar_collapsed": True,
        "reduced_animations": False,
        "default_view": "/notes/new",
        "hide_sections": ["insights", "graph"],
    },
    {
        "id": "writing",
        "label": "Writing Mode",
        "description": "Full-width editor with AI writing assistant.",
        "icon": "BookOpen",
        "sidebar_collapsed": True,
        "reduced_animations": True,
        "default_view": "/notes",
        "hide_sections": ["inbox", "graph"],
    },
    {
        "id": "review",
        "label": "Review Mode",
        "description": "Spaced repetition and flashcards front and center.",
        "icon": "RefreshCw",
        "sidebar_collapsed": False,
        "reduced_animations": False,
        "default_view": "/review",
        "hide_sections": ["insights"],
    },
    {
        "id": "research",
        "label": "Research Mode",
        "description": "Ask Brain + Graph + Search. Deep exploration.",
        "icon": "Search",
        "sidebar_collapsed": False,
        "reduced_animations": False,
        "default_view": "/ask",
        "hide_sections": [],
    },
]


class PreferenceUpdate(BaseModel):
    value: Any


@personalization_router.get("/preferences")
def get_preferences(db: Session = Depends(get_db)):
    rows = db.query(UserPreferences).all()
    return {r.key: json.loads(r.value) for r in rows}


@personalization_router.put("/preferences/{key}")
def set_preference(key: str, body: PreferenceUpdate, db: Session = Depends(get_db)):
    row = db.query(UserPreferences).filter(UserPreferences.key == key).first()
    serialized = json.dumps(body.value)
    if row:
        row.value = serialized
        row.updated_at = datetime.utcnow()
    else:
        row = UserPreferences(key=key, value=serialized)
        db.add(row)
    db.commit()
    return {"status": "ok", "key": key}


@personalization_router.get("/focus-presets")
def get_focus_presets():
    return FOCUS_PRESETS


@personalization_router.get("/dashboard-mode")
def get_dashboard_mode(db: Session = Depends(get_db)):
    """Infer user mode from activity patterns (writer/researcher/student/creator)."""
    try:
        from app.models.note import Note
        notes = (
            db.query(Note)
            .filter(Note.is_archived == False, Note.deleted_at == None)
            .order_by(Note.created_at.desc())
            .limit(50)
            .all()
        )
        all_tags: List[str] = []
        for n in notes:
            if n.tags:
                all_tags.extend(json.loads(n.tags))

        tag_counts: Dict[str, int] = {}
        for t in all_tags:
            tag_counts[t] = tag_counts.get(t, 0) + 1

        research_signals = sum(tag_counts.get(t, 0) for t in ["research", "paper", "study", "academic"])
        writing_signals = sum(tag_counts.get(t, 0) for t in ["writing", "article", "blog", "essay"])
        code_signals = sum(tag_counts.get(t, 0) for t in ["code", "engineering", "developer", "python"])

        if code_signals >= research_signals and code_signals >= writing_signals:
            mode = "developer"
        elif research_signals >= writing_signals:
            mode = "researcher"
        elif writing_signals > 0:
            mode = "creator"
        else:
            mode = "student"

        # Check stored preference override
        pref = db.query(UserPreferences).filter(UserPreferences.key == "dashboard_mode").first()
        if pref:
            stored = json.loads(pref.value)
            if stored in ("developer", "researcher", "creator", "student"):
                mode = stored

        return {"mode": mode}
    except Exception as e:
        return {"mode": "student", "error": str(e)}


# Register both sub-routers on the main router object for import
router = APIRouter()
router.include_router(synthesis_router, tags=["synthesis"])
router.include_router(personalization_router, tags=["personalization"])
