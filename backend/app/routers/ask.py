from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.services.rag_service import ask_brain
from app.schemas.search import AskRequest, AskResponse
from pydantic import BaseModel
import httpx
from app.config import settings

router = APIRouter(prefix="/api/ask", tags=["ask"])

@router.get("/models")
async def get_models():
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{settings.ollama_base_url}/api/tags",
                timeout=10.0
            )
            if response.status_code == 200:
                models = response.json().get("models", [])
                return [m.get("name") for m in models]
            return ["qwen2.5:0.5b"] # default fallback
    except Exception as e:
        print(f"Error fetching models: {e}")
        return ["qwen2.5:0.5b"]

@router.post("", response_model=AskResponse)
async def ask_question(req: AskRequest, db: Session = Depends(get_db)):
    result = await ask_brain(
        db,
        req.question,
        session_id=req.session_id,
        note_id=req.note_id,
        profile_context=req.profile_context,
        model=req.model,
        mode=req.mode or "auto"
    )
    return result

from fastapi.responses import StreamingResponse
import json

@router.delete("/models/{model_name}")
async def delete_model(model_name: str):
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.request(
                "DELETE",
                f"{settings.ollama_base_url}/api/delete",
                json={"name": model_name}
            )
            if response.status_code == 200:
                return {"status": "success", "message": f"Model {model_name} deleted"}
            raise HTTPException(status_code=response.status_code, detail=f"Ollama error: {response.text}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class PullModelRequest(BaseModel):
    model: str

@router.post("/pull-model")
async def pull_model(req: PullModelRequest):
    async def event_generator():
        try:
            async with httpx.AsyncClient(timeout=600.0) as client:
                async with client.stream(
                    "POST", 
                    f"{settings.ollama_base_url}/api/pull",
                    json={"name": req.model, "stream": True}
                ) as response:
                    if response.status_code != 200:
                        yield json.dumps({"status": "error", "message": "Failed to connect to Ollama"}) + "\n"
                        return
                    
                    async for chunk in response.aiter_lines():
                        if chunk:
                            yield chunk + "\n"
        except Exception as e:
            yield json.dumps({"status": "error", "message": str(e)}) + "\n"

    return StreamingResponse(event_generator(), media_type="application/x-ndjson")


from app.schemas.search import AutoSuggestRequest, AIEditRequest

@router.post("/autocomplete")
async def autocomplete(req: AutoSuggestRequest):
    prompt = (
        "You are an AI co-writer. Continue the user's text naturally.\n"
        "Return ONLY the suggested continuation text, no explanation.\n"
        "If you don't have a good continuation, return an empty string.\n\n"
        "TEXT BEFORE CURSOR:\n"
        f"{req.content_before}\n\n"
        "CONTINUATION:"
    )
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{settings.ollama_base_url}/api/generate",
                json={
                    "model": req.model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "num_predict": 50,
                        "stop": ["\n", "TEXT BEFORE CURSOR:", "CONTINUATION:"]
                    }
                },
                timeout=10.0
            )
            if response.status_code == 200:
                suggestion = response.json().get("response", "").strip()
                return {"suggestion": suggestion}
            return {"suggestion": ""}
    except Exception as e:
        print(f"Autocomplete error: {e}")
        return {"suggestion": ""}

@router.post("/ai-edit")
async def ai_edit(req: AIEditRequest):
    prompt = (
        "You are an AI editor. Re-write the selected text based on the instruction.\n"
        "Instruction: {instruction}\n\n"
        "SELECTED TEXT:\n"
        "{selected_text}\n\n"
        "CONTEXT (optional):\n"
        "{context_text}\n\n"
        "REWRITTEN TEXT:"
    ).format(
        instruction=req.instruction,
        selected_text=req.selected_text,
        context_text=req.context_text
    )
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{settings.ollama_base_url}/api/generate",
                json={
                    "model": req.model,
                    "prompt": prompt,
                    "stream": False,
                },
                timeout=30.0
            )
            if response.status_code == 200:
                result = response.json().get("response", "").strip()
                return {"result": result}
            raise HTTPException(status_code=response.status_code, detail="Ollama error")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
