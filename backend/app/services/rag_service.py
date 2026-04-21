import httpx
import re
from typing import Optional
from sqlalchemy.orm import Session
from app.config import settings
from app.services.search_service import hybrid_search

from app.models.chat import ChatSession, ChatMessage
from app.models.note import Note


def _extract_snippet(content: str, max_chars: int = 200) -> str:
    """Return the first meaningful paragraph as a snippet."""
    paragraphs = [p.strip() for p in content.split("\n\n") if p.strip()]
    for p in paragraphs:
        if len(p) >= 30:
            return p[:max_chars] + ("..." if len(p) > max_chars else "")
    return content[:max_chars]


async def ask_brain(
    db: Session,
    question: str,
    session_id: Optional[int] = None,
    note_id: Optional[str] = None,
    profile_context: Optional[str] = None,
    model: str = "qwen2.5:0.5b",
    mode: str = "auto",
):
    """
    mode: "auto"         – global hybrid search (default)
          "search_only"  – return source list, no LLM answer
          "strict_cited" – answer only from retrieved notes; refuse if grounding weak
    """
    # 1. Session handling
    if session_id:
        session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    else:
        session = ChatSession(title=question[:50], note_id=note_id)
        db.add(session)
        db.commit()
        db.refresh(session)

    session_id = session.id

    # 2. Context Retrieval
    context_chunks = []
    sources = []
    retrieval_explanation = ""
    confidence = None

    if note_id:
        # Note-specific chat
        target_note = db.query(Note).filter(Note.id == note_id).first()
        if target_note:
            context_chunks.append(f"[Note: {target_note.title}]\n{target_note.content}")
            sources.append({
                "id": target_note.id,
                "title": target_note.title,
                "snippet": _extract_snippet(target_note.content),
                "similarity": 1.0,
            })
        retrieval_explanation = "Scoped to the open note."
        confidence = 0.85 if context_chunks else 0.1

    elif "@" in question:
        # @mention-scoped retrieval
        mentions = re.findall(r"@([^@\n]+)", question)
        if mentions:
            for m in mentions:
                m_clean = m.strip()
                matches = db.query(Note).filter(Note.title.ilike(f"%{m_clean}%")).all()
                for note in matches:
                    if note.id not in [s["id"] for s in sources]:
                        sources.append({
                            "id": note.id,
                            "title": note.title,
                            "snippet": _extract_snippet(note.content),
                            "similarity": 0.9,
                        })
                        context_chunks.append(f"START_SOURCE: {note.title}\n{note.content}\nEND_SOURCE")
        retrieval_explanation = f"Scoped to @mentioned notes: {', '.join(m.strip() for m in mentions)}."
        confidence = 0.80 if context_chunks else 0.15

    else:
        # Global hybrid search (auto / strict_cited)
        results = hybrid_search(db, question, limit=5)
        if results:
            for r in results:
                sources.append({
                    "id": r["id"],
                    "title": r["title"],
                    "snippet": _extract_snippet(r["content"]),
                    "similarity": round(r["score"], 3),
                })
                context_chunks.append(f"START_SOURCE: {r['title']}\n{r['content']}\nEND_SOURCE")
            top_score = results[0]["score"] if results else 0.0
            confidence = round(min(0.95, top_score * 8), 2)  # normalize raw RRF score
            retrieval_explanation = (
                f"Retrieved {len(results)} notes via hybrid search (semantic + keyword). "
                f"Top match: \"{results[0]['title']}\" (score {results[0]['score']:.3f})."
            )
        else:
            confidence = 0.05
            retrieval_explanation = "No relevant notes found in the knowledge base."

    # 3. Search-only mode — return sources, skip LLM
    if mode == "search_only":
        answer = (
            "**Search results** (no AI answer in Search Only mode):\n\n"
            + "\n".join(f"- {s['title']}" for s in sources)
            if sources
            else "No matching notes found."
        )
        u_msg = ChatMessage(session_id=session_id, role="user", content=question)
        ai_msg = ChatMessage(session_id=session_id, role="ai", content=answer)
        db.add(u_msg)
        db.add(ai_msg)
        db.commit()
        return {
            "answer": answer,
            "sources": sources,
            "session_id": session_id,
            "confidence": confidence,
            "retrieval_explanation": retrieval_explanation,
        }

    # 4. Strict-cited mode — refuse if grounding is weak
    if mode == "strict_cited" and not context_chunks:
        answer = (
            "I can't answer this with strict citations because no relevant notes were found.\n\n"
            "Try one of these:\n"
            "- Use **Auto** mode for a best-effort answer\n"
            "- Import relevant articles or notes first\n"
            "- Narrow your question to match note content"
        )
        u_msg = ChatMessage(session_id=session_id, role="user", content=question)
        ai_msg = ChatMessage(session_id=session_id, role="ai", content=answer)
        db.add(u_msg)
        db.add(ai_msg)
        db.commit()
        return {
            "answer": answer,
            "sources": [],
            "session_id": session_id,
            "confidence": 0.0,
            "retrieval_explanation": retrieval_explanation,
        }

    # 5. Build conversation history context
    history = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at.desc())
        .limit(5)
        .all()
    )
    history_ctx = "\n".join(
        [f"{m.role.upper()}: {m.content}" for m in reversed(history)]
    )

    context = "\n\n---\n\n".join(context_chunks)

    from datetime import datetime
    today = datetime.now().strftime("%Y-%m-%d")

    # 6. System prompt by mode
    if note_id:
        system = "You are an expert analyst. Answer based on the provided note content. Be thorough and cite specific details."
    elif mode == "strict_cited":
        system = (
            f"You are a strictly grounded AI assistant. "
            f"Answer ONLY from the provided START_SOURCE/END_SOURCE blocks. "
            f"Cite the source name when referencing info. "
            f"If the answer isn't fully in the sources, say so and suggest related notes.\n\nToday: {today}"
        )
    elif "@" in question and context_chunks:
        system = (
            f"You are a helpful AI assistant with access to the user's notes. "
            f"Answer using ONLY the START_SOURCE/END_SOURCE blocks. "
            f"Be specific and quote relevant parts.\n\nToday: {today}"
        )
    elif context_chunks:
        system = (
            f"You are a knowledgeable AI assistant. "
            f"Use the provided note context as your primary source, but you may supplement with general knowledge if the notes are insufficient. "
            f"Always indicate if your answer comes from the user's notes or general knowledge.\n\nToday: {today}"
        )
    else:
        system = "You are a helpful AI assistant. Answer directly and helpfully."

    if profile_context:
        system += f"\n\nUser Context:\n{profile_context}"

    # 7. Build prompt
    prompt_parts = []
    if context:
        prompt_parts.append(f"Context from your notes:\n{context}")
    if history_ctx:
        prompt_parts.append(f"Previous conversation:\n{history_ctx}")
    prompt_parts.append(f"Question: {question}")
    prompt = "\n\n".join(prompt_parts)

    # 8. Call LLM
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{settings.ollama_base_url}/api/generate",
                json={
                    "model": model,
                    "system": system,
                    "prompt": prompt,
                    "stream": False,
                    "options": {"temperature": 0.3, "num_ctx": 4096},
                },
                timeout=60.0,
            )
            if response.status_code == 200:
                answer = response.json().get("response", "Error generating response")
            else:
                answer = f"Error from LLM: {response.text}"
    except Exception as e:
        answer = f"Connection error: {str(e)}"

    # 9. Normalize refusals
    normalized = (answer or "").strip().lower()
    if "i'm sorry" in normalized and "can't assist" in normalized:
        if note_id:
            answer = (
                "I couldn't answer that from the current note context. "
                "Try asking a more specific question about the note content."
            )
        else:
            answer = (
                "I can help, but I need context from your knowledge base.\n\n"
                "Try one of these:\n"
                "- Mention a note with @ (type @ and pick a note)\n"
                "- Switch to Auto mode so I can search your notes\n"
                "- Import the article or video first so I can reference it."
            )

    # 10. Save messages
    u_msg = ChatMessage(session_id=session_id, role="user", content=question)
    ai_msg = ChatMessage(session_id=session_id, role="ai", content=answer)
    db.add(u_msg)
    db.add(ai_msg)
    db.commit()

    return {
        "answer": answer,
        "sources": sources,
        "session_id": session_id,
        "confidence": confidence,
        "retrieval_explanation": retrieval_explanation,
    }
