from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, text
from app.database import Base

class Insight(Base):
    __tablename__ = "insights"

    id = Column(Integer, primary_key=True, autoincrement=True)
    insight_type = Column(String, nullable=False) # 'pattern', 'gap', 'synthesis', 'question', 'daily_digest'
    content = Column(Text, nullable=False)
    related_note_ids = Column(String, nullable=True) # JSON array mapping
    created_at = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"))
    is_dismissed = Column(Boolean, default=False)
