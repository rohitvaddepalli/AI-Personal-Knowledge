import uuid
from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, text
from app.database import Base

class Attachment(Base):
    __tablename__ = "attachments"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    note_id = Column(String, ForeignKey('notes.id', ondelete='CASCADE'), nullable=False)
    filename = Column(String, nullable=False)
    original_filename = Column(String, nullable=False)
    mime_type = Column(String, nullable=False)
    file_size = Column(Integer, nullable=False)
    storage_path = Column(String, nullable=False)
    created_at = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"))
