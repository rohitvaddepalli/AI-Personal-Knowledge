from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
import json
from datetime import datetime, timedelta
from app.database import get_db
from app.models.note import Note as NoteModel
from app.schemas.note import NoteResponse

router = APIRouter(prefix="/api/review", tags=["review"])

@router.get("/due", response_model=List[NoteResponse])
def get_notes_for_review(db: Session = Depends(get_db)):
    """Get notes that are due for review"""
    now = datetime.utcnow()
    notes = db.query(NoteModel).filter(
        NoteModel.is_archived == False,
        NoteModel.deleted_at == None,
        (NoteModel.next_review_at <= now) | (NoteModel.next_review_at == None)
    ).order_by(NoteModel.next_review_at.asc()).all()
    for note in notes:
        note.tags = json.loads(note.tags) if note.tags else []
    return notes

@router.post("/{note_id}")
def review_note(note_id: str, quality: int = 3, db: Session = Depends(get_db)):
    """Mark note as reviewed with quality score (1-5)"""
    note = db.query(NoteModel).filter(NoteModel.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    note.review_count += 1
    note.last_reviewed_at = datetime.utcnow()
    
    if quality >= 3:
        base_days = 1
        if note.review_count == 1:
            base_days = 1
        elif note.review_count == 2:
            base_days = 3
        else:
            base_days = min(2 ** (note.review_count - 2), 365)
        if quality == 5:
            base_days = int(base_days * 1.5)
        note.next_review_at = datetime.utcnow() + timedelta(days=base_days)
    else:
        note.next_review_at = datetime.utcnow() + timedelta(hours=4)
    
    db.commit()
    db.refresh(note)
    note.tags = json.loads(note.tags) if note.tags else []
    
    return {
        "message": "Review recorded",
        "next_review": note.next_review_at,
        "review_count": note.review_count
    }
