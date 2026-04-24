from __future__ import annotations

import json
from datetime import datetime
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings
from app.models.note import Note


def hybrid_search(
    db: Session,
    query: str,
    limit: int = 10,
    threshold: float = 0.0,
    tags: list[str] | None = None,
    source_types: list[str] | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    require_summary: bool = False,
    require_flashcards: bool = False,
    rerank_bias: float = 0.5,
):
    semantic_rankings = _semantic_search(query, max(limit * 4, 20))
    keyword_rankings = _keyword_search(db, query, max(limit * 4, 20))
    meta_rankings = _metadata_search(db, query, max(limit * 3, 12))

    k = 60
    combined: dict[str, float] = {}
    all_ids = set(semantic_rankings).union(keyword_rankings).union(meta_rankings)
    semantic_weight = max(0.1, min(0.9, 1.0 - rerank_bias))
    keyword_weight = max(0.1, min(0.9, rerank_bias))

    for note_id in all_ids:
        s_rank = semantic_rankings.get(note_id, 10_000)
        k_rank = keyword_rankings.get(note_id, 10_000)
        m_rank = meta_rankings.get(note_id, 10_000)
        combined[note_id] = (
            semantic_weight * (1 / (k + s_rank))
            + keyword_weight * (1 / (k + k_rank))
            + 0.15 * (1 / (k + m_rank))
        )

    if not combined:
        return []

    notes = _load_candidate_notes(
        db,
        sorted(combined, key=lambda note_id: combined[note_id], reverse=True)[: max(limit * 3, 20)],
        tags=tags,
        source_types=source_types,
        date_from=date_from,
        date_to=date_to,
        require_summary=require_summary,
        require_flashcards=require_flashcards,
    )
    notes_dict = {note.id: note for note in notes}

    results = []
    for note_id in sorted(combined, key=lambda item: combined[item], reverse=True):
        note = notes_dict.get(note_id)
        if not note:
            continue
        if combined[note_id] < threshold:
            continue
        parsed_tags = _parse_tags(note.tags)
        results.append(
            {
                "id": note.id,
                "title": note.title,
                "content": note.content,
                "score": round(combined[note_id], 6),
                "source_type": note.source_type,
                "tags": parsed_tags,
                "has_summary": "### AI Summary" in (note.content or "") or "### AI Insight" in (note.content or ""),
            }
        )
        if len(results) >= limit:
            break
    return results


def _semantic_search(query: str, limit: int) -> dict[str, int]:
    from app.services.embedding_service import note_collection

    rankings: dict[str, int] = {}
    try:
        semantic_results = note_collection.query(query_texts=[query], n_results=limit)
        if semantic_results and semantic_results.get("ids"):
            for rank, note_id in enumerate(semantic_results["ids"][0]):
                rankings[note_id] = rank + 1
    except Exception:
        return {}
    return rankings


def _keyword_search(db: Session, query: str, limit: int) -> dict[str, int]:
    rankings: dict[str, int] = {}
    terms = query.strip()
    if not terms:
        return rankings
    try:
        if settings.is_sqlite:
            rows = db.execute(text("SELECT id FROM notes_fts WHERE notes_fts MATCH :q LIMIT :limit"), {"q": f"{terms}*", "limit": limit}).fetchall()
        else:
            rows = db.execute(
                text(
                    "SELECT id FROM notes WHERE to_tsvector('simple', coalesce(title,'') || ' ' || coalesce(content,'')) "
                    "@@ plainto_tsquery('simple', :q) LIMIT :limit"
                ),
                {"q": terms, "limit": limit},
            ).fetchall()
        for rank, row in enumerate(rows):
            rankings[str(row[0])] = rank + 1
    except Exception:
        pass
    return rankings


def _metadata_search(db: Session, query: str, limit: int) -> dict[str, int]:
    rankings: dict[str, int] = {}
    rows = (
        db.query(Note)
        .filter(Note.is_archived == False, Note.deleted_at == None)  # noqa: E712
        .filter((Note.title.ilike(f"%{query}%")) | (Note.source.ilike(f"%{query}%")) | (Note.tags.ilike(f"%{query}%")))
        .limit(limit)
        .all()
    )
    for rank, row in enumerate(rows):
        rankings[row.id] = rank + 1
    return rankings


def _load_candidate_notes(
    db: Session,
    ids: list[str],
    tags: list[str] | None,
    source_types: list[str] | None,
    date_from: str | None,
    date_to: str | None,
    require_summary: bool,
    require_flashcards: bool,
):
    if not ids:
        return []
    query = db.query(Note).filter(Note.id.in_(ids), Note.is_archived == False, Note.deleted_at == None)  # noqa: E712
    if source_types:
        query = query.filter(Note.source_type.in_(source_types))
    if date_from:
        query = query.filter(Note.created_at >= _parse_date(date_from))
    if date_to:
        query = query.filter(Note.created_at <= _parse_date(date_to))
    notes = query.all()

    if tags:
        notes = [note for note in notes if set(tags).issubset(set(_parse_tags(note.tags)))]
    if require_summary:
        notes = [note for note in notes if "### AI Summary" in (note.content or "") or "### AI Insight" in (note.content or "")]
    if require_flashcards:
        flashcard_ids = {row[0] for row in db.execute(text("SELECT DISTINCT note_id FROM flashcards")).fetchall()}
        notes = [note for note in notes if note.id in flashcard_ids]
    return notes


def _parse_tags(raw: Any) -> list[str]:
    if not raw:
        return []
    if isinstance(raw, list):
        return raw
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, list) else []
    except Exception:
        return []


def _parse_date(value: str) -> datetime:
    return datetime.fromisoformat(value)
