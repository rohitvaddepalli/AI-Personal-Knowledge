"""
Phase 6.1 — Interoperability router

Endpoints:
  GET  /api/interop/export/obsidian          — full vault ZIP (YAML frontmatter, backlinks, attachments index)
  GET  /api/interop/export/graph/json        — knowledge graph as JSON (nodes + edges)
  GET  /api/interop/export/graph/svg         — knowledge graph as SVG (static render)
  POST /api/interop/import/notion            — import Notion markdown export ZIP
  POST /api/interop/import/roam              — import Roam Research JSON
  POST /api/interop/import/markdown-zip      — import any flat folder of .md files
"""

from __future__ import annotations

import io
import json
import re
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.connection import Connection
from app.models.note import Note
from app.services.embedding_service import add_note_embedding
from app.services.connection_engine import auto_connect_note

router = APIRouter(prefix="/api/interop", tags=["interop"])


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _safe_slug(title: str, note_id: str = "") -> str:
    """Convert a note title to a filesystem-safe filename slug."""
    name = (title or "").strip()
    name = re.sub(r"[\r\n\\/<>:\"|?*]", "_", name)
    name = re.sub(r"\s+", "_", name).strip(" ._")
    name = name.replace("..", ".")
    if not name:
        name = f"note_{note_id}"
    return name[:100]


def _load_tags(raw: Optional[str]) -> List[str]:
    try:
        return json.loads(raw) if raw else []
    except Exception:
        return []


def _note_to_obsidian_md(note: Note, backlinks: List[str]) -> str:
    """Render a Note as Obsidian-flavoured Markdown with YAML frontmatter."""
    tags = _load_tags(note.tags)
    created = note.created_at.isoformat() if note.created_at else ""
    updated = note.updated_at.isoformat() if note.updated_at else ""

    yaml_tags = "\n".join(f"  - {t}" for t in tags) if tags else ""
    yaml_tags_block = f"tags:\n{yaml_tags}" if yaml_tags else "tags: []"

    backlink_block = ""
    if backlinks:
        links = "\n".join(f"- [[{b}]]" for b in backlinks)
        backlink_block = f"\n\n---\n## Backlinks\n{links}"

    source_block = ""
    if note.source:
        source_block = f"\nsource: \"{note.source}\""

    return (
        f"---\n"
        f"title: \"{(note.title or 'Untitled').replace(chr(34), chr(39))}\"\n"
        f"{yaml_tags_block}\n"
        f"created: {created}\n"
        f"updated: {updated}\n"
        f"id: {note.id}{source_block}\n"
        f"---\n\n"
        f"# {note.title or 'Untitled'}\n\n"
        f"{note.content or ''}"
        f"{backlink_block}\n"
    )


