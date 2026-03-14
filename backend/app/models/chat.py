from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text
from datetime import datetime
from app.database import Base

class ChatSession(Base):
    __tablename__ = "chat_sessions"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    note_id = Column(String, ForeignKey("notes.id"), nullable=True)

class ChatMessage(Base):
    __tablename__ = "chat_messages"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("chat_sessions.id"))
    role = Column(String) # 'user' or 'ai'
    content = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
