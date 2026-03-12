from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from app.database import get_db
from app.models.template import Template as TemplateModel
from app.schemas.template import TemplateCreate, TemplateUpdate, TemplateResponse

router = APIRouter(prefix="/api/templates", tags=["templates"])

# Built-in templates
BUILTIN_TEMPLATES = [
    {
        "name": "Daily Journal",
        "description": "End of day reflection",
        "icon": "📓",
        "title_template": "Journal: {{date}}",
        "content_template": """# {{date}}

## Morning Intentions
- 

## What Happened Today
- 

## Key Learnings
- 

## Gratitude
- 

## Tomorrow's Priorities
- 
"""
    },
    {
        "name": "Meeting Notes",
        "description": "Structured meeting documentation",
        "icon": "🤝",
        "title_template": "Meeting: ",
        "content_template": """## Attendees
- 

## Agenda
- 

## Discussion Points
- 

## Decisions Made
- 

## Action Items
- [ ] 

## Next Steps
- 
"""
    },
    {
        "name": "Project Plan",
        "description": "Project planning template",
        "icon": "🚀",
        "title_template": "Project: ",
        "content_template": """## Overview

## Goals
- 

## Timeline
- Start: {{date}}
- Target completion: 

## Tasks
- [ ] 

## Resources Needed
- 

## Risks
- 

## Success Criteria
- 
"""
    },
    {
        "name": "Book Summary",
        "description": "Capture key insights from reading",
        "icon": "📚",
        "title_template": "Book: ",
        "content_template": """## Book Info
- Title: 
- Author: 
- Date Read: {{date}}

## Key Ideas
1. 

## Memorable Quotes
> 

## How This Applies to Me
- 

## Recommended For
- 
"""
    },
    {
        "name": "Idea Capture",
        "description": "Quick idea documentation",
        "icon": "💡",
        "title_template": "Idea: ",
        "content_template": """## The Idea

## Problem It Solves

## Potential Implementation

## Resources Needed

## Next Steps
- [ ] 
"""
    }
]

def get_or_create_builtin_templates(db: Session):
    """Ensure built-in templates exist in database"""
    existing = db.query(TemplateModel).filter(TemplateModel.is_builtin == 1).first()
    if existing:
        return
    
    for tmpl in BUILTIN_TEMPLATES:
        db_template = TemplateModel(
            name=tmpl["name"],
            description=tmpl["description"],
            icon=tmpl["icon"],
            title_template=tmpl["title_template"],
            content_template=tmpl["content_template"],
            is_builtin=1
        )
        db.add(db_template)
    db.commit()

@router.get("", response_model=List[TemplateResponse])
def list_templates(db: Session = Depends(get_db)):
    get_or_create_builtin_templates(db)
    templates = db.query(TemplateModel).order_by(TemplateModel.is_builtin.desc(), TemplateModel.name).all()
    return templates

@router.post("", response_model=TemplateResponse)
def create_template(template: TemplateCreate, db: Session = Depends(get_db)):
    db_template = TemplateModel(
        name=template.name,
        description=template.description,
        icon=template.icon or "📝",
        title_template=template.title_template,
        content_template=template.content_template,
        is_builtin=0
    )
    db.add(db_template)
    db.commit()
    db.refresh(db_template)
    return db_template

@router.get("/{template_id}", response_model=TemplateResponse)
def get_template(template_id: int, db: Session = Depends(get_db)):
    template = db.query(TemplateModel).filter(TemplateModel.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template

@router.put("/{template_id}", response_model=TemplateResponse)
def update_template(template_id: int, template_update: TemplateUpdate, db: Session = Depends(get_db)):
    template = db.query(TemplateModel).filter(TemplateModel.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Don't allow editing built-in templates
    if template.is_builtin:
        raise HTTPException(status_code=403, detail="Cannot modify built-in templates")
    
    update_data = template_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(template, key, value)
    
    db.commit()
    db.refresh(template)
    return template

@router.delete("/{template_id}")
def delete_template(template_id: int, db: Session = Depends(get_db)):
    template = db.query(TemplateModel).filter(TemplateModel.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Don't allow deleting built-in templates
    if template.is_builtin:
        raise HTTPException(status_code=403, detail="Cannot delete built-in templates")
    
    db.delete(template)
    db.commit()
    return {"status": "deleted"}

@router.post("/{template_id}/apply")
def apply_template(template_id: int, db: Session = Depends(get_db)):
    """Get template with variables substituted"""
    template = db.query(TemplateModel).filter(TemplateModel.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Substitute variables
    now = datetime.now()
    content = template.content_template
    content = content.replace("{{date}}", now.strftime("%Y-%m-%d"))
    content = content.replace("{{time}}", now.strftime("%H:%M"))
    content = content.replace("{{datetime}}", now.strftime("%Y-%m-%d %H:%M"))
    
    title = template.title_template or ""
    title = title.replace("{{date}}", now.strftime("%Y-%m-%d"))
    title = title.replace("{{time}}", now.strftime("%H:%M"))
    title = title.replace("{{datetime}}", now.strftime("%Y-%m-%d %H:%M"))
    
    return {
        "title": title,
        "content": content,
        "icon": template.icon
    }
