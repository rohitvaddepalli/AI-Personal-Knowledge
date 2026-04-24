from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.llm.prompts import continuation_prompt, editor_prompt
from app.llm.router import generate_text, list_models as list_provider_models
from app.llm.types import LLMRequest
from app.schemas.search import AIEditRequest, AskRequest, AskResponse, AutoSuggestRequest
from app.services.rag_service import ask_brain, stream_brain

router = APIRouter(prefix="/api/ask", tags=["ask"])


@router.get("/models")
async def get_models(provider: str | None = None):
    return await list_provider_models(provider)


@router.post("", response_model=AskResponse)
async def ask_question(req: AskRequest, db: Session = Depends(get_db)):
    return await ask_brain(
        db,
        req.question,
        session_id=req.session_id,
        note_id=req.note_id,
        profile_context=req.profile_context,
        model=req.model or "qwen2.5:0.5b",
        provider=req.provider,
        mode=req.mode or "auto",
        top_k=req.top_k or 5,
        tags=req.tags,
        source_types=req.source_types,
        date_from=req.date_from,
        date_to=req.date_to,
        require_summary=req.require_summary,
        require_flashcards=req.require_flashcards,
        rerank_bias=req.rerank_bias,
    )


@router.post("/stream")
async def ask_question_stream(req: AskRequest, db: Session = Depends(get_db)):
    async def event_generator():
        async for payload, session_id, rag in stream_brain(
            db,
            req.question,
            session_id=req.session_id,
            note_id=req.note_id,
            profile_context=req.profile_context,
            model=req.model or "qwen2.5:0.5b",
            provider=req.provider,
            top_k=req.top_k or 5,
            tags=req.tags,
            source_types=req.source_types,
            date_from=req.date_from,
            date_to=req.date_to,
            require_summary=req.require_summary,
            require_flashcards=req.require_flashcards,
            rerank_bias=req.rerank_bias,
        ):
            payload["session_id"] = session_id
            payload["sources"] = rag["sources"]
            payload["retrieval_explanation"] = rag["retrieval_explanation"]
            payload["confidence"] = rag["confidence"]
            yield f"data: {json.dumps(payload)}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.delete("/models/{model_name}")
async def delete_model(model_name: str):
    from app.config import settings
    import httpx

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.request("DELETE", f"{settings.ollama_base_url}/api/delete", json={"name": model_name})
            if response.status_code == 200:
                return {"status": "success", "message": f"Model {model_name} deleted"}
            raise HTTPException(status_code=response.status_code, detail=f"Ollama error: {response.text}")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc


class PullModelRequest(BaseModel):
    model: str


@router.post("/pull-model")
async def pull_model(req: PullModelRequest):
    from app.config import settings
    import httpx

    async def event_generator():
        try:
            async with httpx.AsyncClient(timeout=600.0) as client:
                async with client.stream("POST", f"{settings.ollama_base_url}/api/pull", json={"name": req.model, "stream": True}) as response:
                    if response.status_code != 200:
                        yield json.dumps({"status": "error", "message": "Failed to connect to Ollama"}) + "\n"
                        return
                    async for chunk in response.aiter_lines():
                        if chunk:
                            yield chunk + "\n"
        except Exception as exc:
            yield json.dumps({"status": "error", "message": str(exc)}) + "\n"

    return StreamingResponse(event_generator(), media_type="application/x-ndjson")


@router.post("/autocomplete")
async def autocomplete(req: AutoSuggestRequest):
    system, prompt = continuation_prompt(req.content_before)
    result = await generate_text(
        LLMRequest(
            feature="edit",
            prompt=prompt,
            system=system,
            model=req.model,
            provider=req.provider,
            max_tokens=80,
        )
    )
    return {"suggestion": result.content.strip()}


@router.post("/ai-edit")
async def ai_edit(req: AIEditRequest):
    system, prompt = editor_prompt(req.instruction, req.selected_text, req.context_text or "")
    result = await generate_text(
        LLMRequest(
            feature="edit",
            prompt=prompt,
            system=system,
            model=req.model,
            provider=req.provider,
            max_tokens=512,
        )
    )
    return {"result": result.content.strip()}
