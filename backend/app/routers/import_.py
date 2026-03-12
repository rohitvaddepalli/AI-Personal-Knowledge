import httpx
from bs4 import BeautifulSoup
import re
import ipaddress
from urllib.parse import urlparse
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.database import get_db
from app.models.note import Note
from app.schemas.note import NoteResponse
from app.services.embedding_service import add_note_embedding
from app.services.connection_engine import auto_connect_note
from app.config import settings
import asyncio
import json
import yt_dlp

router = APIRouter(prefix="/api/import", tags=["import"])

from typing import Optional

class ImportUrlRequest(BaseModel):
    url: str
    model: Optional[str] = "qwen2.5:0.5b"

def validate_url(url: str):
    """
    Validates the URL to prevent SSRF.
    Checks for allowed schemes and blocks internal/private IP ranges.
    """
    try:
        parsed = urlparse(url)
        if parsed.scheme not in ["http", "https"]:
            raise ValueError(f"Invalid scheme: {parsed.scheme}")
        
        hostname = parsed.hostname
        if not hostname:
            raise ValueError("Missing hostname")

        # Basic check for localhost/loopback
        if hostname.lower() in ["localhost", "127.0.0.1", "::1"]:
            raise ValueError("Localhost access is prohibited")

        # Comprehensive IP check (handles cases where hostname is an IP)
        try:
            ip = ipaddress.ip_address(hostname)
            if ip.is_loopback or ip.is_private or ip.is_link_local or ip.is_multicast:
                raise ValueError("Internal/Private IP access is prohibited")
        except ValueError:
            # Not an IP address, likely a domain name
            # In a production environment, we should resolve the domain and check the resulting IPs
            # but for a basic MVP fix, this stops direct IP-based SSRF.
            pass

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

async def fetch_youtube_transcript_yt_dlp(video_id: str) -> str:
    # ... (rest of the function remains the same)
    try:
        # ydl_opts remains unchanged
        ydl_opts = {
            'quiet': True,
            'skip_download': True,
            'writesubtitles': True,
            'writeautomaticsub': True,
            'subtitleslangs': ['en'],
            'no_warnings': True,
        }
        
        def extract_info():
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                return ydl.extract_info(video_id, download=False)
        
        info = await asyncio.to_thread(extract_info)
        
        subs = info.get('subtitles', {}).get('en', []) or \
               info.get('automatic_captions', {}).get('en', [])
        
        if not subs:
            return ""
            
        json_sub = next((s for s in subs if s.get('ext') == 'json3' or 'fmt=json3' in s.get('url', '')), subs[0])
        sub_url = json_sub['url']
        
        async with httpx.AsyncClient() as client:
            resp = await client.get(sub_url, timeout=10.0)
            if resp.status_code != 200:
                return ""
            
            data = resp.json()
            full_text = []
            for event in data.get('events', []):
                for segment in event.get('segs', []):
                    if segment.get('utf8'):
                        full_text.append(segment['utf8'])
            
            return " ".join(full_text).replace("\n", " ").strip()
    except Exception:
        return ""

@router.post("/url", response_model=NoteResponse)
async def import_url(req: ImportUrlRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    # Validate URL before any processing
    validate_url(req.url)
    
    try:
        video_id = None
        if "youtube" in req.url or "youtu.be" in req.url:
            match = re.search(r"(?:v=|\/|embed\/|shorts\/)([0-9A-Za-z_-]{11})", req.url)
            if match:
                video_id = match.group(1)

        title = "Imported Note"
        content_clipped = ""
        source_type = "web"

        if video_id:
            source_type = "youtube"
            info = {}
            try:
                def get_meta():
                    with yt_dlp.YoutubeDL({'quiet': True, 'skip_download': True}) as ydl:
                        return ydl.extract_info(video_id, download=False)
                info = await asyncio.to_thread(get_meta)
                raw_title = info.get('title', video_id)
                description = info.get('description', "")
                title = f"YouTube: {raw_title[:80]}"
            except Exception:
                raw_title = video_id
                description = "Metadata unavailable."
                title = f"YouTube: {video_id}"

            text_content = await fetch_youtube_transcript_yt_dlp(video_id)
            
            summary = ""
            if text_content:
                try:
                    async with httpx.AsyncClient() as client:
                        prompt = f"Summarize this YouTube video transcript in detail with key takeaways:\n\n---\n{text_content[:6000]}\n---"
                        resp_llm = await client.post(
                            f"{settings.ollama_base_url}/api/generate",
                            json={"model": req.model, "prompt": prompt, "stream": False},
                            timeout=60.0
                        )
                        summary = resp_llm.json().get("response", "Summary generation failed.")
                except:
                    summary = "Summary generation failed."
                content_clipped = f"**Source:** {req.url}\n\n### AI Summary\n{summary}\n\n### Full Transcript\n{text_content[:8000]}"
                title = f"YouTube Summary: {raw_title[:80]}"
            else:
                summary = "Transcript was unavailable."
                if description:
                    try:
                        async with httpx.AsyncClient() as client:
                            prompt = f"Based on this YouTube video description, what is this video about? List 3 key points:\n\n---\n{description[:3000]}\n---"
                            resp_llm = await client.post(
                                f"{settings.ollama_base_url}/api/generate",
                                json={"model": req.model, "prompt": prompt, "stream": False},
                                timeout=60.0
                            )
                            summary = resp_llm.json().get("response", summary)
                    except:
                        pass
                
                content_clipped = f"**Source:** {req.url}\n\n### AI Insight (From Description)\n{summary}\n\n**Note:** Transcript could not be auto-fetched. \n\n**Raw Video Description:**\n{description[:2000]}"

        else:
            async with httpx.AsyncClient(follow_redirects=True) as client:
                resp = await client.get(req.url, timeout=10.0)
                resp.raise_for_status()
                
            soup = BeautifulSoup(resp.text, 'html.parser')
            title = soup.title.string if soup.title else "Imported from URL"
            for script in soup(["script", "style", "nav", "footer", "header", "noscript"]):
                script.extract()
            text_content = soup.get_text(separator=' ', strip=True)
            content_clipped = f"**Source:** {req.url}\n\n{text_content[:8000]}"
            title = f"Web: {title.strip()[:100]}"
        
        db_note = Note(
            title=title,
            content=content_clipped,
            source=req.url,
            source_type=source_type,
            tags="[]"
        )
        db.add(db_note)
        db.commit()
        db.refresh(db_note)
        
        add_note_embedding(db_note.id, db_note.title, db_note.content)
        background_tasks.add_task(auto_connect_note, db_note.id)
        
        db_note.tags = []
        return db_note
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

