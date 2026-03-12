from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from app.database import get_db
from app.models.insight import Insight
from app.schemas.insight import InsightResponse
from app.tasks.insight_engine import generate_daily_digest
import json

router = APIRouter(prefix="/api/insights", tags=["insights"])

@router.get("", response_model=List[InsightResponse])
def get_insights(db: Session = Depends(get_db)):
    insights = db.query(Insight).filter(Insight.is_dismissed == False).order_by(Insight.created_at.desc()).all()
    for ins in insights:
        ins.related_note_ids = json.loads(ins.related_note_ids) if ins.related_note_ids else []
    return insights

@router.post("/generate")
def trigger_generation(background_tasks: BackgroundTasks):
    background_tasks.add_task(generate_daily_digest)
    return {"status": "Generating insights in background. This might take a few minutes."}

@router.delete("/{insight_id}")
def dismiss_insight(insight_id: int, db: Session = Depends(get_db)):
    insight = db.query(Insight).filter(Insight.id == insight_id).first()
    if insight:
        insight.is_dismissed = True
        db.commit()
    return {"status": "dismissed"}
