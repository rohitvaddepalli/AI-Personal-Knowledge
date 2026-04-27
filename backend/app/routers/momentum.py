"""
Phase 5.1 + 5.2 — Momentum & Retention Surfaces
- GET /api/momentum/streak         — current streak + today target status
- POST /api/momentum/ping          — mark user active (called on app open)
- GET /api/momentum/digest         — weekly digest data
- GET /api/momentum/on-this-day    — notes from exactly 1y, 6m, 3m ago
- GET /api/momentum/forgotten      — notes not reviewed in 60+ days
- GET /api/momentum/milestones     — unseen milestone celebrations
- POST /api/momentum/milestones/{id}/seen
- GET /api/momentum/surprise       — random note + "why it matters now"
- POST /api/momentum/synthesis     — trigger weekly cross-note synthesis
"""

from __future__ import annotations

import json
import random
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.insight import Insight
from app.models.note import Note
from app.models.user_activity import Milestone, UserActivity, UserPreferences

router = APIRouter(prefix="/api/momentum", tags=["momentum"])


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _today() -> str:
    return date.today().isoformat()


def _get_or_create_activity(db: Session, day: str) -> UserActivity:
    row = db.query(UserActivity).filter(UserActivity.date == day).first()
    if not row:
        row = UserActivity(date=day)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def _compute_streak(db: Session) -> int:
    """Count consecutive days with at least 1 note captured or reviewed."""
    rows = (
        db.query(UserActivity)
        .order_by(UserActivity.date.desc())
        .all()
    )
    if not rows:
        return 0

    streak = 0
    check_date = date.today()
    for row in rows:
        row_date = date.fromisoformat(row.date)
        if row_date != check_date:
            break
        if row.notes_captured > 0 or row.notes_reviewed > 0:
            streak += 1
            check_date -= timedelta(days=1)
        else:
            break
    return streak


def _check_and_award_milestones(db: Session) -> None:
    """Award milestone badges if thresholds crossed."""
    total_notes = (
        db.query(func.count(Note.id))
        .filter(Note.is_archived == False, Note.deleted_at == None)
        .scalar()
        or 0
    )
    streak = _compute_streak(db)
    total_connections = (
        db.query(func.count(Note.id))
        .filter(Note.is_archived == False, Note.deleted_at == None, Note.tags != None, Note.tags != "[]")
        .scalar()
        or 0
    )

    milestones_to_check = [
        ("notes_10", total_notes >= 10),
        ("notes_50", total_notes >= 50),
        ("notes_100", total_notes >= 100),
        ("streak_3", streak >= 3),
        ("streak_7", streak >= 7),
        ("streak_30", streak >= 30),
        ("links_50", total_connections >= 50),
    ]

    existing = {m.milestone_type for m in db.query(Milestone).all()}
    for mtype, achieved in milestones_to_check:
        if achieved and mtype not in existing:
            db.add(Milestone(milestone_type=mtype))
    db.commit()


# ─────────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/ping")
def ping_activity(db: Session = Depends(get_db)):
    """Call on app open to mark today as active."""
    row = _get_or_create_activity(db, _today())
    row.minutes_active = (row.minutes_active or 0) + 1
    db.commit()
    _check_and_award_milestones(db)
    return {"status": "ok"}


@router.get("/streak")
def get_streak(db: Session = Depends(get_db)):
    """Return current streak, today's goal progress, and best streak."""
    streak = _compute_streak(db)

    today_row = db.query(UserActivity).filter(UserActivity.date == _today()).first()
    captured_today = today_row.notes_captured if today_row else 0
    reviewed_today = today_row.notes_reviewed if today_row else 0

    # Daily target: capture 1 note OR review 1 note
    daily_target_met = (captured_today + reviewed_today) >= 1

    # Best streak ever
    all_rows = db.query(UserActivity).order_by(UserActivity.date.asc()).all()
    best = 0
    run = 0
    prev: Optional[date] = None
    for row in all_rows:
        d = date.fromisoformat(row.date)
        if row.notes_captured > 0 or row.notes_reviewed > 0:
            if prev and (d - prev).days == 1:
                run += 1
            else:
                run = 1
            best = max(best, run)
        else:
            run = 0
        prev = d

    return {
        "current_streak": streak,
        "best_streak": best,
        "daily_target_met": daily_target_met,
        "captured_today": captured_today,
        "reviewed_today": reviewed_today,
        "target_label": "5-min knowledge ritual",
    }


@router.get("/digest")
def get_weekly_digest(db: Session = Depends(get_db)):
    """Weekly digest: what was captured, connected, and what to revisit."""
    week_ago = datetime.utcnow() - timedelta(days=7)

    captured = (
        db.query(Note)
        .filter(Note.is_archived == False, Note.deleted_at == None, Note.created_at >= week_ago)
        .order_by(Note.created_at.desc())
        .limit(20)
        .all()
    )

    connected = (
        db.query(Note)
        .filter(Note.is_archived == False, Note.deleted_at == None, Note.updated_at >= week_ago, Note.tags != None, Note.tags != "[]")
        .order_by(Note.updated_at.desc())
        .limit(10)
        .all()
    )

    # To revisit: notes not reviewed in 14+ days that have tags
    revisit_cutoff = datetime.utcnow() - timedelta(days=14)
    to_revisit = (
        db.query(Note)
        .filter(
            Note.is_archived == False,
            Note.deleted_at == None,
            Note.tags != None,
            Note.tags != "[]",
            Note.updated_at < revisit_cutoff,
        )
        .order_by(func.random())
        .limit(5)
        .all()
    )

    def _brief(note: Note) -> dict:
        return {
            "id": note.id,
            "title": note.title or "Untitled",
            "snippet": (note.content or "")[:120],
            "created_at": note.created_at.isoformat() if note.created_at else None,
        }

    return {
        "period": "last 7 days",
        "captured": [_brief(n) for n in captured],
        "connected": [_brief(n) for n in connected],
        "to_revisit": [_brief(n) for n in to_revisit],
        "stats": {
            "captured_count": len(captured),
            "connected_count": len(connected),
            "revisit_count": len(to_revisit),
        },
    }


