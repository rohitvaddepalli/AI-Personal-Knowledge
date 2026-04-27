"""
Phase 6.2 — CLI tool for Second Brain

Usage:
  python -m app.cli ingest <url-or-file>
  python -m app.cli chat "<question>"
  python -m app.cli export obsidian [--out <path>]
  python -m app.cli export graph-json [--out <path>]
  python -m app.cli notes list [--limit N]
  python -m app.cli notes search <query>
  python -m app.cli notes show <id>
  python -m app.cli webhook register --name <name> [--secret <s>]
  python -m app.cli webhook list

Run from the backend directory with:
  python -m app.cli --help

The CLI talks to the running API server (default: http://localhost:8000).
Override with: SB_API_URL=http://localhost:8000
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import httpx
import typer
from rich import print as rprint
from rich.console import Console
from rich.table import Table

app = typer.Typer(name="sb", help="Second Brain CLI — capture, search, chat, export.")
console = Console()

API_URL = os.getenv("SB_API_URL", "http://localhost:8000")


def _api(path: str) -> str:
    return f"{API_URL.rstrip('/')}{path}"


def _get(path: str, **kwargs) -> dict:
    try:
        r = httpx.get(_api(path), timeout=30, **kwargs)
        r.raise_for_status()
        return r.json()
    except httpx.ConnectError:
        rprint(f"[red]✗ Cannot connect to Second Brain API at {API_URL}[/red]")
        rprint("[dim]Is the backend running? Start with: uvicorn app.main:app --reload[/dim]")
        raise typer.Exit(1)
    except httpx.HTTPStatusError as e:
        rprint(f"[red]✗ API error {e.response.status_code}: {e.response.text[:200]}[/red]")
        raise typer.Exit(1)


def _post(path: str, **kwargs) -> dict:
    try:
        r = httpx.post(_api(path), timeout=60, **kwargs)
        r.raise_for_status()
        return r.json()
    except httpx.ConnectError:
        rprint(f"[red]✗ Cannot connect to Second Brain API at {API_URL}[/red]")
        raise typer.Exit(1)
    except httpx.HTTPStatusError as e:
        rprint(f"[red]✗ API error {e.response.status_code}: {e.response.text[:200]}[/red]")
        raise typer.Exit(1)


# ─────────────────────────────────────────────────────────────────────────────
# Notes commands
# ─────────────────────────────────────────────────────────────────────────────

notes_app = typer.Typer(help="Manage notes.")
app.add_typer(notes_app, name="notes")


@notes_app.command("list")
def notes_list(limit: int = typer.Option(20, "--limit", "-n", help="Max notes to show.")):
    """List recent notes."""
    data = _get(f"/api/notes?limit={limit}")
    notes = data if isinstance(data, list) else data.get("notes", [])
    if not notes:
        rprint("[dim]No notes found.[/dim]")
        return
    t = Table("ID", "Title", "Tags", "Created", show_header=True, header_style="bold cyan")
    for n in notes:
        tags = ", ".join(n.get("tags", []))
        created = (n.get("created_at") or "")[:10]
        t.add_row(str(n.get("id", ""))[:8], (n.get("title") or "Untitled")[:60], tags, created)
    console.print(t)


@notes_app.command("show")
def notes_show(note_id: str = typer.Argument(..., help="Note ID.")):
    """Show a single note."""
    data = _get(f"/api/notes/{note_id}")
    rprint(f"\n[bold]{data.get('title', 'Untitled')}[/bold]")
    rprint(f"[dim]ID: {data.get('id')} | Tags: {', '.join(data.get('tags', []))} | {(data.get('created_at') or '')[:10]}[/dim]\n")
    rprint(data.get("content", ""))


@notes_app.command("search")
def notes_search(query: str = typer.Argument(..., help="Search query.")):
    """Semantic + keyword search across all notes."""
    data = _post("/api/search", json={"query": query, "limit": 10})
    results = data.get("results", data) if isinstance(data, dict) else data
    if not results:
        rprint("[dim]No results found.[/dim]")
        return
    t = Table("Score", "Title", "Excerpt", show_header=True, header_style="bold cyan")
    for r in results:
        score = f"{r.get('score', 0):.2f}" if "score" in r else "—"
        excerpt = (r.get("content") or "")[:80].replace("\n", " ")
        t.add_row(score, (r.get("title") or "Untitled")[:50], excerpt)
    console.print(t)


# ─────────────────────────────────────────────────────────────────────────────
# Ingest command
# ─────────────────────────────────────────────────────────────────────────────

@app.command("ingest")
def ingest(
    source: str = typer.Argument(..., help="URL or local file path to ingest."),
    model: str = typer.Option("qwen2.5:0.5b", "--model", "-m"),
):
    """Ingest a URL or file into your Second Brain."""
    if source.startswith("http://") or source.startswith("https://"):
        rprint(f"[cyan]Importing URL:[/cyan] {source}")
        data = _post("/api/import/url", json={"url": source, "model": model})
        rprint(f"[green]✓[/green] Created note [bold]{data.get('title')}[/bold] (ID: {data.get('id')})")
    else:
        p = Path(source)
        if not p.exists():
            rprint(f"[red]✗ File not found: {source}[/red]")
            raise typer.Exit(1)
        rprint(f"[cyan]Uploading file:[/cyan] {p.name}")
        with open(p, "rb") as f:
            data = _post("/api/ingest/file", files={"file": (p.name, f)})
        rprint(f"[green]✓[/green] Ingested: {json.dumps(data, indent=2)}")


# ─────────────────────────────────────────────────────────────────────────────
# Chat command
# ─────────────────────────────────────────────────────────────────────────────

@app.command("chat")
def chat(
    question: str = typer.Argument(..., help="Question to ask your Second Brain."),
    mode: str = typer.Option("auto", "--mode", help="Retrieval mode: auto|search_only|strict_cited"),
):
    """Ask your Second Brain a question and get a grounded answer."""
    rprint(f"[cyan]Asking:[/cyan] {question}\n")
    data = _post("/api/ask", json={"query": question, "mode": mode})
    answer = data.get("answer") or data.get("response") or json.dumps(data)
    rprint(f"[bold green]Answer:[/bold green]\n{answer}")
    sources = data.get("sources", [])
    if sources:
        rprint(f"\n[dim]Sources: {', '.join(s.get('title', '?') for s in sources[:5])}[/dim]")


# ─────────────────────────────────────────────────────────────────────────────
# Export commands
# ─────────────────────────────────────────────────────────────────────────────

export_app = typer.Typer(help="Export your knowledge base.")
app.add_typer(export_app, name="export")


@export_app.command("obsidian")
def export_obsidian(
    out: Path = typer.Option(Path("second_brain_obsidian_vault.zip"), "--out", "-o"),
):
    """Export full Obsidian vault ZIP with YAML frontmatter and backlinks."""
    rprint("[cyan]Exporting Obsidian vault...[/cyan]")
    try:
        r = httpx.get(_api("/api/interop/export/obsidian"), timeout=120)
        r.raise_for_status()
        out.write_bytes(r.content)
        rprint(f"[green]✓[/green] Saved {len(r.content) // 1024} KB → [bold]{out}[/bold]")
    except Exception as e:
        rprint(f"[red]✗ Export failed: {e}[/red]")
        raise typer.Exit(1)


@export_app.command("graph-json")
def export_graph_json(
    out: Path = typer.Option(Path("knowledge_graph.json"), "--out", "-o"),
):
    """Export the knowledge graph as JSON."""
    data = _get("/api/interop/export/graph/json")
    out.write_text(json.dumps(data, indent=2))
    rprint(f"[green]✓[/green] Graph: {data['meta']['note_count']} nodes, {data['meta']['edge_count']} edges → [bold]{out}[/bold]")


@export_app.command("graph-svg")
def export_graph_svg(
    out: Path = typer.Option(Path("knowledge_graph.svg"), "--out", "-o"),
):
    """Export the knowledge graph as a static SVG."""
    try:
        r = httpx.get(_api("/api/interop/export/graph/svg"), timeout=60)
        r.raise_for_status()
        out.write_bytes(r.content)
        rprint(f"[green]✓[/green] Saved SVG → [bold]{out}[/bold]")
    except Exception as e:
        rprint(f"[red]✗ Export failed: {e}[/red]")
        raise typer.Exit(1)


# ─────────────────────────────────────────────────────────────────────────────
# Webhook commands
# ─────────────────────────────────────────────────────────────────────────────

webhook_app = typer.Typer(help="Manage webhook ingestion sources.")
app.add_typer(webhook_app, name="webhook")


@webhook_app.command("register")
def webhook_register(
    name: str = typer.Option(..., "--name", "-n", help="Human-readable webhook name."),
    secret: str = typer.Option("", "--secret", "-s", help="HMAC secret (optional)."),
    source_label: str = typer.Option("webhook", "--label", help="Source label for created notes."),
    title_field: str = typer.Option("title", "--title-field"),
    body_field: str = typer.Option("body", "--body-field"),
):
    """Register a new webhook and get an ingest URL."""
    payload = {
        "name": name,
        "source_label": source_label,
        "secret": secret or None,
        "extract_title_field": title_field,
        "extract_body_field": body_field,
    }
    data = _post("/api/webhooks/register", json=payload)
    rprint(f"\n[green]✓ Webhook registered[/green]")
    rprint(f"  [bold]ID:[/bold]         {data['id']}")
    rprint(f"  [bold]Token:[/bold]      {data['token']}")
    rprint(f"  [bold]Ingest URL:[/bold] {API_URL}{data['ingest_url']}")
    rprint(f"\n[dim]POST JSON to the ingest URL from any external tool (Zapier, n8n, Slack bot, etc.)[/dim]\n")


@webhook_app.command("list")
def webhook_list():
    """List registered webhooks."""
    data = _get("/api/webhooks")
    hooks = data.get("webhooks", [])
    if not hooks:
        rprint("[dim]No webhooks registered.[/dim]")
        return
    t = Table("ID", "Name", "Label", "Calls", "Last Called", show_header=True, header_style="bold cyan")
    for h in hooks:
        t.add_row(
            h.get("id", ""),
            h.get("name", ""),
            h.get("source_label", ""),
            str(h.get("call_count", 0)),
            (h.get("last_called") or "never")[:16],
        )
    console.print(t)


if __name__ == "__main__":
    app()