# ─────────────────────────────────────────────────────────────────────────────
# 6.1 Export — Obsidian vault
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/export/obsidian")
def export_obsidian_vault(db: Session = Depends(get_db)):
    """
    Full Obsidian vault export:
    - YAML frontmatter (title, tags, created, updated, source)
    - [[WikiLink]] backlinks section per note
    - .obsidian/app.json, graph.json, community-plugins.json stubs
    - _index.md with note list and stats
    """
    notes = (
        db.query(Note)
        .filter(Note.is_archived == False, Note.deleted_at == None)
        .order_by(Note.created_at.desc())
        .all()
    )
    connections = db.query(Connection).all()

    # Build backlink map: note_id -> list of source note titles
    backlink_map: dict[str, List[str]] = {n.id: [] for n in notes}
    id_to_title: dict[str, str] = {n.id: (n.title or "Untitled") for n in notes}
    for conn in connections:
        if conn.target_note_id in backlink_map:
            src_title = id_to_title.get(conn.source_note_id, conn.source_note_id)
            backlink_map[conn.target_note_id].append(src_title)

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        # Write notes
        seen_slugs: dict[str, int] = {}
        slug_map: dict[str, str] = {}
        for note in notes:
            base_slug = _safe_slug(note.title or "Untitled", note.id)
            slug = base_slug
            if slug in seen_slugs:
                seen_slugs[slug] += 1
                slug = f"{base_slug}_{seen_slugs[base_slug]}"
            else:
                seen_slugs[slug] = 0
            slug_map[note.id] = slug
            content = _note_to_obsidian_md(note, backlink_map.get(note.id, []))
            zf.writestr(f"notes/{slug}.md", content)

        # Obsidian config stubs
        zf.writestr(".obsidian/app.json", json.dumps({
            "legacyEditor": False,
            "livePreview": True,
            "defaultViewMode": "source",
        }, indent=2))
        zf.writestr(".obsidian/graph.json", json.dumps({
            "collapse-filter": False,
            "search": "",
            "showTags": True,
            "showAttachments": False,
            "hideUnresolved": False,
        }, indent=2))
        zf.writestr(".obsidian/community-plugins.json", json.dumps([], indent=2))

        # Graph export (machine-readable)
        graph_nodes = [
            {"id": n.id, "title": n.title or "Untitled", "slug": slug_map.get(n.id, "")}
            for n in notes
        ]
        graph_edges = [
            {"source": c.source_note_id, "target": c.target_note_id, "weight": getattr(c, "strength", 1.0)}
            for c in connections
        ]
        zf.writestr("graph.json", json.dumps({"nodes": graph_nodes, "edges": graph_edges}, indent=2))

        # Index
        index_lines = [
            "# Second Brain — Vault Index",
            f"\n_Exported: {datetime.now(timezone.utc).isoformat()}_\n",
            f"**{len(notes)} notes** · **{len(connections)} connections**\n",
            "---\n",
        ]
        for note in notes:
            slug = slug_map.get(note.id, "")
            tags = _load_tags(note.tags)
            tag_str = " ".join(f"`{t}`" for t in tags) if tags else ""
            index_lines.append(f"- [[{slug}]] {tag_str}")
        zf.writestr("_index.md", "\n".join(index_lines))

    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=second_brain_obsidian_vault.zip"},
    )


# ─────────────────────────────────────────────────────────────────────────────
# 6.1 Export — Graph JSON / SVG
# ─────────────────────────────────────────────────────────────────────────────

@router.get("/export/graph/json")
def export_graph_json(db: Session = Depends(get_db)):
    """Export the full knowledge graph as JSON (nodes + edges)."""
    notes = db.query(Note).filter(Note.is_archived == False, Note.deleted_at == None).all()
    connections = db.query(Connection).all()
    return {
        "nodes": [
            {
                "id": n.id,
                "label": n.title or "Untitled",
                "tags": _load_tags(n.tags),
                "created_at": n.created_at.isoformat() if n.created_at else None,
            }
            for n in notes
        ],
        "edges": [
            {
                "source": c.source_note_id,
                "target": c.target_note_id,
                "strength": getattr(c, "strength", 1.0),
            }
            for c in connections
        ],
        "meta": {
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "note_count": len(notes),
            "edge_count": len(connections),
        },
    }


