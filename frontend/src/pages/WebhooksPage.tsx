import React, { useState, useEffect } from 'react';
import { useUI } from '../context/UIContext';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Webhook {
  id: string;
  name: string;
  source_label: string;
  call_count: number;
  last_called?: string;
  created_at: string;
}

interface RegisterForm {
  name: string;
  source_label: string;
  secret: string;
  extract_title_field: string;
  extract_body_field: string;
}

const DEFAULTS: RegisterForm = {
  name: '',
  source_label: 'webhook',
  secret: '',
  extract_title_field: 'title',
  extract_body_field: 'body',
};

// ─── Component ────────────────────────────────────────────────────────────────
const WebhooksPage: React.FC = () => {
  const { showToast } = useUI();

  const [hooks, setHooks]           = useState<Webhook[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [form, setForm]             = useState<RegisterForm>(DEFAULTS);
  const [submitting, setSubmitting] = useState(false);
  const [newHook, setNewHook]       = useState<{ token: string; ingest_url: string } | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/webhooks');
      const data = await res.json();
      setHooks(data.webhooks || []);
    } catch {
      showToast('Failed to load webhooks', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { showToast('Name is required', 'error'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/webhooks/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, secret: form.secret || null }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setNewHook(data);
      setForm(DEFAULTS);
      setShowForm(false);
      load();
      showToast('Webhook registered ✓', 'success');
    } catch (err: any) {
      showToast(`Failed: ${err.message}`, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this webhook?')) return;
    try {
      await fetch(`/api/webhooks/${id}`, { method: 'DELETE' });
      setHooks(h => h.filter(x => x.id !== id));
      showToast('Webhook deleted', 'success');
    } catch {
      showToast('Delete failed', 'error');
    }
  };

  const copyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    showToast('Copied!', 'success');
  };

  const apiBase = window.location.hostname === 'localhost'
    ? 'http://localhost:8000'
    : window.location.origin;

  return (
    <div className="webhooks-page">
      <div className="wh-header">
        <div>
          <h1>⚡ Webhooks</h1>
          <p>Accept captures from any external tool — Zapier, n8n, Slack bots, iOS shortcuts, and more.</p>
        </div>
        <button className="btn-primary-sm" onClick={() => { setShowForm(f => !f); setNewHook(null); }}>
          {showForm ? '✕ Cancel' : '+ New Webhook'}
        </button>
      </div>

      {/* New hook result banner */}
      {newHook && (
        <div className="hook-banner">
          <div className="hook-banner-title">✓ Webhook ready — copy your ingest URL</div>
          <div className="hook-url-row">
            <code className="hook-url">{apiBase}{newHook.ingest_url}</code>
            <button className="btn-copy" onClick={() => copyToken(`${apiBase}${newHook.ingest_url}`)}>Copy URL</button>
          </div>
          <div className="hook-token-row">
            <span className="hook-token-label">Token:</span>
            <code className="hook-token">{newHook.token}</code>
            <button className="btn-copy-sm" onClick={() => copyToken(newHook.token)}>copy</button>
          </div>
          <div className="hook-hint">POST JSON to the ingest URL. The <code>title</code> and <code>body</code> fields map to note title/content.</div>
        </div>
      )}

      {/* Register form */}
      {showForm && (
        <form className="hook-form" onSubmit={handleRegister}>
          <div className="form-row">
            <div className="form-group">
              <label>Name *</label>
              <input
                type="text"
                placeholder="e.g. Zapier Capture"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label>Source label</label>
              <input
                type="text"
                placeholder="webhook"
                value={form.source_label}
                onChange={e => setForm(f => ({ ...f, source_label: e.target.value }))}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Title field (JSON path)</label>
              <input
                type="text"
                value={form.extract_title_field}
                onChange={e => setForm(f => ({ ...f, extract_title_field: e.target.value }))}
              />
            </div>
            <div className="form-group">
              <label>Body field (JSON path)</label>
              <input
                type="text"
                value={form.extract_body_field}
                onChange={e => setForm(f => ({ ...f, extract_body_field: e.target.value }))}
              />
            </div>
          </div>
          <div className="form-group">
            <label>HMAC secret (optional)</label>
            <input
              type="password"
              placeholder="Leave blank for no signature verification"
              value={form.secret}
              onChange={e => setForm(f => ({ ...f, secret: e.target.value }))}
            />
          </div>
          <button type="submit" className="btn-submit" disabled={submitting}>
            {submitting ? 'Registering…' : 'Register Webhook'}
          </button>
        </form>
      )}

      {/* Webhooks list */}
      {loading ? (
        <div className="wh-loading"><div className="spinner" />Loading webhooks…</div>
      ) : hooks.length === 0 ? (
        <div className="wh-empty">
          <div className="empty-icon">⚡</div>
          <div className="empty-title">No webhooks yet</div>
          <div className="empty-sub">Register your first webhook to start capturing from external tools.</div>
          <button className="btn-primary-sm" onClick={() => setShowForm(true)}>+ New Webhook</button>
        </div>
      ) : (
        <div className="hook-list">
          {hooks.map(h => (
            <div key={h.id} className="hook-card">
              <div className="hook-card-left">
                <div className="hook-name">{h.name}</div>
                <div className="hook-meta">
                  <span className="hook-tag">{h.source_label}</span>
                  <span className="hook-calls">{h.call_count} calls</span>
                  {h.last_called && <span className="hook-last">Last: {h.last_called.slice(0, 10)}</span>}
                </div>
                <code className="hook-id-display">{apiBase}/api/webhooks/ingest/…{h.id}</code>
              </div>
              <button className="btn-delete" onClick={() => handleDelete(h.id)} title="Delete webhook">🗑</button>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .webhooks-page { max-width: 760px; margin: 0 auto; padding: 2rem 1.5rem; display: flex; flex-direction: column; gap: 1.5rem; }
        .wh-header    { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
        .wh-header h1 { font-size: 1.75rem; font-weight: 800; margin-bottom: .3rem; }
        .wh-header p  { color: var(--text-secondary, #94a3b8); font-size: .9rem; }

        .btn-primary-sm { padding: .5rem 1rem; background: var(--primary, #6366f1); color: #fff;
                          border: none; border-radius: 8px; font-size: .875rem; font-weight: 600;
                          cursor: pointer; white-space: nowrap; transition: filter 150ms; }
        .btn-primary-sm:hover { filter: brightness(1.1); }

        /* Banner */
        .hook-banner      { background: rgba(99,102,241,.12); border: 1px solid rgba(99,102,241,.3);
                            border-radius: 12px; padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: .6rem; }
        .hook-banner-title{ font-weight: 700; color: #818cf8; }
        .hook-url-row     { display: flex; align-items: center; gap: .75rem; flex-wrap: wrap; }
        .hook-url         { font-size: .8125rem; background: rgba(0,0,0,.3); padding: .4rem .75rem;
                            border-radius: 6px; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .btn-copy         { padding: .35rem .875rem; background: var(--primary, #6366f1); color: #fff;
                            border: none; border-radius: 6px; font-size: .75rem; font-weight: 600; cursor: pointer; }
        .hook-token-row   { display: flex; align-items: center; gap: .5rem; font-size: .8125rem; }
        .hook-token-label { color: var(--text-secondary, #94a3b8); }
        .hook-token       { background: rgba(0,0,0,.3); padding: .25rem .6rem; border-radius: 4px; font-size: .75rem; }
        .btn-copy-sm      { background: none; border: 1px solid var(--border, #2a2a4a); color: var(--primary, #6366f1);
                            padding: .15rem .5rem; border-radius: 4px; font-size: .7rem; cursor: pointer; }
        .hook-hint        { font-size: .8rem; color: var(--text-secondary, #94a3b8); }

        /* Form */
        .hook-form    { background: var(--surface, #1a1a2e); border: 1px solid var(--border, #2a2a4a);
                        border-radius: 14px; padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
        .form-row     { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        .form-group   { display: flex; flex-direction: column; gap: .35rem; }
        .form-group label { font-size: .8125rem; color: var(--text-secondary, #94a3b8); font-weight: 600; }
        .form-group input { padding: .5rem .875rem; background: var(--bg, #0f0f13); border: 1px solid var(--border, #2a2a4a);
                            border-radius: 8px; color: var(--text, #e2e8f0); font-size: .875rem; outline: none; transition: border-color 150ms; }
        .form-group input:focus { border-color: var(--primary, #6366f1); }
        .btn-submit   { padding: .6rem 1.5rem; background: var(--primary, #6366f1); color: #fff; border: none;
                        border-radius: 8px; font-weight: 700; cursor: pointer; align-self: flex-start; }
        .btn-submit:disabled { opacity: .5; cursor: not-allowed; }

        /* List */
        .hook-list    { display: flex; flex-direction: column; gap: .75rem; }
        .hook-card    { background: var(--surface, #1a1a2e); border: 1px solid var(--border, #2a2a4a);
                        border-radius: 12px; padding: 1rem 1.25rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
        .hook-card-left { display: flex; flex-direction: column; gap: .3rem; min-width: 0; }
        .hook-name    { font-weight: 700; font-size: .9375rem; }
        .hook-meta    { display: flex; align-items: center; gap: .5rem; flex-wrap: wrap; }
        .hook-tag     { background: rgba(99,102,241,.15); color: #818cf8; border-radius: 999px; padding: 1px 8px; font-size: .7rem; font-weight: 600; }
        .hook-calls, .hook-last { font-size: .75rem; color: var(--text-secondary, #94a3b8); }
        .hook-id-display { font-size: .7rem; color: var(--text-secondary, #94a3b8); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .btn-delete   { background: none; border: 1px solid var(--border, #2a2a4a); border-radius: 8px;
                        padding: .4rem .6rem; cursor: pointer; font-size: .875rem; transition: border-color 150ms; flex-shrink: 0; }
        .btn-delete:hover { border-color: #ef4444; }

        /* Empty */
        .wh-empty     { text-align: center; padding: 4rem 2rem; display: flex; flex-direction: column; align-items: center; gap: .75rem; }
        .empty-icon   { font-size: 2.5rem; }
        .empty-title  { font-size: 1.125rem; font-weight: 700; }
        .empty-sub    { color: var(--text-secondary, #94a3b8); max-width: 380px; font-size: .875rem; }

        /* Loading */
        .wh-loading   { display: flex; align-items: center; gap: .75rem; color: var(--text-secondary, #94a3b8); padding: 2rem; }
        .spinner      { width: 20px; height: 20px; border: 2px solid rgba(255,255,255,.1);
                        border-top-color: var(--primary, #6366f1); border-radius: 50%; animation: spin 600ms linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 520px) { .form-row { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
};

export default WebhooksPage;
