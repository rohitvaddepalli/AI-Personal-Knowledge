"""
Voice transcription router using Whisper via Ollama or local whisper model.
Falls back gracefully when whisper is not available.
"""
from fastapi import APIRouter, File, UploadFile, HTTPException
from pydantic import BaseModel
import httpx
import base64
import tempfile
import os
from app.config import settings

router = APIRouter(prefix="/api/voice", tags=["voice"])


class TranscriptionResponse(BaseModel):
    text: str
    model: str
    duration_ms: int | None = None


@router.post("/transcribe", response_model=TranscriptionResponse)
async def transcribe_audio(
    file: UploadFile = File(...),
    model: str = "whisper",
):
    """
    Transcribe an uploaded audio file using the Whisper model via Ollama.
    Accepts: webm, wav, mp3, ogg, m4a.
    Falls back to a placeholder message if Whisper is unavailable.
    """
    allowed = {".webm", ".wav", ".mp3", ".ogg", ".m4a", ".flac"}
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported audio format: {ext}. Allowed: {', '.join(allowed)}"
        )

    audio_bytes = await file.read()
    if len(audio_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty audio file")

    # Save to temp file
    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name

    try:
        import time
        start = time.time()

        # Try Ollama whisper endpoint
        try:
            audio_b64 = base64.b64encode(audio_bytes).decode()
            async with httpx.AsyncClient(timeout=120.0) as client:
                response = await client.post(
                    f"{settings.ollama_base_url}/api/generate",
                    json={
                        "model": "whisper",
                        "prompt": "",
                        "images": [audio_b64],  # Ollama multimodal format
                        "stream": False,
                    }
                )
            if response.status_code == 200:
                result = response.json().get("response", "").strip()
                elapsed = int((time.time() - start) * 1000)
                return TranscriptionResponse(text=result, model="whisper", duration_ms=elapsed)
        except Exception as ollama_err:
            print(f"Ollama whisper unavailable: {ollama_err}")

        # Fallback: try faster-whisper or openai-whisper if installed
        try:
            import whisper as openai_whisper  # type: ignore
            wmodel = openai_whisper.load_model("base")
            result_obj = wmodel.transcribe(tmp_path)
            text = result_obj.get("text", "").strip()
            elapsed = int((time.time() - start) * 1000)
            return TranscriptionResponse(text=text, model="openai-whisper-base", duration_ms=elapsed)
        except ImportError:
            pass
        except Exception as whisper_err:
            print(f"Local whisper failed: {whisper_err}")

        # Final fallback
        raise HTTPException(
            status_code=503,
            detail=(
                "Whisper is not available. "
                "Install 'openai-whisper' (pip install openai-whisper) or "
                "pull the whisper model in Ollama ('ollama pull whisper')."
            )
        )
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass
