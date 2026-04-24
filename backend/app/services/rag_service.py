from __future__ import annotations

import re
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.llm.router import generate_text, stream_text
from app.llm.types import LLMRequest
from app.models.chat import ChatMessage, ChatSession
from app.models.note import Note
from app.services.search_service import hybrid_search
from app.utils.security import sanitize_content_for_prompt


def _extract_snippet(content: str, max_chars: int = 200) -> str:
    paragraphs = [p.strip() for p in content.split("\n\n") if p.strip()]
    for paragraph in paragraphs:
        if len(paragraph) >= 30:
            return paragraph[:max_chars] + ("..." if len(paragraph) > max_chars else "")
    return content[:max_chars]


def _save_chat_messages(db: Session, session_id: int, question: str, answer: str) -> None:
    db.add(ChatMessage(session_id=session_id, role="user", content=question))
    db.add(ChatMessage(session_id=session_id, role="ai", content=answer))
    db.commit()


def _load_session(db: Session, question: str, session_id: int | None, note_id: str | None) -> ChatSession:
    if session_id:
        existing = db.query(ChatSession).filter(ChatSession.id == session_id).first()
        if existing:
            return existing
    session = ChatSession(title=question[:50], note_id=note_id)
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def build_rag_context(
    db: Session,
    question: str,
    note_id: str | None = None,
    top_k: int = 5,
    tags: list[str] | None = None,
    source_types: list[str] | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    require_summary: bool = False,
    require_flashcards: bool = False,
    rerank_bias: float = 0.5,
) -> dict[str, Any]:
    context_chunks: list[str] = []
    sources: list[dict[str, Any]] = []
    retrieval_explanation = ""
    confidence = 0.05

    if note_id:
        target = db.query(Note).filter(Note.id == note_id).first()
        if target:
            context_chunks.append(f"START_SOURCE: {target.title}\n{sanitize_content_for_prompt(target.content)}\nEND_SOURCE")
            sources.append({"id": target.id, "title": target.title, "snippet": _extract_snippet(target.content), "similarity": 1.0})
            retrieval_explanation = "Scoped to the selected note."
            confidence = 0.9
        return {"context_chunks": context_chunks, "sources": sources, "retrieval_explanation": retrieval_explanation, "confidence": confidence}

    mentions = re.findall(r"@([^@\n]+)", question)
    if mentions:
        titles = [item.strip() for item in mentions]
        matches = db.query(Note).filter(Note.title.in_(titles)).all()
        for note in matches:
            sources.append({"id": note.id, "title": note.title, "snippet": _extract_snippet(note.content), "similarity": 0.9})
            context_chunks.append(f"START_SOURCE: {note.title}\n{sanitize_content_for_prompt(note.content)}\nEND_SOURCE")
        retrieval_explanation = f"Scoped to @mentioned notes: {', '.join(titles)}."
        confidence = 0.85 if context_chunks else 0.15
        return {"context_chunks": context_chunks, "sources": sources, "retrieval_explanation": retrieval_explanation, "confidence": confidence}

    results = hybrid_search(
        db,
        query=question,
        limit=max(1, min(top_k, 20)),
        tags=tags,
        source_types=source_types,
        date_from=date_from,
        date_to=date_to,
        require_summary=require_summary,
        require_flashcards=require_flashcards,
        rerank_bias=rerank_bias,
    )
    if results:
        for result in results:
            sources.append({"id": result["id"], "title": result["title"], "snippet": _extract_snippet(result["content"]), "similarity": result["score"]})
            context_chunks.append(f"START_SOURCE: {result['title']}\n{sanitize_content_for_prompt(result['content'])}\nEND_SOURCE")
        confidence = round(min(0.95, results[0]["score"] * 10), 2)
        retrieval_explanation = f"Retrieved {len(results)} notes via hybrid search with semantic, keyword, and metadata reranking."
    else:
        retrieval_explanation = "No relevant notes found in the knowledge base."
    return {"context_chunks": context_chunks, "sources": sources, "retrieval_explanation": retrieval_explanation, "confidence": confidence}


