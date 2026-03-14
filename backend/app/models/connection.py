from sqlalchemy import Column, Integer, String, Float, Text, DateTime, text, ForeignKey
from app.database import Base

class Connection(Base):
    __tablename__ = "connections"

    id = Column(Integer, primary_key=True, autoincrement=True)
    source_note_id = Column(String, ForeignKey('notes.id', ondelete='CASCADE'), nullable=False)
    target_note_id = Column(String, ForeignKey('notes.id', ondelete='CASCADE'), nullable=False)
    relationship_type = Column(String, nullable=True) # 'similar', 'contradicts', etc.
    strength = Column(Float, default=0.0)
    ai_explanation = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"))
