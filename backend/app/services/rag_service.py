import httpx
from typing import Optional
from sqlalchemy.orm import Session
from app.config import settings
from app.services.search_service import hybrid_search

from app.models.chat import ChatSession, ChatMessage
from app.models.note import Note

async def ask_brain(db: Session, question: str, session_id: Optional[int] = None, note_id: Optional[str] = None, profile_context: Optional[str] = None, model: str = "qwen2.5:0.5b"):
    # 1. Handle Session or Create
    if session_id:
        session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    else:
        # Create new session
        session = ChatSession(title=question[:50], note_id=note_id)
        db.add(session)
        db.commit()
        db.refresh(session)
    
    session_id = session.id
    
    # 2. Context Retrieval
    context_chunks = []
    sources = []
    
    if note_id:
        # Note-specific chat
        target_note = db.query(Note).filter(Note.id == note_id).first()
        if target_note:
            context_chunks.append(f"[Note: {target_note.title}]\n{target_note.content}")
            sources.append({"id": target_note.id, "title": target_note.title})
    else:
        # Global RAG search only if the user explicitly mentions a note using @
        if "@" in question:
            import re
            # Extract potential titles mentioned with @. Matches @Title until a newline or another @
            mentions = re.findall(r"@([^@\n]+)", question)
            
            # 1. Try exact/fuzzy title matches for explicitly mentioned notes
            if mentions:
                for m in mentions:
                    m_clean = m.strip()
                    # We match against the note title exactly as selected from the dropdown
                    matches = db.query(Note).filter(Note.title.ilike(f"%{m_clean}%")).all()
                    for note in matches:
                        if note.id not in [s["id"] for s in sources]:
                            sources.append({"id": note.id, "title": note.title})
                            # Use a clearer separator and structure for the model
                            context_chunks.append(f"START_SOURCE: {note.title}\n{note.content}\nEND_SOURCE")
            
    # 3. Handle conversation history (last 5 messages for brevity)
    history = db.query(ChatMessage).filter(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at.desc()).limit(5).all()
    history_ctx = "\n".join([f"{m.role.upper()}: {m.content}" for m in reversed(history)])
    
    context = "\n\n---\n\n".join(context_chunks)
    
    from datetime import datetime
    today = datetime.now().strftime("%Y-%m-%d")

    if note_id:
        system = """You are an expert analyst. Answer based on the provided note content. Be thorough and cite specific details from the note."""
    else:
        if "@" in question and context_chunks:
            system = f"""You are a helpful AI assistant with access to the user's notes. Answer the question using the provided note content below.

Instructions:
- Use ONLY the information in the START_SOURCE/END_SOURCE blocks to answer
- If the note is a YouTube transcript, explain what the speaker said in detail
- Be specific and quote relevant parts from the note
- If the information isn't in the provided notes, say "I don't see that in your notes"

Today's Date: {today}"""
        else:
            system = "You are a helpful AI assistant. Answer directly and helpfully."

    if profile_context:
        system += f"\n\nUser Context:\n{profile_context}"
    
    # Clean prompt format - avoid markers that model might echo
    prompt_parts = []
    if context:
        prompt_parts.append(f"Content from your notes:\n{context}")
    if history_ctx:
        prompt_parts.append(f"Previous conversation:\n{history_ctx}")
    prompt_parts.append(f"Question: {question}")
    
    prompt = "\n\n".join(prompt_parts)
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{settings.ollama_base_url}/api/generate",
                json={
                    "model": model,
                    "system": system,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.3,
                        "num_ctx": 4096
                    }
                },
                timeout=60.0
            )
            if response.status_code == 200:
                answer = response.json().get("response", "Error generating response")
            else:
                answer = f"Error from LLM: {response.text}"
    except Exception as e:
        answer = f"Connection error: {str(e)}"

    normalized = (answer or "").strip().lower()
    if "i'm sorry" in normalized and "can't assist" in normalized:
        if note_id:
            answer = (
                "I couldn’t answer that from the current note context. "
                "Try asking a more specific question about the note content."
            )
        else:
            answer = (
                "I can help, but I need context from your knowledge base.\n\n"
                "Try one of these:\n"
                "- Mention a note with @ (type @ and pick a note)\n"
                "- Ask about your notes in general (e.g. 'What are my notes about X?')\n"
                "- If you're asking about a video/article, import it first (Import URL) so I can reference it."
            )
        
    # 4. Save Messages
    u_msg = ChatMessage(session_id=session_id, role="user", content=question)
    ai_msg = ChatMessage(session_id=session_id, role="ai", content=answer)
    db.add(u_msg)
    db.add(ai_msg)
    db.commit()
    
    return {"answer": answer, "sources": sources, "session_id": session_id}
