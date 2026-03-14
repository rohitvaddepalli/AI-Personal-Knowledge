from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Table, text
from sqlalchemy.orm import relationship
from app.database import Base

collection_notes = Table(
    'collection_notes', Base.metadata,
    Column('collection_id', Integer, ForeignKey('collections.id', ondelete='CASCADE'), primary_key=True),
    Column('note_id', String, ForeignKey('notes.id', ondelete='CASCADE'), primary_key=True)
)

class Collection(Base):
    __tablename__ = "collections"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"))
    
    notes = relationship("Note", secondary=collection_notes)
