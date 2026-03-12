from sqlalchemy.orm import Session
from sqlalchemy import text
from app.services.embedding_service import note_collection
from app.models.note import Note
import json

def hybrid_search(db: Session, query: str, limit: int = 10, threshold: float = 0.5):
    k = 60
    
    # 1. Semantic search via ChromaDB
    semantic_results = note_collection.query(
        query_texts=[query],
        n_results=20
    )
    
    semantic_rankings = {}
    if semantic_results and "ids" in semantic_results and len(semantic_results["ids"]) > 0:
        for rank, note_id in enumerate(semantic_results["ids"][0]):
            semantic_rankings[note_id] = rank + 1
            
    # 2. Full text search via SQLite FTS5
    fts_rankings = {}
    try:
        # FTS5 search. Fallback if not supported handled globally in prod
        results = db.execute(text("SELECT id FROM notes_fts WHERE notes_fts MATCH :q LIMIT 20"), {"q": f"{query}*"}).fetchall()
        for rank, row in enumerate(results):
            fts_rankings[row[0]] = rank + 1
    except Exception as e:
        print(f"FTS Search error (ignoring FTS): {e}")
        
    # 3. Combine with Reciprocal Rank Fusion (RRF)
    combined = {}
    all_ids = set(semantic_rankings.keys()).union(set(fts_rankings.keys()))
    
    for note_id in all_ids:
        s_rank = semantic_rankings.get(note_id, 1000)
        f_rank = fts_rankings.get(note_id, 1000)
        score = (1 / (k + s_rank)) + (1 / (k + f_rank))
        combined[note_id] = score
        
    sorted_ids = sorted(combined.keys(), key=lambda x: combined[x], reverse=True)[:limit]
    
    if not sorted_ids:
        return []
        
    notes = db.query(Note).filter(Note.id.in_(sorted_ids)).all()
    notes_dict = {n.id: n for n in notes}
    
    final_results = []
    for nid in sorted_ids:
        if nid in notes_dict:
            n = notes_dict[nid]
            parsed_tags = json.loads(n.tags) if n.tags else []
            final_results.append({
                "id": n.id,
                "title": n.title,
                "content": n.content,
                "score": combined[nid],
                "source_type": n.source_type,
                "tags": parsed_tags
            })
            
    return final_results
