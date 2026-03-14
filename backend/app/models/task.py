from sqlalchemy import Column, Integer, String, Boolean, DateTime
from sqlalchemy.sql import text as sql_text
from app.database import Base

class Task(Base):
    __tablename__ = "core_tasks"  # Avoiding name collision if needed

    id = Column(Integer, primary_key=True, autoincrement=True)
    text = Column(String, nullable=False)
    is_done = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=sql_text("CURRENT_TIMESTAMP"))
