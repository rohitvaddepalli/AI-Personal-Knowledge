# Ingesting Content

Second Brain can import content from many sources automatically.

## URL Import

Paste any URL to create a note from web content:

1. Click **Import File** → **From URL**
2. Paste the URL
3. The backend fetches, extracts text, and creates a note

**Supported URL types:**
- Regular web pages (article extraction via BeautifulSoup)
- YouTube videos (transcript extraction via yt-dlp + AI summary)
- PDFs served via URL

## File Import

Drag and drop files via the **Import File** button:

| Format | Extracted content |
|--------|------------------|
| `.pdf` | Full text via pdfplumber |
| `.docx` | Full text + headings |
| `.md` | Native markdown |
| `.txt` | Plain text |
| `.pptx` | Slide titles + text |

## Obsidian Vault Import

Go to **Import/Export → Import from Obsidian**:
1. Zip your Obsidian vault
2. Upload the zip file
3. Notes, tags, and backlinks are preserved

## Notion Export

Go to **Import/Export → Import from Notion**:
1. Export your Notion workspace as Markdown+CSV
2. Upload the zip file
3. Pages are imported as notes with hierarchy

## Webhook Ingest

Send notes programmatically via the webhooks API:

```bash
curl -X POST http://localhost/api/webhooks/ingest \
  -H "Content-Type: application/json" \
  -d '{"title": "Meeting notes", "content": "...", "tags": ["meeting"]}'
```

## Voice Notes

Go to **Settings → Voice** to enable browser microphone access. Record a voice note and it's transcribed via Whisper (local).
