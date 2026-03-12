from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class InsightBase(BaseModel):
    insight_type: str
    content: str
    related_note_ids: Optional[List[str]] = None

class InsightCreate(InsightBase):
    pass

class InsightResponse(InsightBase):
    id: int
    created_at: datetime
    is_dismissed: bool

    class Config:
        from_attributes = True
