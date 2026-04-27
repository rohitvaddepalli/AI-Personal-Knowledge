"""
Phase 6.3 — Public Garden router

Endpoints:
  PUT  /api/garden/note/{note_id}/publish        — make a note public
  PUT  /api/garden/note/{note_id}/unpublish      — retract a public note
  GET  /api/garden                               — list all public notes (paginated)
  GET  /api/garden/{slug}                        — view a single public note (HTML or JSON)
  GET  /api/garden/rss                           — RSS feed of public notes
  GET  /api/garden/sitemap.xml                   — Sitemap for public garden
"""

from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from typing import Optional
from xml.etree import ElementTree as ET

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import HTMLResponse, Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.note import Note

router = APIRouter(prefix="/api/garden", tags=["garden"])


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _slugify(title: str, note_id: str) -> str:
    slug = (title or "").lower()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug).strip("-")
    slug = slug[:60]
    return slug or note_id[:8]


def _load_tags(raw: Optional[str]) -> list[str]:
    try:
        return json.loads(raw) if raw else []
    except Exception:
        return []


def _md_to_html(md: str) -> str:
    """Minimal Markdown → HTML (headings, bold, italic, code, links, paragraphs)."""
    html = md
    # Headings
    for level in range(6, 0, -1):
        hashes = "#" * level
        html = re.sub(rf"^{hashes} +(.+)$", rf"<h{level}>\1</h{level}>", html, flags=re.MULTILINE)
    # Fenced code blocks
    html = re.sub(r"```[\w]*\n(.*?)```", r"<pre><code>\1</code></pre>", html, flags=re.DOTALL)
    # Inline code
    html = re.sub(r"`([^`]+)`", r"<code>\1</code>", html)
    # Bold
    html = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", html)
    # Italic
    html = re.sub(r"\*(.+?)\*", r"<em>\1</em>", html)
    # Links
    html = re.sub(r"\[([^\]]+)\]\(([^)]+)\)", r'<a href="\2" rel="noopener">\1</a>', html)
    # Paragraphs (blank line separated)
    blocks = re.split(r"\n{2,}", html)
    parts = []
    for b in blocks:
        b = b.strip()
        if not b:
            continue
        if b.startswith("<h") or b.startswith("<pre") or b.startswith("<ul") or b.startswith("<ol"):
            parts.append(b)
        else:
            parts.append(f"<p>{b}</p>")
    return "\n".join(parts)


