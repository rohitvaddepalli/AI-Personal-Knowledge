import httpx
from sqlalchemy.orm import Session
from app.config import settings
from app.services.embedding_service import note_collection
from app.models.connection import Connection
from app.database import SessionLocal

async def classify_relationship(llm_base_url: str, note_a: str, note_b: str) -> dict:
    prompt = f"""Classify the relationship between these two notes.
Options: similar, contradicts, extends, inspires, prerequisite.
Note A:
{note_a}
Note B:
{note_b}

Respond with only the classification word.
"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{llm_base_url}/api/generate",
                json={
                    "model": "qwen2.5:0.5b",  # fallback MVP config model
                    "prompt": prompt,
                    "stream": False
                },
                timeout=10.0
            )
            val = response.json().get("response", "").lower().strip()
            # fallback matching
            for opt in ["similar", "contradicts", "extends", "inspires", "prerequisite"]:
                if opt in val:
                    return {"relationship_type": opt, "ai_explanation": "Auto generated via local LLM"}
            return {"relationship_type": "similar", "ai_explanation": "Auto connection via embeddings"}
    except Exception as e:
        return {"relationship_type": "similar", "ai_explanation": str(e)}

async def auto_connect_note(note_id: str):
    db: Session = SessionLocal()
    try:
        # Get note embedding from Chromadb
        results = note_collection.get(ids=[note_id], include=["embeddings", "documents"])
        if not results or results.get("embeddings") is None or len(results["embeddings"]) == 0: return
        
        embedding = results["embeddings"][0]
        content_a = results["documents"][0]
        
        # Query for similar
        similar = note_collection.query(
            query_embeddings=[embedding],
            n_results=6
        )
        
        if not similar or not similar["ids"]: return
        
        for idx, match_id in enumerate(similar["ids"][0]):
            if match_id == note_id:
                continue # skip self
                
            dist = similar["distances"][0][idx]
            score = 1 - (dist / 2) # rough cosine to score approx
            if score > 0.75:
                # Check if conn exists
                exists = db.query(Connection).filter(
                    ((Connection.source_note_id == note_id) & (Connection.target_note_id == match_id)) |
                    ((Connection.source_note_id == match_id) & (Connection.target_note_id == note_id))
                ).first()
                
                if not exists:
                    content_b = similar["documents"][0][idx]
                    rel_info = await classify_relationship(settings.ollama_base_url, content_a[:500], content_b[:500])
                    
                    new_conn = Connection(
                        source_note_id=note_id,
                        target_note_id=match_id,
                        relationship_type=rel_info["relationship_type"],
                        strength=score,
                        ai_explanation=rel_info.get("ai_explanation")
                    )
                    db.add(new_conn)
                    try:
                        db.commit()
                    except:
                        db.rollback()
    finally:
        db.close()
