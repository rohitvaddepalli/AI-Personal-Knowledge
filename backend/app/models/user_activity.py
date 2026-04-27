import uuid
from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, Boolean, Text, Float, text
from app.database import Base


class UserActivity(Base):
    """Tracks daily activity for streaks and momentum surfaces."""
    __tablename__ = "user_activity"

    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(String, nullable=False, index=True)  # YYYY-MM-DD
    notes_captured = Column(Integer, default=0)
    notes_reviewed = Column(Integer, default=0)
    notes_connected = Column(Integer, default=0)
    minutes_active = Column(Integer, default=0)
    created_at = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"))
    updated_at = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"))


class UserPreferences(Base):
    """Persisted user preferences including personalization, focus modes, cadence."""
    __tablename__ = "user_preferences"

    id = Column(Integer, primary_key=True, autoincrement=True)
    key = Column(String, unique=True, nullable=False, index=True)
    value = Column(Text, nullable=False)
    updated_at = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"))


class Milestone(Base):
    """Milestones achieved by the user (first 100 notes, first streak, etc.)."""
    __tablename__ = "milestones"

    id = Column(Integer, primary_key=True, autoincrement=True)
    milestone_type = Column(String, nullable=False)  # 'notes_100', 'streak_7', 'links_50'
    achieved_at = Column(DateTime, server_default=text("CURRENT_TIMESTAMP"))
    is_seen = Column(Boolean, default=False)
