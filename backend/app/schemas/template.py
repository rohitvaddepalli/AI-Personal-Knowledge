from pydantic import BaseModel
from typing import Optional
from datetime import datetime

class TemplateBase(BaseModel):
    name: str
    description: Optional[str] = None
    icon: Optional[str] = "📝"
    title_template: Optional[str] = None
    content_template: str

class TemplateCreate(TemplateBase):
    pass

class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    title_template: Optional[str] = None
    content_template: Optional[str] = None

class TemplateResponse(TemplateBase):
    id: int
    is_builtin: int
    created_at: datetime

    class Config:
        from_attributes = True
