import httpx
from app.database import SessionLocal
from app.models.note import Note
from app.models.insight import Insight
from app.config import settings
import json

def generate_daily_digest():
    db = SessionLocal()
    try:
        notes = db.query(Note).order_by(Note.created_at.desc()).limit(10).all()
        if len(notes) < 3:
            return # not enough context
            
        context_lines = []
        note_ids_used = []
        for n in notes:
            context_lines.append(f"TITLE: {n.title}\nCONTENT: {n.content[:200]}")
            note_ids_used.append(n.id)
            
        context = "\n---\n".join(context_lines)
        system_prompt = """You are an AI personal knowledge manager. 
        Read the recent notes provided by the user.
        Generate a 'daily digest' synthesis. Identify 1 emerging pattern, 1 potential contradiction, 
        and 1 interesting question to explore further. Format your response cleanly."""
        
        try:
            with httpx.Client() as client:
                response = client.post(
                    f"{settings.ollama_base_url}/api/generate",
                    json={
                        "model": "qwen2.5:0.5b",
                        "system": system_prompt,
                        "prompt": context,
                        "stream": False
                    },
                    timeout=45.0
                )
                output = response.json().get("response")
                
                if output:
                    new_insight = Insight(
                        insight_type="daily_digest",
                        content=output,
                        related_note_ids=json.dumps(note_ids_used)
                    )
                    db.add(new_insight)
                    db.commit()
        except Exception as e:
            print(f"Error generating insight: {e}")
            
    finally:
        db.close()
