# Plugin Development Overview

Second Brain has a secure, manifest-driven plugin system that lets community developers extend the app with new functionality.

## How Plugins Work

1. A plugin is a **folder** inside `~/.second-brain/plugins/<plugin-id>/`
2. Each folder must contain a `manifest.json` and an entry point (default: `main.py`)
3. Plugins are executed in **isolated subprocesses** — they cannot access the host process directly
4. Plugins communicate via **JSON over stdin/stdout**
5. Plugins declare which **hooks** and **permissions** they need

## Plugin Directory Structure

```
~/.second-brain/plugins/
└── my-plugin/
    ├── manifest.json       # Required: plugin metadata
    ├── main.py             # Entry point (Python example)
    └── README.md           # Optional documentation
```

## manifest.json

```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "version": "0.1.0",
  "description": "A short description of what this plugin does",
  "author": "Your Name",
  "entry_point": "main.py",
  "hooks": ["on_note_create", "on_note_update"],
  "permissions": ["read_notes"]
}
```

## Entry Point (main.py)

```python
import sys
import json
import argparse

parser = argparse.ArgumentParser()
parser.add_argument('--hook', required=True)
args = parser.parse_args()

# Read payload from stdin
payload = json.loads(sys.stdin.read())

# Your plugin logic here
if args.hook == 'on_note_create':
    title = payload.get('title', '')
    # Do something with the new note...
    result = {'status': 'ok', 'processed': True, 'message': f'Processed: {title}'}
else:
    result = {'status': 'noop'}

# Write result to stdout as JSON
print(json.dumps(result))
```

## Available Hooks

| Hook | Trigger | Payload |
|------|---------|---------|
| `on_note_create` | After a note is created | `{ id, title, content, tags }` |
| `on_note_update` | After a note is updated | `{ id, title, content, tags }` |
| `on_note_delete` | After a note is soft-deleted | `{ id }` |
| `on_search` | After a search query runs | `{ query, results }` |
| `on_startup` | When the backend starts | `{}` |

## Security Model

- Each plugin runs with a **10-second timeout**
- Plugins run as the current user — install only trusted plugins
- Plugin stdout must be valid **JSON** or it will be treated as an error
- Plugins can be **enabled/disabled** from the Plugins page without restart

## Running a Plugin Manually

```bash
curl -X POST http://localhost:8000/api/plugins/run \
  -H "Content-Type: application/json" \
  -d '{
    "plugin_id": "my-plugin",
    "hook": "on_note_create",
    "payload": {"id": "abc", "title": "Test Note", "content": "Hello!"}
  }'
```
