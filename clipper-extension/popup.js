// Second Brain Clipper — Popup script

const DEFAULT_API = 'http://localhost:8000';

// ── State ─────────────────────────────────────────────────────────────────────
let pageData = { title: '', url: '', selection: '', bodyText: '' };
let apiUrl = DEFAULT_API;

// ── Init ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Load settings
  await loadSettings();

  // Fetch page data from content script
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_CONTENT' });
      if (response) {
        pageData = response;
        fillPageInfo();
      }
    }
  } catch (e) {
    // Content script not injected (e.g. chrome:// pages)
    pageData = {
      title: document.title || 'Unknown Page',
      url: '',
      selection: '',
      bodyText: '',
    };
    fillPageInfo();
  }

  // Tab switching
  document.querySelectorAll('.tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      switchTab(tabId);
    });
  });

  // Actions
  document.getElementById('btnClipSelection').addEventListener('click', clipSelection);
  document.getElementById('btnImportUrl').addEventListener('click', importUrl);
  document.getElementById('btnClipFullPage').addEventListener('click', clipFullPage);
  document.getElementById('btnSaveSettings').addEventListener('click', saveSettings);
});

// ── Tab switching ─────────────────────────────────────────────────────────────
function switchTab(tabId) {
  document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
  document.querySelector(`.tab[data-tab="${tabId}"]`).classList.add('active');
  ['clip', 'page', 'settings'].forEach((id) => {
    document.getElementById(`tab-${id}`).style.display = id === tabId ? 'flex' : 'none';
  });
}

// ── Fill UI ───────────────────────────────────────────────────────────────────
function fillPageInfo() {
  ['pageTitle', 'pageTitle2'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = pageData.title || 'Unknown Page';
  });
  ['pageUrl', 'pageUrl2'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.textContent = pageData.url || '';
  });
  document.getElementById('noteTitle').value = pageData.title || '';

  if (pageData.selection?.trim()) {
    document.getElementById('selectionSection').style.display = 'block';
    document.getElementById('selectionPreview').textContent = pageData.selection.slice(0, 300);
    document.getElementById('btnClipSelection').textContent = '✦ Clip Selection';
  } else {
    document.getElementById('btnClipSelection').textContent = '📋 Clip Page Title';
  }
}

// ── Parse tags ────────────────────────────────────────────────────────────────
function parseTags() {
  const raw = document.getElementById('noteTags').value;
  return raw.split(',').map((t) => t.trim()).filter(Boolean);
}

// ── Clip selection ────────────────────────────────────────────────────────────
async function clipSelection() {
  const title = document.getElementById('noteTitle').value || pageData.title || 'Clipped Note';
  const content = pageData.selection?.trim() || `[Clipped from ${pageData.url}]\n\n${pageData.title}`;
  const tags = parseTags();
  await sendClip('CLIP_TEXT', { title, content, source: pageData.url, tags }, 'statusArea');
}

// ── Import URL ────────────────────────────────────────────────────────────────
async function importUrl() {
  if (!pageData.url) {
    showStatus('statusArea', 'No URL detected.', 'error');
    return;
  }
  setLoading('btnImportUrl', true);
  await sendClip('CLIP_URL', { url: pageData.url }, 'statusArea');
  setLoading('btnImportUrl', false);
}

// ── Clip full page ────────────────────────────────────────────────────────────
async function clipFullPage() {
  const title = pageData.title || 'Full Page Clip';
  const content = `**Source:** ${pageData.url}\n\n${pageData.bodyText}`;
  const tags = ['full-page'];
  setLoading('btnClipFullPage', true);
  await sendClip('CLIP_TEXT', { title, content, source: pageData.url, tags }, 'statusArea2');
  setLoading('btnClipFullPage', false);
}

// ── Send to background ────────────────────────────────────────────────────────
async function sendClip(type, payload, statusId) {
  try {
    const response = await chrome.runtime.sendMessage({ type, payload });
    if (response?.ok) {
      showStatus(statusId, `✓ Saved: ${response.note?.title || 'Note created'}`, 'success');
    } else {
      showStatus(statusId, `✗ ${response?.error || 'Unknown error'}`, 'error');
    }
  } catch (e) {
    showStatus(statusId, `✗ ${e.message || 'Failed to communicate with background.'}`, 'error');
  }
}

// ── Settings ──────────────────────────────────────────────────────────────────
async function loadSettings() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ apiUrl: DEFAULT_API }, (items) => {
      apiUrl = items.apiUrl;
      document.getElementById('apiUrlInput').value = apiUrl;
      resolve();
    });
  });
}

async function saveSettings() {
  const url = document.getElementById('apiUrlInput').value.trim() || DEFAULT_API;
  chrome.storage.sync.set({ apiUrl: url }, () => {
    apiUrl = url;
    showStatus('settingsStatus', '✓ Saved', 'success');
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function showStatus(containerId, message, type) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = `<div class="status ${type}">${message}</div>`;
  if (type === 'success') setTimeout(() => { el.innerHTML = ''; }, 3000);
}

function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  if (loading) {
    btn.dataset.original = btn.textContent;
    btn.textContent = 'Saving…';
  } else {
    btn.textContent = btn.dataset.original || btn.textContent;
  }
}
