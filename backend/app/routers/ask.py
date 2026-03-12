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
        model=req.model
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
