"""
Analytics dashboard router.

Provides aggregated statistics about the knowledge base:
  GET /api/analytics/overview      — high-level counts
  GET /api/analytics/notes-per-day — time-series note creation
  GET /api/analytics/top-tags      — most-used tags
  GET /api/analytics/source-breakdown — ingestion sources
  GET /api/analytics/word-count-trend — writing activity
  GET /api/analytics/stale-notes   — notes not visited in N days
"""

from __future__ import annotations

import json
from collections import Counter, defaultdict
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.note import Note

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────


def _parse_tags(raw: Any) -> list[str]:
    if not raw:
        return []
    if isinstance(raw, list):
        return raw
    try:
        result = json.loads(raw)
        return result if isinstance(result, list) else []
    except Exception:
        return []


def _word_count(content: str) -> int:
    return len((content or "").split())


# ─────────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────────


@router.get("/overview")
def analytics_overview(db: Session = Depends(get_db)) -> dict[str, Any]:
    """High-level knowledge base statistics."""
    base_q = db.query(Note).filter(Note.is_archived == False, Note.deleted_at == None)  # noqa: E712

    total_notes = base_q.count()
    total_words = sum(_word_count(n.content) for n in base_q.all())

    # Notes created in last 7 days
    week_ago = datetime.utcnow() - timedelta(days=7)
    recent_notes = base_q.filter(Note.created_at >= week_ago).count()

    # Unique tags count
    all_tags: list[str] = []
    for note in base_q.all():
        all_tags.extend(_parse_tags(note.tags))
    unique_tags = len(set(all_tags))

    # Pinned / archived
    pinned = db.query(Note).filter(Note.is_pinned == True).count()  # noqa: E712
    archived = db.query(Note).filter(Note.is_archived == True).count()  # noqa: E712
    public = db.query(Note).filter(Note.is_public == True).count()  # noqa: E712

    # Notes by source type
    source_counts: dict[str, int] = defaultdict(int)
    for row in db.query(Note.source_type, func.count(Note.id)).group_by(Note.source_type).all():
        source_counts[row[0] or "manual"] += row[1]

    return {
        "total_notes": total_notes,
        "total_words": total_words,
        "avg_words_per_note": round(total_words / max(total_notes, 1)),
        "recent_notes_7d": recent_notes,
        "unique_tags": unique_tags,
        "pinned_notes": pinned,
        "archived_notes": archived,
        "public_notes": public,
        "source_breakdown": dict(source_counts),
    }


@router.get("/notes-per-day")
def notes_per_day(
    days: int = Query(30, ge=7, le=365),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    """Daily note creation counts for a time-series chart."""
    since = datetime.utcnow() - timedelta(days=days)
    notes = (
        db.query(Note)
        .filter(Note.created_at >= since, Note.deleted_at == None)  # noqa: E712
        .all()
    )

    counts: dict[str, int] = defaultdict(int)
    for note in notes:
        if note.created_at:
            day = note.created_at.date().isoformat()
            counts[day] += 1

    # Fill zeros for missing days
    result = []
    for i in range(days):
        d = (datetime.utcnow() - timedelta(days=days - 1 - i)).date().isoformat()
        result.append({"date": d, "count": counts.get(d, 0)})
    return result


@router.get("/top-tags")
def top_tags(
    limit: int = Query(20, ge=5, le=50),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    """Most-used tags across the knowledge base."""
    notes = db.query(Note).filter(Note.is_archived == False, Note.deleted_at == None).all()  # noqa: E712
    counter: Counter[str] = Counter()
    for note in notes:
        for tag in _parse_tags(note.tags):
            counter[tag] += 1
    return [{"tag": tag, "count": cnt} for tag, cnt in counter.most_common(limit)]


@router.get("/source-breakdown")
def source_breakdown(db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    """Note count by ingestion source type."""
    rows = (
        db.query(Note.source_type, func.count(Note.id))
        .filter(Note.deleted_at == None)  # noqa: E712
        .group_by(Note.source_type)
        .all()
    )
    return [{"source_type": row[0] or "manual", "count": row[1]} for row in rows]


@router.get("/word-count-trend")
def word_count_trend(
    days: int = Query(30, ge=7, le=365),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    """Daily total word count written (notes created that day)."""
    since = datetime.utcnow() - timedelta(days=days)
    notes = (
        db.query(Note)
        .filter(Note.created_at >= since, Note.deleted_at == None)  # noqa: E712
        .all()
    )

    daily_words: dict[str, int] = defaultdict(int)
    for note in notes:
        if note.created_at:
            day = note.created_at.date().isoformat()
            daily_words[day] += _word_count(note.content)

    result = []
    for i in range(days):
        d = (datetime.utcnow() - timedelta(days=days - 1 - i)).date().isoformat()
        result.append({"date": d, "words": daily_words.get(d, 0)})
    return result


@router.get("/stale-notes")
def stale_notes(
    idle_days: int = Query(30, ge=7, le=365),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> list[dict[str, Any]]:
    """Notes that haven't been viewed/edited in N days — surfaces forgotten knowledge."""
    cutoff = datetime.utcnow() - timedelta(days=idle_days)
    notes = (
        db.query(Note)
        .filter(
            Note.is_archived == False,  # noqa: E712
            Note.deleted_at == None,  # noqa: E712
            Note.updated_at <= cutoff,
        )
        .order_by(Note.updated_at.asc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": note.id,
            "title": note.title,
            "last_updated": note.updated_at.isoformat() if note.updated_at else None,
            "days_idle": (datetime.utcnow() - note.updated_at).days if note.updated_at else None,
            "tags": _parse_tags(note.tags),
            "word_count": _word_count(note.content),
        }
        for note in notes
    ]


@router.get("/graph-density")
def graph_density(db: Session = Depends(get_db)) -> dict[str, Any]:
    """Knowledge graph connectivity statistics."""
    from app.models.connection import Connection

    total_notes = db.query(Note).filter(Note.is_archived == False, Note.deleted_at == None).count()  # noqa: E712
    total_connections = db.query(Connection).count()

    # Max possible edges in an undirected graph
    max_edges = (total_notes * (total_notes - 1)) / 2 if total_notes > 1 else 1
    density = round(total_connections / max_edges, 4) if max_edges > 0 else 0.0

    # Notes with at least one connection
    connected_note_ids = set()
    for conn in db.query(Connection).all():
        connected_note_ids.add(conn.note_id)
        connected_note_ids.add(conn.connected_note_id)
    isolated_notes = total_notes - len(connected_note_ids)

    return {
        "total_notes": total_notes,
        "total_connections": total_connections,
        "graph_density": density,
        "connected_notes": len(connected_note_ids),
        "isolated_notes": isolated_notes,
    }
