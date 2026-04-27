import uuid
from sqlalchemy import Column, String, Text, DateTime, Boolean, Integer, ForeignKey, text
from app.database import Base

class Note(Base):
    __tablename__ = "notes"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    source = Column(String, nullable=True)
    source_type = Column(String, nullable=True)
    tags = Column(String, nullable=True) # JSON stored as string for sqlite MVP
    created_at = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"))
    updated_at = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"), onupdate=text("CURRENT_TIMESTAMP"))
    is_archived = Column(Boolean, default=False)
    is_pinned = Column(Boolean, default=False)
    deleted_at = Column(DateTime, nullable=True)  # Soft delete timestamp
    
    # Spaced repetition fields
    review_count = Column(Integer, default=0)
    next_review_at = Column(DateTime, nullable=True)
    last_reviewed_at = Column(DateTime, nullable=True)
    
    # Hierarchical notes
    parent_note_id = Column(String, ForeignKey('notes.id', ondelete='CASCADE'), nullable=True)
    order = Column(Integer, default=0)

    # Phase 6.3 — Public garden
    is_public = Column(Boolean, default=False)