@router.get("/on-this-day")
def on_this_day(db: Session = Depends(get_db)):
    """Notes created exactly ~1y, 6m, 3m, 1m ago (±3 day window each)."""
    now = datetime.utcnow()
    results = []

    intervals = [
        ("1 year ago", now - timedelta(days=365)),
        ("6 months ago", now - timedelta(days=182)),
        ("3 months ago", now - timedelta(days=91)),
        ("1 month ago", now - timedelta(days=30)),
    ]

    for label, target in intervals:
        window_start = target - timedelta(days=3)
        window_end = target + timedelta(days=3)
        notes = (
            db.query(Note)
            .filter(
                Note.is_archived == False,
                Note.deleted_at == None,
                Note.created_at >= window_start,
                Note.created_at <= window_end,
            )
            .limit(3)
            .all()
        )
        if notes:
            results.append({
                "label": label,
                "notes": [
                    {"id": n.id, "title": n.title or "Untitled", "snippet": (n.content or "")[:100]}
                    for n in notes
                ],
            })

    return {"groups": results}


@router.get("/forgotten")
def get_forgotten_notes(db: Session = Depends(get_db)):
    """Notes not reviewed or updated in 60+ days — resurfacing candidates."""
    cutoff = datetime.utcnow() - timedelta(days=60)
    notes = (
        db.query(Note)
        .filter(
            Note.is_archived == False,
            Note.deleted_at == None,
            Note.updated_at < cutoff,
        )
        .order_by(Note.updated_at.asc())
        .limit(8)
        .all()
    )
    return [
        {
            "id": n.id,
            "title": n.title or "Untitled",
            "snippet": (n.content or "")[:120],
            "last_updated": n.updated_at.isoformat() if n.updated_at else None,
            "days_ago": (datetime.utcnow() - n.updated_at).days if n.updated_at else None,
        }
        for n in notes
    ]


@router.get("/milestones")
def get_milestones(db: Session = Depends(get_db)):
    """Return unseen milestone achievements."""
    milestones = (
        db.query(Milestone)
        .filter(Milestone.is_seen == False)
        .order_by(Milestone.achieved_at.desc())
        .all()
    )
    labels = {
        "notes_10": ("🌱", "First 10 Notes", "You've started building your knowledge garden!"),
        "notes_50": ("📚", "50 Notes Captured", "Your knowledge base is growing strong."),
        "notes_100": ("🧠", "100 Notes!", "You've built a real Second Brain."),
        "streak_3": ("🔥", "3-Day Streak", "3 consecutive days of learning!"),
        "streak_7": ("⚡", "7-Day Streak", "A full week of knowledge rituals!"),
        "streak_30": ("🌟", "30-Day Streak", "Habit mastery — 30 days in a row!"),
        "links_50": ("🕸️", "50 Connections", "Your knowledge graph is taking shape!"),
    }
    result = []
    for m in milestones:
        emoji, title, description = labels.get(m.milestone_type, ("🏆", m.milestone_type, "Achievement unlocked!"))
        result.append({
            "id": m.id,
            "type": m.milestone_type,
            "emoji": emoji,
            "title": title,
            "description": description,
            "achieved_at": m.achieved_at.isoformat(),
        })
    return result


@router.post("/milestones/{milestone_id}/seen")
def mark_milestone_seen(milestone_id: int, db: Session = Depends(get_db)):
    m = db.query(Milestone).filter(Milestone.id == milestone_id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Milestone not found")
    m.is_seen = True
    db.commit()
    return {"status": "ok"}


@router.get("/surprise")
def surprise_me(db: Session = Depends(get_db)):
    """Return a random note with a 'why it matters now' hook."""
    count = (
        db.query(func.count(Note.id))
        .filter(Note.is_archived == False, Note.deleted_at == None)
        .scalar()
        or 0
    )
    if count == 0:
        return {"note": None, "hook": None}

    offset = random.randint(0, max(0, count - 1))
    note = (
        db.query(Note)
        .filter(Note.is_archived == False, Note.deleted_at == None)
        .offset(offset)
        .first()
    )
    if not note:
        return {"note": None, "hook": None}

    # Generate a lightweight "why it matters" hook from tags
    tags = json.loads(note.tags) if note.tags else []
    if tags:
        hook = f"This connects to your interest in {', '.join(tags[:2])}."
    else:
        days_old = (datetime.utcnow() - note.created_at).days if note.created_at else 0
        hook = f"You wrote this {days_old} days ago — worth revisiting with fresh eyes."

    return {
        "note": {
            "id": note.id,
            "title": note.title or "Untitled",
            "snippet": (note.content or "")[:200],
            "tags": tags,
        },
        "hook": hook,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Activity recording helpers (called from notes/review routers)
# ─────────────────────────────────────────────────────────────────────────────

def record_note_captured(db: Session) -> None:
    row = _get_or_create_activity(db, _today())
    row.notes_captured = (row.notes_captured or 0) + 1
    db.commit()
    _check_and_award_milestones(db)


def record_note_reviewed(db: Session) -> None:
    row = _get_or_create_activity(db, _today())
    row.notes_reviewed = (row.notes_reviewed or 0) + 1
    db.commit()
    _check_and_award_milestones(db)