@router.get("/export/graph/svg")
def export_graph_svg(db: Session = Depends(get_db)):
    """Export a static SVG representation of the knowledge graph."""
    import math

    notes = db.query(Note).filter(Note.is_archived == False, Note.deleted_at == None).all()
    connections = db.query(Connection).all()

    # Cap SVG complexity
    nodes = notes[:200]
    node_ids = {n.id for n in nodes}
    edges = [c for c in connections if c.source_note_id in node_ids and c.target_note_id in node_ids]

    W, H = 1200, 900
    count = len(nodes)
    positions: dict[str, tuple[float, float]] = {}

    # Circular layout
    for i, note in enumerate(nodes):
        angle = 2 * math.pi * i / max(count, 1)
        r = min(W, H) * 0.38
        x = W / 2 + r * math.cos(angle)
        y = H / 2 + r * math.sin(angle)
        positions[note.id] = (x, y)

    lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">',
        "<defs>",
        '<marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">',
        '<path d="M0,0 L0,6 L8,3 z" fill="#6366f1"/>',
        "</marker>",
        "</defs>",
        f'<rect width="{W}" height="{H}" fill="#0f0f13"/>',
    ]

    # Edges
    for edge in edges:
        sx, sy = positions.get(edge.source_note_id, (W / 2, H / 2))
        tx, ty = positions.get(edge.target_note_id, (W / 2, H / 2))
        lines.append(
            f'<line x1="{sx:.1f}" y1="{sy:.1f}" x2="{tx:.1f}" y2="{ty:.1f}" '
            f'stroke="#6366f1" stroke-width="1" stroke-opacity="0.35" marker-end="url(#arrow)"/>'
        )

    # Nodes
    for note in nodes:
        x, y = positions[note.id]
        label = (note.title or "Untitled")[:28]
        label = label.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        lines.append(
            f'<circle cx="{x:.1f}" cy="{y:.1f}" r="7" fill="#6366f1" stroke="#a5b4fc" stroke-width="1.5"/>'
        )
        lines.append(
            f'<text x="{x:.1f}" y="{y - 11:.1f}" text-anchor="middle" '
            f'font-size="9" fill="#e2e8f0" font-family="ui-monospace,monospace">{label}</text>'
        )

    lines.append("</svg>")
    svg = "\n".join(lines)
    return StreamingResponse(
        io.BytesIO(svg.encode()),
        media_type="image/svg+xml",
        headers={"Content-Disposition": "attachment; filename=knowledge_graph.svg"},
    )


# ─────────────────────────────────────────────────────────────────────────────
# 6.1 Import — Notion ZIP
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/import/notion")
async def import_notion_zip(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Import a Notion markdown export ZIP.
    Handles Notion's exported format: each page is a .md file, possibly nested.
    Strips Notion's UUID suffixes from filenames.
    """
    if not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Upload must be a .zip file.")

    raw = await file.read()
    if len(raw) > 100 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="ZIP too large (max 100 MB).")

    created_count = 0
    skipped = 0
    errors = []

    try:
        with zipfile.ZipFile(io.BytesIO(raw)) as zf:
            md_files = [n for n in zf.namelist() if n.endswith(".md") and not n.startswith("__MACOSX")]
            for name in md_files[:500]:  # cap at 500 notes
                try:
                    content_bytes = zf.read(name)
                    content_raw = content_bytes.decode("utf-8", errors="replace")

                    # Notion filenames: "Page Title abc123def456.md" — strip UUID suffix
                    base = Path(name).stem
                    title = re.sub(r"\s+[0-9a-f]{32}$", "", base).strip()
                    title = title or "Imported Note"

                    # Strip Notion metadata table at top if present
                    content = re.sub(r"^(\|.+\|\n)+\n?", "", content_raw, flags=re.MULTILINE)
                    content = content.strip()

                    if not content:
                        skipped += 1
                        continue

                    note = Note(title=title, content=content, source="notion-import", source_type="import", tags="[]")
                    db.add(note)
                    db.flush()
                    created_count += 1
                except Exception as e:
                    errors.append(f"{name}: {str(e)}")

            db.commit()
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="Invalid or corrupt ZIP file.")

    return {
        "imported": created_count,
        "skipped": skipped,
        "errors": errors[:20],
    }


# ─────────────────────────────────────────────────────────────────────────────
# 6.1 Import — Roam Research JSON
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/import/roam")
async def import_roam_json(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Import a Roam Research JSON export.
    Roam exports an array of page objects: [{title, children: [{string, children}]}].
    """
    if not file.filename.endswith(".json"):
        raise HTTPException(status_code=400, detail="Upload must be a .json file.")

    raw = await file.read()
    if len(raw) > 50 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="JSON too large (max 50 MB).")

    try:
        pages = json.loads(raw.decode("utf-8", errors="replace"))
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON file.")

    if not isinstance(pages, list):
        raise HTTPException(status_code=400, detail="Expected a JSON array of Roam pages.")

    def _roam_blocks_to_md(blocks, depth=0) -> str:
        """Recursively flatten Roam block tree to Markdown."""
        lines = []
        for block in (blocks or []):
            text = block.get("string", "").strip()
            # Convert Roam's {{[[TODO]]}} and [[PageRef]] to plain text
            text = re.sub(r"\{\{.*?\}\}", "", text)
            text = re.sub(r"\[\[(.+?)\]\]", r"\1", text)
            indent = "  " * depth
            if text:
                lines.append(f"{indent}- {text}")
            children = block.get("children", [])
            if children:
                lines.append(_roam_blocks_to_md(children, depth + 1))
        return "\n".join(lines)

    created_count = 0
    errors = []

    for page in pages[:500]:
        try:
            title = page.get("title", "Imported Roam Page").strip()
            children = page.get("children", [])
            content = _roam_blocks_to_md(children)
            if not content and not title:
                continue

            note = Note(title=title, content=content, source="roam-import", source_type="import", tags="[]")
            db.add(note)
            created_count += 1
        except Exception as e:
            errors.append(f"{page.get('title', '?')}: {str(e)}")

    db.commit()
    return {"imported": created_count, "errors": errors[:20]}