GARDEN_HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{title} · Digital Garden</title>
<meta name="description" content="{excerpt}">
<style>
  :root {{ --bg:#0f0f13;--fg:#e2e8f0;--accent:#6366f1;--dim:#94a3b8;--border:#1e1e2e;--card:#1a1a2e }}
  *{{box-sizing:border-box;margin:0;padding:0}}
  body{{background:var(--bg);color:var(--fg);font:1rem/1.7 'Georgia',serif;padding:2rem 1rem}}
  .wrap{{max-width:720px;margin:0 auto}}
  header{{margin-bottom:2.5rem;border-bottom:1px solid var(--border);padding-bottom:1.5rem}}
  header a{{color:var(--accent);text-decoration:none;font-size:.875rem}}
  h1{{font-size:2rem;font-weight:700;margin:.75rem 0 .5rem;line-height:1.25}}
  .meta{{font-size:.8125rem;color:var(--dim);margin-bottom:1.5rem;display:flex;gap:1rem;flex-wrap:wrap}}
  .tag{{background:var(--card);border:1px solid var(--border);border-radius:999px;padding:2px 10px;font-size:.75rem;color:var(--accent)}}
  article h1,article h2,article h3{{margin:1.5rem 0 .75rem;font-weight:700;line-height:1.3}}
  article h1{{font-size:1.5rem}}article h2{{font-size:1.25rem}}article h3{{font-size:1.1rem}}
  article p{{margin-bottom:1rem}}
  article pre{{background:var(--card);border:1px solid var(--border);border-radius:8px;padding:1rem;overflow-x:auto;margin-bottom:1rem}}
  article code{{background:var(--card);padding:2px 6px;border-radius:4px;font-size:.875em;font-family:ui-monospace,monospace}}
  article pre code{{background:none;padding:0}}
  article a{{color:var(--accent)}}
  article strong{{font-weight:700}}
  footer{{margin-top:3rem;padding-top:1rem;border-top:1px solid var(--border);font-size:.8125rem;color:var(--dim)}}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <a href="/api/garden">← All notes</a>
    <h1>{title}</h1>
    <div class="meta">
      <span>{date}</span>
      {tags}
    </div>
  </header>
  <article>{body}</article>
  <footer>Published from <a href="/">Second Brain</a> · Digital Garden</footer>
</div>
</body>
</html>"""

GARDEN_INDEX_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Digital Garden</title>
<style>
  :root{{--bg:#0f0f13;--fg:#e2e8f0;--accent:#6366f1;--dim:#94a3b8;--border:#1e1e2e;--card:#1a1a2e}}
  *{{box-sizing:border-box;margin:0;padding:0}}
  body{{background:var(--bg);color:var(--fg);font:1rem/1.7 system-ui,sans-serif;padding:2rem 1rem}}
  .wrap{{max-width:800px;margin:0 auto}}
  h1{{font-size:2rem;font-weight:800;margin-bottom:.5rem}}
  .sub{{color:var(--dim);margin-bottom:2rem;font-size:.9375rem}}
  .note{{background:var(--card);border:1px solid var(--border);border-radius:12px;padding:1.25rem 1.5rem;margin-bottom:1rem;transition:border-color 200ms}}
  .note:hover{{border-color:var(--accent)}}
  .note a{{color:inherit;text-decoration:none}}
  .note-title{{font-size:1.125rem;font-weight:700;margin-bottom:.25rem}}
  .note-meta{{font-size:.8125rem;color:var(--dim);display:flex;gap:.75rem;flex-wrap:wrap}}
  .tag{{background:#1e1e3a;border-radius:999px;padding:1px 8px;font-size:.6875rem;color:var(--accent)}}
  .excerpt{{font-size:.875rem;color:var(--dim);margin-top:.5rem;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}}
  .rss{{float:right;font-size:.8125rem;color:var(--accent);text-decoration:none}}
</style>
</head>
<body>
<div class="wrap">
  <div style="display:flex;align-items:center;margin-bottom:.5rem">
    <h1>🌱 Digital Garden</h1>
    <a class="rss" href="/api/garden/rss">RSS Feed ↗</a>
  </div>
  <p class="sub">{count} public notes</p>
  {notes_html}
</div>
</body>
</html>"""


# ─────────────────────────────────────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────────────────────────────────────

@router.put("/note/{note_id}/publish")
def publish_note(note_id: str, db: Session = Depends(get_db)):
    """Make a note publicly visible in the garden."""
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found.")
    note.is_public = True
    db.commit()
    slug = _slugify(note.title or "", note_id)
    return {"status": "published", "slug": slug, "garden_url": f"/api/garden/{slug}"}


@router.put("/note/{note_id}/unpublish")
def unpublish_note(note_id: str, db: Session = Depends(get_db)):
    """Retract a note from the public garden."""
    note = db.query(Note).filter(Note.id == note_id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found.")
    note.is_public = False
    db.commit()
    return {"status": "unpublished"}


@router.get("", response_class=HTMLResponse)
def garden_index(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    request: Request = None,
):
    """Public garden index — list of all published notes."""
    # Accept JSON or HTML based on Accept header
    accept = request.headers.get("accept", "") if request else ""
    public_notes = (
        db.query(Note)
        .filter(Note.is_public == True, Note.deleted_at == None)
        .order_by(Note.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    if "application/json" in accept:
        return [
            {
                "id": n.id,
                "title": n.title,
                "slug": _slugify(n.title or "", n.id),
                "tags": _load_tags(n.tags),
                "created_at": n.created_at.isoformat() if n.created_at else None,
                "excerpt": (n.content or "")[:200],
            }
            for n in public_notes
        ]

    notes_html_parts = []
    for n in public_notes:
        slug = _slugify(n.title or "", n.id)
        tags = _load_tags(n.tags)
        tag_html = " ".join(f'<span class="tag">{t}</span>' for t in tags)
        excerpt = re.sub(r"#+ |```.*?```|\*\*|\*|`", "", n.content or "")[:180]
        date = (n.created_at.date().isoformat() if n.created_at else "")
        notes_html_parts.append(
            f'<div class="note"><a href="/api/garden/{slug}">'
            f'<div class="note-title">{n.title or "Untitled"}</div>'
            f'<div class="note-meta"><span>{date}</span>{tag_html}</div>'
            f'<div class="excerpt">{excerpt}</div>'
            f"</a></div>"
        )

    total = db.query(Note).filter(Note.is_public == True, Note.deleted_at == None).count()
    html = GARDEN_INDEX_HTML.format(count=total, notes_html="\n".join(notes_html_parts))
    return HTMLResponse(content=html)


@router.get("/rss")
def garden_rss(db: Session = Depends(get_db), request: Request = None):
    """RSS 2.0 feed of public garden notes."""
    base = str(request.base_url).rstrip("/") if request else "http://localhost:8000"
    notes = (
        db.query(Note)
        .filter(Note.is_public == True, Note.deleted_at == None)
        .order_by(Note.created_at.desc())
        .limit(50)
        .all()
    )

    rss = ET.Element("rss", version="2.0")
    channel = ET.SubElement(rss, "channel")
    ET.SubElement(channel, "title").text = "Digital Garden"
    ET.SubElement(channel, "link").text = f"{base}/api/garden"
    ET.SubElement(channel, "description").text = "Public notes from Second Brain"
    ET.SubElement(channel, "language").text = "en"

    for n in notes:
        slug = _slugify(n.title or "", n.id)
        item = ET.SubElement(channel, "item")
        ET.SubElement(item, "title").text = n.title or "Untitled"
        ET.SubElement(item, "link").text = f"{base}/api/garden/{slug}"
        ET.SubElement(item, "guid").text = n.id
        ET.SubElement(item, "description").text = (n.content or "")[:500]
        if n.created_at:
            ET.SubElement(item, "pubDate").text = n.created_at.strftime("%a, %d %b %Y %H:%M:%S +0000")

    xml_bytes = ET.tostring(rss, encoding="unicode", xml_declaration=False)
    return Response(
        content=f'<?xml version="1.0" encoding="UTF-8"?>\n{xml_bytes}',
        media_type="application/rss+xml; charset=utf-8",
    )


@router.get("/sitemap.xml")
def garden_sitemap(db: Session = Depends(get_db), request: Request = None):
    """XML sitemap of all public notes for SEO."""
    base = str(request.base_url).rstrip("/") if request else "http://localhost:8000"
    notes = (
        db.query(Note)
        .filter(Note.is_public == True, Note.deleted_at == None)
        .all()
    )
    urlset = ET.Element("urlset", xmlns="http://www.sitemaps.org/schemas/sitemap/0.9")
    for n in notes:
        slug = _slugify(n.title or "", n.id)
        url = ET.SubElement(urlset, "url")
        ET.SubElement(url, "loc").text = f"{base}/api/garden/{slug}"
        if n.updated_at:
            ET.SubElement(url, "lastmod").text = n.updated_at.date().isoformat()
        ET.SubElement(url, "changefreq").text = "weekly"
        ET.SubElement(url, "priority").text = "0.7"
    xml_bytes = ET.tostring(urlset, encoding="unicode")
    return Response(
        content=f'<?xml version="1.0" encoding="UTF-8"?>\n{xml_bytes}',
        media_type="application/xml",
    )


@router.get("/{slug}", response_class=HTMLResponse)
def garden_note(slug: str, db: Session = Depends(get_db), request: Request = None):
    """Render a single public note as HTML (or JSON if Accept: application/json)."""
    # Match by slug (best-effort: match title-derived slug)
    public_notes = db.query(Note).filter(Note.is_public == True, Note.deleted_at == None).all()
    note = next((n for n in public_notes if _slugify(n.title or "", n.id) == slug), None)
    if not note:
        # Try matching by ID prefix
        note = next((n for n in public_notes if n.id.startswith(slug)), None)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found in public garden.")

    accept = request.headers.get("accept", "") if request else ""
    if "application/json" in accept:
        return {
            "id": note.id,
            "title": note.title,
            "content": note.content,
            "tags": _load_tags(note.tags),
            "created_at": note.created_at.isoformat() if note.created_at else None,
        }

    tags = _load_tags(note.tags)
    tag_html = " ".join(f'<span class="tag">{t}</span>' for t in tags)
    body_html = _md_to_html(note.content or "")
    excerpt = re.sub(r"[#*`]", "", note.content or "")[:160]
    date = note.created_at.date().isoformat() if note.created_at else ""

    html = GARDEN_HTML_TEMPLATE.format(
        title=note.title or "Untitled",
        excerpt=excerpt,
        date=date,
        tags=tag_html,
        body=body_html,
    )
    return HTMLResponse(content=html)
