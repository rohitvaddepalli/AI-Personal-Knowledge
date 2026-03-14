import uuid
from sqlalchemy import Column, String, Text, DateTime, Integer, ForeignKey, text
from app.database import Base

class NoteVersion(Base):
    __tablename__ = "note_versions"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    note_id = Column(String, ForeignKey('notes.id', ondelete='CASCADE'), nullable=False)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    tags = Column(String, nullable=True)  # JSON as string
    version_number = Column(Integer, nullable=False)
    created_at = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"))
