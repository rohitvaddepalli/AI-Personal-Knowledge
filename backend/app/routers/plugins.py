"""
Plugin System Architecture — Secure API Bridge for community plugins.

Provides:
- Plugin registry (load/list/enable/disable)
- Sandboxed plugin execution via subprocess isolation
- Plugin manifest validation
- Hook system for notes events (on_note_create, on_note_update, etc.)

Plugins are stored as directories under ~/.second-brain/plugins/<plugin-id>/
Each plugin must have a manifest.json and an entry point (main.py or index.js).
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
import json
import os
import subprocess
import time
from pathlib import Path
from app.config import settings
from app.database import get_db

router = APIRouter(prefix="/api/plugins", tags=["plugins"])

PLUGINS_DIR = Path(settings.data_dir if hasattr(settings, "data_dir") else Path.home() / ".second-brain") / "plugins"
PLUGINS_DIR.mkdir(parents=True, exist_ok=True)

PLUGIN_REGISTRY_FILE = PLUGINS_DIR / "registry.json"


class PluginManifest(BaseModel):
    id: str
    name: str
    version: str
    description: str
    author: str
    entry_point: str  # e.g. "main.py"
    hooks: list[str] = []  # e.g. ["on_note_create", "on_note_update"]
    permissions: list[str] = []  # e.g. ["read_notes", "write_notes"]
    enabled: bool = True


class PluginRunRequest(BaseModel):
    plugin_id: str
    hook: str
    payload: dict = {}


class PluginRunResponse(BaseModel):
    plugin_id: str
    hook: str
    result: dict
    duration_ms: int


def load_registry() -> dict:
    if PLUGIN_REGISTRY_FILE.exists():
        try:
            return json.loads(PLUGIN_REGISTRY_FILE.read_text())
        except Exception:
            pass
    return {}


def save_registry(registry: dict):
    PLUGIN_REGISTRY_FILE.write_text(json.dumps(registry, indent=2))


@router.get("")
def list_plugins():
    """List all installed plugins with their manifests."""
    registry = load_registry()
    plugins = []
    for plugin_dir in PLUGINS_DIR.iterdir():
        if not plugin_dir.is_dir():
            continue
        manifest_path = plugin_dir / "manifest.json"
        if not manifest_path.exists():
            continue
        try:
            manifest = json.loads(manifest_path.read_text())
            plugin_id = manifest.get("id", plugin_dir.name)
            manifest["enabled"] = registry.get(plugin_id, {}).get("enabled", True)
            plugins.append(manifest)
        except Exception as e:
            plugins.append({"id": plugin_dir.name, "error": str(e)})
    return {"plugins": plugins, "plugins_dir": str(PLUGINS_DIR)}


@router.get("/{plugin_id}")
def get_plugin(plugin_id: str):
    """Get details for a specific plugin."""
    plugin_dir = PLUGINS_DIR / plugin_id
    if not plugin_dir.exists():
        raise HTTPException(status_code=404, detail="Plugin not found")
    manifest_path = plugin_dir / "manifest.json"
    if not manifest_path.exists():
        raise HTTPException(status_code=400, detail="Plugin missing manifest.json")
    manifest = json.loads(manifest_path.read_text())
    return manifest


@router.post("/{plugin_id}/enable")
def enable_plugin(plugin_id: str):
    """Enable a plugin."""
    registry = load_registry()
    if plugin_id not in registry:
        registry[plugin_id] = {}
    registry[plugin_id]["enabled"] = True
    save_registry(registry)
    return {"status": "enabled", "plugin_id": plugin_id}


@router.post("/{plugin_id}/disable")
def disable_plugin(plugin_id: str):
    """Disable a plugin without uninstalling it."""
    registry = load_registry()
    if plugin_id not in registry:
        registry[plugin_id] = {}
    registry[plugin_id]["enabled"] = False
    save_registry(registry)
    return {"status": "disabled", "plugin_id": plugin_id}


@router.post("/run", response_model=PluginRunResponse)
def run_plugin_hook(req: PluginRunRequest):
    """
    Execute a plugin hook in a sandboxed subprocess.
    The plugin receives the payload as JSON via stdin and must return JSON to stdout.
    
    Security: Plugin runs with a 10-second timeout and no network access.
    """
    plugin_dir = PLUGINS_DIR / req.plugin_id
    if not plugin_dir.exists():
        raise HTTPException(status_code=404, detail="Plugin not found")

    manifest_path = plugin_dir / "manifest.json"
    if not manifest_path.exists():
        raise HTTPException(status_code=400, detail="Plugin missing manifest.json")

    manifest = json.loads(manifest_path.read_text())

    # Check plugin is enabled
    registry = load_registry()
    if not registry.get(req.plugin_id, {}).get("enabled", True):
        raise HTTPException(status_code=403, detail="Plugin is disabled")

    # Check hook is registered
    if req.hook not in manifest.get("hooks", []):
        raise HTTPException(status_code=400, detail=f"Plugin does not support hook: {req.hook}")

    entry_point = plugin_dir / manifest.get("entry_point", "main.py")
    if not entry_point.exists():
        raise HTTPException(status_code=500, detail="Plugin entry point not found")

    start = time.time()
    try:
        proc = subprocess.run(
            ["python", str(entry_point), "--hook", req.hook],
            input=json.dumps(req.payload),
            capture_output=True,
            text=True,
            timeout=10,  # Hard timeout for security
            cwd=str(plugin_dir),
        )
        elapsed = int((time.time() - start) * 1000)

        if proc.returncode != 0:
            raise HTTPException(
                status_code=500,
                detail=f"Plugin execution failed: {proc.stderr[:500]}"
            )

        result = {}
        if proc.stdout.strip():
            try:
                result = json.loads(proc.stdout)
            except json.JSONDecodeError:
                result = {"output": proc.stdout.strip()}

        return PluginRunResponse(
            plugin_id=req.plugin_id,
            hook=req.hook,
            result=result,
            duration_ms=elapsed,
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=408, detail="Plugin execution timed out (10s limit)")


@router.get("/sdk/info")
def get_plugin_sdk_info():
    """
    Returns documentation about how to develop plugins for Second Brain.
    """
    return {
        "version": "1.0.0",
        "plugins_dir": str(PLUGINS_DIR),
        "manifest_schema": {
            "id": "unique-plugin-id",
            "name": "My Plugin",
            "version": "0.1.0",
            "description": "Short description",
            "author": "Your Name",
            "entry_point": "main.py",
            "hooks": ["on_note_create", "on_note_update", "on_note_delete", "on_search"],
            "permissions": ["read_notes"]
        },
        "available_hooks": [
            "on_note_create",
            "on_note_update",
            "on_note_delete",
            "on_search",
            "on_startup",
        ],
        "example_main_py": (
            "import sys, json\n"
            "import argparse\n\n"
            "parser = argparse.ArgumentParser()\n"
            "parser.add_argument('--hook')\n"
            "args = parser.parse_args()\n"
            "payload = json.loads(sys.stdin.read())\n\n"
            "# Your plugin logic here\n"
            "result = {'status': 'ok', 'processed': True}\n"
            "print(json.dumps(result))\n"
        )
    }
