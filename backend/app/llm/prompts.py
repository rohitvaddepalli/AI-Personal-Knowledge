from __future__ import annotations

from app.utils.security import sanitize_content_for_prompt


def bounded_context(text: str, limit: int = 4000) -> str:
    return sanitize_content_for_prompt((text or "")[:limit])


def strict_grounded_prompt(context: str, question: str, today: str) -> tuple[str, str]:
    system = (
        "You are a strictly grounded assistant. "
        "Answer only from provided source blocks. "
        "If the answer is missing, say so clearly and suggest the next retrieval step. "
        f"Today: {today}"
    )
    prompt = f"Context:\n{context}\n\nQuestion:\n{sanitize_content_for_prompt(question)}"
    return system, prompt


def editor_prompt(instruction: str, selected_text: str, context_text: str = "") -> tuple[str, str]:
    system = "You are an AI editor. Return only the rewritten text."
    prompt = (
        f"Instruction:\n{sanitize_content_for_prompt(instruction)}\n\n"
        f"Selected text:\n{bounded_context(selected_text)}\n\n"
        f"Optional context:\n{bounded_context(context_text, 1200)}"
    )
    return system, prompt


def continuation_prompt(content_before: str) -> tuple[str, str]:
    system = "You are an AI co-writer. Return only the continuation."
    prompt = f"Text before cursor:\n{bounded_context(content_before, 5000)}\n\nContinuation:"
    return system, prompt
