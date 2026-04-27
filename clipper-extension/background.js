// Second Brain Clipper — Background Service Worker (MV3)

const DEFAULT_API = 'http://localhost:8000';

// ── Context menu setup ────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'clip-selection',
    title: 'Clip selection to Second Brain',
    contexts: ['selection'],
  });
  chrome.contextMenus.create({
    id: 'clip-page',
    title: 'Clip full page to Second Brain',
    contexts: ['page', 'frame'],
  });
  chrome.contextMenus.create({
    id: 'clip-link',
    title: 'Import link into Second Brain',
    contexts: ['link'],
  });
});

// ── Context menu click handler ────────────────────────────────────────────────

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const { apiUrl } = await getSettings();

  if (info.menuItemId === 'clip-selection' && info.selectionText) {
    await clipText({
      title: tab.title || 'Clipped Selection',
      content: info.selectionText,
      source: tab.url,
      apiUrl,
    });
  }

  if (info.menuItemId === 'clip-page') {
    await importUrl({ url: tab.url, apiUrl });
  }

  if (info.menuItemId === 'clip-link' && info.linkUrl) {
    await importUrl({ url: info.linkUrl, apiUrl });
  }
});

// ── Message handler (from popup / content script) ─────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    const { apiUrl } = await getSettings();
    try {
      if (msg.type === 'CLIP_TEXT') {
        const result = await clipText({ ...msg.payload, apiUrl });
        sendResponse({ ok: true, note: result });
      } else if (msg.type === 'CLIP_URL') {
        const result = await importUrl({ url: msg.payload.url, apiUrl });
        sendResponse({ ok: true, note: result });
      } else if (msg.type === 'CLIP_FULL_PAGE') {
        const result = await clipText({ ...msg.payload, apiUrl });
        sendResponse({ ok: true, note: result });
      } else {
        sendResponse({ ok: false, error: 'Unknown message type' });
      }
    } catch (err) {
      sendResponse({ ok: false, error: err.message || String(err) });
    }
  })();
  return true; // Keep channel open for async
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ apiUrl: DEFAULT_API }, (items) => resolve(items));
  });
}

async function clipText({ title, content, source, tags = [], apiUrl }) {
  const res = await fetch(`${apiUrl}/api/notes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title: title || 'Clipped Note',
      content: content || '',
      source: source || '',
      source_type: 'clipper',
      tags,
    }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

async function importUrl({ url, apiUrl }) {
  const res = await fetch(`${apiUrl}/api/import/url`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}