async def ask_brain(
    db: Session,
    question: str,
    session_id: int | None = None,
    note_id: str | None = None,
    profile_context: str | None = None,
    model: str = "qwen2.5:0.5b",
    provider: str | None = None,
    mode: str = "auto",
    top_k: int = 5,
    tags: list[str] | None = None,
    source_types: list[str] | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    require_summary: bool = False,
    require_flashcards: bool = False,
    rerank_bias: float = 0.5,
):
    session = _load_session(db, question, session_id, note_id)
    rag = build_rag_context(
        db,
        question,
        note_id=note_id,
        top_k=top_k,
        tags=tags,
        source_types=source_types,
        date_from=date_from,
        date_to=date_to,
        require_summary=require_summary,
        require_flashcards=require_flashcards,
        rerank_bias=rerank_bias,
    )
    context_chunks = rag["context_chunks"]
    sources = rag["sources"]
    retrieval_explanation = rag["retrieval_explanation"]
    confidence = rag["confidence"]

    if mode == "search_only":
        answer = "No matching notes found." if not sources else "**Search results**\n\n" + "\n".join(f"- {item['title']}" for item in sources)
        _save_chat_messages(db, session.id, question, answer)
        return {"answer": answer, "sources": sources, "session_id": session.id, "confidence": confidence, "retrieval_explanation": retrieval_explanation}

    if mode == "strict_cited" and not context_chunks:
        answer = "I can't answer this with strict citations because no relevant notes were found."
        _save_chat_messages(db, session.id, question, answer)
        return {"answer": answer, "sources": [], "session_id": session.id, "confidence": 0.0, "retrieval_explanation": retrieval_explanation}

    history = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session.id)
        .order_by(ChatMessage.created_at.desc())
        .limit(5)
        .all()
    )
    history_ctx = "\n".join(f"{message.role.upper()}: {message.content}" for message in reversed(history))
    today = datetime.now().strftime("%Y-%m-%d")
    if mode == "strict_cited":
        system = (
            f"You are a strictly grounded AI assistant. Answer only from the provided source blocks. "
            f"State clearly when information is missing. Today: {today}"
        )
    elif context_chunks:
        system = (
            f"You are a helpful AI assistant. Use the provided note context as the primary source. "
            f"Call out when you rely on general knowledge beyond the user's notes. Today: {today}"
        )
    else:
        system = f"You are a helpful AI assistant. Today: {today}"
    if profile_context:
        system += f"\n\nUser context:\n{sanitize_content_for_prompt(profile_context)}"

    prompt_parts = []
    if context_chunks:
        prompt_parts.append("Context from notes:\n" + "\n\n".join(context_chunks))
    if history_ctx:
        prompt_parts.append("Previous conversation:\n" + history_ctx)
    prompt_parts.append("Question:\n" + sanitize_content_for_prompt(question))
    llm_response = await generate_text(
        LLMRequest(
            feature="chat",
            prompt="\n\n".join(prompt_parts),
            system=system,
            model=model,
            provider=provider,
            temperature=0.3,
            max_tokens=1024,
        )
    )
    answer = llm_response.content
    normalized = answer.strip().lower()
    if "can't assist" in normalized or "cannot comply" in normalized:
        answer = "I need better grounding from your notes. Try importing the source or narrowing the question."

    _save_chat_messages(db, session.id, question, answer)
    return {"answer": answer, "sources": sources, "session_id": session.id, "confidence": confidence, "retrieval_explanation": retrieval_explanation}


async def stream_brain(
    db: Session,
    question: str,
    session_id: int | None = None,
    note_id: str | None = None,
    profile_context: str | None = None,
    model: str = "qwen2.5:0.5b",
    provider: str | None = None,
    top_k: int = 5,
    tags: list[str] | None = None,
    source_types: list[str] | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    require_summary: bool = False,
    require_flashcards: bool = False,
    rerank_bias: float = 0.5,
):
    session = _load_session(db, question, session_id, note_id)
    rag = build_rag_context(
        db,
        question,
        note_id=note_id,
        top_k=top_k,
        tags=tags,
        source_types=source_types,
        date_from=date_from,
        date_to=date_to,
        require_summary=require_summary,
        require_flashcards=require_flashcards,
        rerank_bias=rerank_bias,
    )
    context = "\n\n".join(rag["context_chunks"])
    system = "You are a grounded assistant. Use the supplied sources as the primary evidence."
    if profile_context:
        system += f"\n\nUser context:\n{sanitize_content_for_prompt(profile_context)}"
    request = LLMRequest(
        feature="chat",
        prompt=f"Context:\n{context}\n\nQuestion:\n{sanitize_content_for_prompt(question)}",
        system=system,
        model=model,
        provider=provider,
        stream=True,
        max_tokens=1024,
    )
    accumulated: list[str] = []
    async for event in stream_text(request):
        if event.content:
            accumulated.append(event.content)
        yield event.model_dump(), session.id, rag
    _save_chat_messages(db, session.id, question, "".join(accumulated))
