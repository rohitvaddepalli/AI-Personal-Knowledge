# API Overview

The Second Brain backend exposes a REST API at `http://localhost:8000`.

All API endpoints are prefixed with `/api/`.

## Authentication

By default, the API only accepts connections from `localhost`. To enable remote access, set `ALLOW_REMOTE_CLIENTS=true` in your environment. To add API key authentication, set `API_KEY=your-secret` and pass `x-api-key: your-secret` in all requests.

## Base URL

```
http://localhost:8000
```

## Endpoints at a Glance

| Resource | Base Path |
|----------|-----------|
| Notes | `/api/notes` |
| Collections | `/api/collections` |
| Search | `/api/search` |
| AI Ask | `/api/ask` |
| Connections | `/api/connections` |
| Graph | `/api/graph` |
| Voice | `/api/voice` |
| Plugins | `/api/plugins` |
| Templates | `/api/templates` |
| Tasks | `/api/tasks` |
| Export | `/api/export` |
| System | `/api/system` |

## Interactive Docs

When the backend is running, visit [http://localhost:8000/docs](http://localhost:8000/docs) for the interactive Swagger UI, or [http://localhost:8000/redoc](http://localhost:8000/redoc) for ReDoc.

## Notes API Quick Reference

```http
GET    /api/notes            # List all notes (supports ?skip=&limit=)
POST   /api/notes            # Create a note
GET    /api/notes/{id}       # Get a note (includes backlinks)
PUT    /api/notes/{id}       # Update a note
DELETE /api/notes/{id}       # Soft delete (move to trash)

GET    /api/notes/{id}/tree  # Get note with ancestors & descendants
POST   /api/notes/{id}/parent?parent_id=  # Set parent for hierarchy

POST   /api/notes/{id}/summarize    # AI summarization
POST   /api/notes/{id}/transform    # AI text transformation
GET    /api/notes/{id}/versions     # Version history
```

## Voice API

```http
POST /api/voice/transcribe   # Upload audio, returns transcribed text
  Content-Type: multipart/form-data
  file: <audio file>         # Supported: .webm, .wav, .mp3, .ogg, .m4a
```

## Plugin API

```http
GET  /api/plugins            # List installed plugins
GET  /api/plugins/{id}       # Get plugin details
POST /api/plugins/{id}/enable
POST /api/plugins/{id}/disable
POST /api/plugins/run        # Execute a plugin hook
GET  /api/plugins/sdk/info   # Developer documentation
```
