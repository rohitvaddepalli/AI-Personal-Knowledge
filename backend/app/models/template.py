from sqlalchemy import Column, Integer, String, Text, DateTime, text
from app.database import Base

class Template(Base):
    __tablename__ = "templates"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String, nullable=False)
    description = Column(String, nullable=True)
    title_template = Column(String, nullable=True)  # e.g., "Meeting: {{topic}}"
    content_template = Column(Text, nullable=False)  # The actual template content
    icon = Column(String, default="📝")  # Emoji icon
    is_builtin = Column(Integer, default=0)  # 1 for system templates, 0 for user created
    created_at = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"))
