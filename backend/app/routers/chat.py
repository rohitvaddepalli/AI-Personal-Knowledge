from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.chat import ChatSession, ChatMessage
from app.schemas.chat import ChatSessionResponse, ChatMessageResponse, ChatSessionUpdate

router = APIRouter(prefix="/api/chat", tags=["chat"])

@router.get("/sessions", response_model=List[ChatSessionResponse])
def get_sessions(note_id: str = None, db: Session = Depends(get_db)):
    query = db.query(ChatSession)
    if note_id:
        query = query.filter(ChatSession.note_id == note_id)
    return query.order_by(ChatSession.created_at.desc()).all()

@router.get("/sessions/{session_id}", response_model=ChatSessionResponse)
def get_session(session_id: int, db: Session = Depends(get_db)):
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Get messages
    messages = db.query(ChatMessage).filter(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at.asc()).all()
    session.messages = messages
    return session

@router.put("/sessions/{session_id}", response_model=ChatSessionResponse)
def update_session(session_id: int, session_update: ChatSessionUpdate, db: Session = Depends(get_db)):
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.title = session_update.title
    db.commit()
    db.refresh(session)
    return session

@router.delete("/sessions/{session_id}")
def delete_session(session_id: int, db: Session = Depends(get_db)):
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Delete associated messages first
    db.query(ChatMessage).filter(ChatMessage.session_id == session_id).delete()
    db.delete(session)
    db.commit()
    return {"status": "deleted"}