# ─────────────────────────────────────────────────────────────────────────────
# 6.1 Import — Generic Markdown ZIP
# ─────────────────────────────────────────────────────────────────────────────

@router.post("/import/markdown-zip")
async def import_markdown_zip(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """
    Import any flat or nested collection of .md files from a ZIP.
    Title = filename stem; content = file body (YAML frontmatter stripped and parsed for tags).
    """
    if not file.filename.endswith(".zip"):
        raise HTTPException(status_code=400, detail="Upload must be a .zip file.")

    raw = await file.read()
    if len(raw) > 100 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="ZIP too large (max 100 MB).")

    YAML_FRONT = re.compile(r"^---\n(.*?)\n---\n?", re.DOTALL)
    TAG_LINE = re.compile(r"^tags:\s*(.+)", re.MULTILINE | re.IGNORECASE)

    created_count = 0
    skipped = 0
    errors = []

    try:
        with zipfile.ZipFile(io.BytesIO(raw)) as zf:
            md_files = [n for n in zf.namelist() if n.endswith(".md") and not n.startswith("__MACOSX")]
            for name in md_files[:1000]:
                try:
                    content_bytes = zf.read(name)
                    raw_text = content_bytes.decode("utf-8", errors="replace").strip()
                    if not raw_text:
                        skipped += 1
                        continue

                    # Extract YAML frontmatter
                    tags: List[str] = []
                    fm_match = YAML_FRONT.match(raw_text)
                    if fm_match:
                        fm_block = fm_match.group(1)
                        raw_text = raw_text[fm_match.end():]
                        tag_match = TAG_LINE.search(fm_block)
                        if tag_match:
                            raw_tags = tag_match.group(1).strip()
                            # Handle both "tag1, tag2" and "- tag" YAML list styles
                            if raw_tags.startswith("["):
                                tags = [t.strip().strip('"') for t in raw_tags.strip("[]").split(",") if t.strip()]
                            else:
                                tags = [t.lstrip("- ").strip() for t in raw_tags.split("\n") if t.strip()]

                    # Derive title from first H1 or filename
                    h1_match = re.match(r"^#\s+(.+)", raw_text)
                    title = h1_match.group(1).strip() if h1_match else Path(name).stem.replace("_", " ").replace("-", " ").strip()
                    title = title[:200]

                    note = Note(
                        title=title,
                        content=raw_text,
                        source="md-import",
                        source_type="import",
                        tags=json.dumps(tags),
                    )
                    db.add(note)
                    created_count += 1
                except Exception as e:
                    errors.append(f"{name}: {str(e)}")

            db.commit()
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="Invalid or corrupt ZIP file.")

    return {"imported": created_count, "skipped": skipped, "errors": errors[:20]}
