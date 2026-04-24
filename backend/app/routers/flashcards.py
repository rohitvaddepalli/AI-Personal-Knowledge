"""
Flashcards router — Phase 3.4
AI flashcard generation from note content, CRUD management,
quality-of-recall tracking, and Anki export.
"""
from __future__ import annotations

import csv
import io
import json
import uuid
from datetime import datetime
from typing import List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Session

from app.config import settings
from app.database import Base, engine, get_db
from app.utils.security import sanitize_content_for_prompt

router = APIRouter(prefix="/api/flashcards", tags=["flashcards"])


# ── Model ──────────────────────────────────────────────────────────────────

class Flashcard(Base):
    __tablename__ = "flashcards"
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    note_id = Column(String, nullable=False, index=True)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    # SM-2 fields
    ease_factor = Column(Float, default=2.5)
    interval = Column(Integer, default=1)
    repetitions = Column(Integer, default=0)
    next_review_at = Column(DateTime, default=datetime.utcnow)
    last_reviewed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    # Recall quality histogram (0-5 ratings, stored as JSON)
    recall_history = Column(Text, default="[]")


Base.metadata.create_all(bind=engine)


# ── Schemas ────────────────────────────────────────────────────────────────

class FlashcardOut(BaseModel):
    id: str
    note_id: str
    question: str
    answer: str
    ease_factor: float
    interval: int
    repetitions: int
    next_review_at: datetime
    last_reviewed_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class GenerateRequest(BaseModel):
    note_id: str
    model: str = "qwen2.5:0.5b"
    count: int = 5


class ReviewRequest(BaseModel):
    quality: int  # 0-5  (SM-2 scale: 0=blackout … 5=perfect)


class FlashcardUpdate(BaseModel):
    question: Optional[str] = None
    answer: Optional[str] = None


# ── SM-2 scheduler ─────────────────────────────────────────────────────────

def _sm2(card: Flashcard, quality: int) -> None:
    """Apply SM-2 algorithm to update scheduling fields in-place."""
    q = max(0, min(5, quality))
    card.ease_factor = max(1.3, card.ease_factor + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    if q < 3:
        card.repetitions = 0
        card.interval = 1
    else:
        card.repetitions += 1
        if card.repetitions == 1:
            card.interval = 1
        elif card.repetitions == 2:
            card.interval = 6
        else:
            card.interval = round(card.interval * card.ease_factor)

    from datetime import timedelta
    card.next_review_at = datetime.utcnow() + timedelta(days=card.interval)
    card.last_reviewed_at = datetime.utcnow()
    history = json.loads(card.recall_history or "[]")
    history.append(q)
    card.recall_history = json.dumps(history[-50:])  # keep last 50 ratings


# ── Routes ─────────────────────────────────────────────────────────────────

@router.post("/generate", response_model=List[FlashcardOut])
def generate_flashcards(req: GenerateRequest, db: Session = Depends(get_db)):
    """Generate AI flashcards from a note's content."""
    from app.models.note import Note as NoteModel
    note = db.query(NoteModel).filter(NoteModel.id == req.note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")

    count = max(1, min(20, req.count))
    safe_title = sanitize_content_for_prompt(note.title)
    safe_content = sanitize_content_for_prompt(note.content[:4000])

    prompt = (
        "You are a study-assistant AI. Generate exactly {count} question-answer flashcard pairs "
        "based on the note content below.\n"
        "Return ONLY a JSON array with this structure (no extra text):\n"
        '[{{"q": "question", "a": "answer"}}, ...]\n\n'
        "Note title: {title}\n\n"
        "Note content:\n{content}\n\n"
        "Flashcards JSON:"
    ).format(count=count, title=safe_title, content=safe_content)

    try:
        with httpx.Client() as client:
            resp = client.post(
                f"{settings.ollama_base_url}/api/generate",
                json={"model": req.model, "prompt": prompt, "stream": False},
                timeout=60.0,
            )
        raw = resp.json().get("response", "").strip()
        # Extract JSON array even if LLM wraps it in markdown
        import re
        match = re.search(r"\[.*\]", raw, re.DOTALL)
        if not match:
            raise ValueError("LLM did not return a JSON array")
        pairs = json.loads(match.group(0))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Flashcard generation failed: {e}")

    cards = []
    for pair in pairs[:count]:
        q = str(pair.get("q", "")).strip()
        a = str(pair.get("a", "")).strip()
        if not q or not a:
            continue
        card = Flashcard(note_id=req.note_id, question=q, answer=a)
        db.add(card)
        db.flush()
        cards.append(card)

    db.commit()
    for c in cards:
        db.refresh(c)
    return cards


@router.get("/note/{note_id}", response_model=List[FlashcardOut])
def get_cards_for_note(note_id: str, db: Session = Depends(get_db)):
    return db.query(Flashcard).filter(Flashcard.note_id == note_id).all()


@router.get("/due", response_model=List[FlashcardOut])
def get_due_cards(db: Session = Depends(get_db)):
    """Cards due for review today."""
    return (
        db.query(Flashcard)
        .filter(Flashcard.next_review_at <= datetime.utcnow())
        .order_by(Flashcard.next_review_at)
        .limit(50)
        .all()
    )


@router.post("/{card_id}/review", response_model=FlashcardOut)
def review_card(card_id: str, req: ReviewRequest, db: Session = Depends(get_db)):
    """Record a recall quality rating (0-5) and update SM-2 schedule."""
    card = db.query(Flashcard).filter(Flashcard.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    _sm2(card, req.quality)
    db.commit()
    db.refresh(card)
    return card


@router.patch("/{card_id}", response_model=FlashcardOut)
def update_card(card_id: str, body: FlashcardUpdate, db: Session = Depends(get_db)):
    card = db.query(Flashcard).filter(Flashcard.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    if body.question is not None:
        card.question = body.question
    if body.answer is not None:
        card.answer = body.answer
    db.commit()
    db.refresh(card)
    return card


@router.delete("/{card_id}")
def delete_card(card_id: str, db: Session = Depends(get_db)):
    card = db.query(Flashcard).filter(Flashcard.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    db.delete(card)
    db.commit()
    return {"ok": True}


@router.get("/export/anki")
def export_anki(db: Session = Depends(get_db)):
    """
    Export all flashcards as Anki-compatible tab-separated CSV.
    Import via: Anki → File → Import → choose .txt → Tab separated.
    """
    cards = db.query(Flashcard).all()
    output = io.StringIO()
    writer = csv.writer(output, delimiter="\t")
    for c in cards:
        writer.writerow([c.question, c.answer])
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/plain",
        headers={"Content-Disposition": "attachment; filename=flashcards_anki.txt"},
    )


@router.get("/stats")
def flashcard_stats(db: Session = Depends(get_db)):
    total = db.query(Flashcard).count()
    due = db.query(Flashcard).filter(Flashcard.next_review_at <= datetime.utcnow()).count()
    return {"total": total, "due": due}
