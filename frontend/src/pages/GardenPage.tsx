import React, { useState, useEffect, useCallback } from 'react';
import { useUI } from '../context/UIContext';

// ─── Types ────────────────────────────────────────────────────────────────────
interface PublicNote {
  id: string;
  title: string;
  slug: string;
  tags: string[];
  created_at: string;
  excerpt: string;
  is_public: boolean;
}

interface Note {
  id: string;
  title: string;
  tags: string[];
  created_at: string;
  is_public?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────
const GardenPage: React.FC = () => {
  const { showToast } = useUI();

  const [tab, setTab]             = useState<'manage' | 'preview'>('manage');
  const [notes, setNotes]         = useState<Note[]>([]);
  const [publicSlugs, setPublicSlugs] = useState<Set<string>>(new Set());
  const [loading, setLoading]     = useState(true);
  const [toggling, setToggling]   = useState<string | null>(null);
  const [search, setSearch]       = useState('');
  const [gardenNotes, setGardenNotes] = useState<PublicNote[]>([]);

  const apiBase = window.location.hostname === 'localhost'
    ? 'http://localhost:8000'
    : window.location.origin;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [notesRes, gardenRes] = await Promise.all([
        fetch('/api/notes?limit=500'),
        fetch('/api/garden', { headers: { Accept: 'application/json' } }),
      ]);
      const notesData  = await notesRes.json();
      const gardenData = await gardenRes.json();

      const allNotes: Note[] = Array.isArray(notesData) ? notesData : (notesData.notes || []);
      const gNotes: PublicNote[] = Array.isArray(gardenData) ? gardenData : [];

      setNotes(allNotes);
      setGardenNotes(gNotes);
      setPublicSlugs(new Set(gNotes.map(n => n.id)));
    } catch {
      showToast('Failed to load notes', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const togglePublic = async (note: Note) => {
    const isPublic = publicSlugs.has(note.id);
    setToggling(note.id);
    try {
      const endpoint = isPublic
        ? `/api/garden/note/${note.id}/unpublish`
        : `/api/garden/note/${note.id}/publish`;
      const res = await fetch(endpoint, { method: 'PUT' });
      if (!res.ok) throw new Error(await res.text());

      setPublicSlugs(prev => {
        const next = new Set(prev);
        if (isPublic) next.delete(note.id); else next.add(note.id);
        return next;
      });
      showToast(isPublic ? 'Note unpublished' : '🌱 Note published to garden', 'success');
      load();
    } catch (err: any) {
      showToast(`Failed: ${err.message}`, 'error');
    } finally {
      setToggling(null);
    }
  };

  const filtered = notes.filter(n =>
    (n.title || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="garden-page">
      <div className="gd-header">
        <div>
          <h1>🌱 Public Garden</h1>
          <p>Selectively share notes as a public digital garden — with RSS, sitemap, and clean HTML.</p>
        </div>
        <a
          href={`${apiBase}/api/garden`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-view-garden"
        >
          View Garden ↗
        </a>
      </div>

      {/* Stats */}
      <div className="gd-stats">
        <div className="stat-card">
          <div className="stat-num">{notes.length}</div>
          <div className="stat-label">Total notes</div>
        </div>
        <div className="stat-card accent">
          <div className="stat-num">{publicSlugs.size}</div>
          <div className="stat-label">Published</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">{notes.length - publicSlugs.size}</div>
          <div className="stat-label">Private</div>
        </div>
        <a
          href={`${apiBase}/api/garden/rss`}
          target="_blank"
          rel="noopener noreferrer"
          className="stat-card link-card"
        >
          <div className="stat-num">📡</div>
          <div className="stat-label">RSS Feed</div>
        </a>
      </div>

      {/* Tabs */}
      <div className="gd-tabs">
        {(['manage', 'preview'] as const).map(t => (
          <button
            key={t}
            className={`gd-tab ${tab === t ? 'active' : ''}`}
            onClick={() => setTab(t)}
          >
            {t === 'manage' ? '⚙ Manage' : '👁 Preview Garden'}
          </button>
        ))}
      </div>

      {/* ── Manage tab ── */}
      {tab === 'manage' && (
        <>
          <input
            className="gd-search"
            type="search"
            placeholder="Search notes…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {loading ? (
            <div className="gd-loading"><div className="spinner" />Loading notes…</div>
          ) : (
            <div className="gd-note-list">
              {filtered.map(n => {
                const isPublic = publicSlugs.has(n.id);
                return (
                  <div key={n.id} className={`gd-note-row ${isPublic ? 'public' : ''}`}>
                    <div className="gd-note-info">
                      <span className="gd-note-title">{n.title || 'Untitled'}</span>
                      {isPublic && <span className="pub-badge">🌱 Public</span>}
                    </div>
                    <button
                      className={`toggle-btn ${isPublic ? 'published' : ''}`}
                      onClick={() => togglePublic(n)}
                      disabled={toggling === n.id}
                    >
                      {toggling === n.id
                        ? '…'
                        : isPublic ? 'Unpublish' : 'Publish'}
                    </button>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div className="gd-empty-list">No notes match "{search}"</div>
              )}
            </div>
          )}
        </>
      )}

      {/* ── Preview tab ── */}
      {tab === 'preview' && (
        <div className="gd-preview">
          {gardenNotes.length === 0 ? (
            <div className="gd-empty">
              <div className="empty-icon">🌱</div>
              <div className="empty-title">Your garden is empty</div>
              <div className="empty-sub">Switch to Manage and publish some notes to see them here.</div>
            </div>
          ) : (
            <div className="preview-grid">
              {gardenNotes.map(n => (
                <a
                  key={n.id}
                  href={`${apiBase}/api/garden/${n.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="preview-card"
                >
                  <div className="preview-title">{n.title}</div>
                  <div className="preview-excerpt">{n.excerpt}</div>
                  <div className="preview-tags">
                    {n.tags.slice(0, 3).map(t => (
                      <span key={t} className="preview-tag">{t}</span>
                    ))}
                  </div>
                  <div className="preview-date">{(n.created_at || '').slice(0, 10)}</div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}

      <style>{`
        .garden-page  { max-width: 780px; margin: 0 auto; padding: 2rem 1.5rem; display: flex; flex-direction: column; gap: 1.5rem; }
        .gd-header    { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
        .gd-header h1 { font-size: 1.75rem; font-weight: 800; margin-bottom: .3rem; }
        .gd-header p  { color: var(--text-secondary, #94a3b8); font-size: .9rem; max-width: 480px; }
        .btn-view-garden { padding: .5rem 1rem; background: var(--surface, #1a1a2e); border: 1px solid var(--border, #2a2a4a);
                           border-radius: 8px; color: var(--primary, #6366f1); font-size: .875rem; font-weight: 600;
                           text-decoration: none; white-space: nowrap; transition: border-color 150ms; }
        .btn-view-garden:hover { border-color: var(--primary, #6366f1); }

        /* Stats */
        .gd-stats  { display: grid; grid-template-columns: repeat(4, 1fr); gap: .75rem; }
        .stat-card { background: var(--surface, #1a1a2e); border: 1px solid var(--border, #2a2a4a);
                     border-radius: 12px; padding: 1rem; text-align: center; }
        .stat-card.accent { border-color: rgba(99,102,241,.4); background: rgba(99,102,241,.08); }
        .stat-card.link-card { text-decoration: none; color: inherit; transition: border-color 150ms; cursor: pointer; }
        .stat-card.link-card:hover { border-color: var(--primary, #6366f1); }
        .stat-num  { font-size: 1.5rem; font-weight: 800; color: var(--primary, #6366f1); }
        .stat-label{ font-size: .75rem; color: var(--text-secondary, #94a3b8); margin-top: .2rem; }

        /* Tabs */
        .gd-tabs   { display: flex; gap: .5rem; }
        .gd-tab    { padding: .5rem 1.25rem; border-radius: 8px; border: 1px solid var(--border, #2a2a4a);
                     background: var(--surface, #1a1a2e); color: var(--text-secondary, #94a3b8);
                     font-size: .875rem; font-weight: 600; cursor: pointer; transition: all 150ms; }
        .gd-tab.active { background: var(--primary, #6366f1); color: #fff; border-color: var(--primary, #6366f1); }

        /* Search */
        .gd-search { width: 100%; padding: .6rem 1rem; background: var(--surface, #1a1a2e);
                     border: 1px solid var(--border, #2a2a4a); border-radius: 10px;
                     color: var(--text, #e2e8f0); font-size: .9rem; outline: none; transition: border-color 150ms; }
        .gd-search:focus { border-color: var(--primary, #6366f1); }

        /* Note list */
        .gd-note-list { display: flex; flex-direction: column; gap: .5rem; }
        .gd-note-row  { display: flex; align-items: center; justify-content: space-between; gap: 1rem;
                        padding: .75rem 1rem; background: var(--surface, #1a1a2e);
                        border: 1px solid var(--border, #2a2a4a); border-radius: 10px; transition: border-color 150ms; }
        .gd-note-row.public { border-color: rgba(34,197,94,.25); }
        .gd-note-info { display: flex; align-items: center; gap: .6rem; min-width: 0; flex: 1; }
        .gd-note-title{ font-size: .9rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .pub-badge    { background: rgba(34,197,94,.1); color: #22c55e; border-radius: 999px; padding: 1px 8px; font-size: .7rem; font-weight: 600; flex-shrink: 0; }
        .toggle-btn   { padding: .35rem .875rem; border-radius: 7px; border: 1px solid var(--border, #2a2a4a);
                        background: var(--surface, #1a1a2e); color: var(--text, #e2e8f0); font-size: .8rem;
                        font-weight: 600; cursor: pointer; white-space: nowrap; transition: all 150ms; }
        .toggle-btn:hover    { border-color: var(--primary, #6366f1); color: var(--primary, #6366f1); }
        .toggle-btn.published{ background: rgba(239,68,68,.08); border-color: rgba(239,68,68,.3); color: #ef4444; }
        .toggle-btn.published:hover { background: rgba(239,68,68,.15); }
        .toggle-btn:disabled { opacity: .5; cursor: not-allowed; }
        .gd-empty-list{ text-align: center; padding: 2rem; color: var(--text-secondary, #94a3b8); font-size: .9rem; }

        /* Preview */
        .gd-preview   { }
        .preview-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: .875rem; }
        .preview-card { display: flex; flex-direction: column; gap: .4rem; padding: 1rem 1.125rem;
                        background: var(--surface, #1a1a2e); border: 1px solid var(--border, #2a2a4a);
                        border-radius: 12px; text-decoration: none; color: inherit; transition: border-color 150ms; }
        .preview-card:hover { border-color: var(--primary, #6366f1); }
        .preview-title  { font-weight: 700; font-size: .9375rem; color: var(--text, #e2e8f0); }
        .preview-excerpt{ font-size: .8rem; color: var(--text-secondary, #94a3b8); display: -webkit-box;
                          -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .preview-tags   { display: flex; gap: .35rem; flex-wrap: wrap; }
        .preview-tag    { background: rgba(99,102,241,.12); color: #818cf8; border-radius: 999px;
                          padding: 1px 7px; font-size: .65rem; font-weight: 600; }
        .preview-date   { font-size: .7rem; color: var(--text-secondary, #94a3b8); margin-top: auto; }

        /* Empty */
        .gd-empty      { text-align: center; padding: 4rem 2rem; display: flex; flex-direction: column; align-items: center; gap: .75rem; }
        .empty-icon    { font-size: 2.5rem; }
        .empty-title   { font-size: 1.125rem; font-weight: 700; }
        .empty-sub     { color: var(--text-secondary, #94a3b8); max-width: 360px; font-size: .875rem; }

        /* Loading */
        .gd-loading { display: flex; align-items: center; gap: .75rem; color: var(--text-secondary, #94a3b8); padding: 2rem; }
        .spinner    { width: 20px; height: 20px; border: 2px solid rgba(255,255,255,.1);
                      border-top-color: var(--primary, #6366f1); border-radius: 50%; animation: spin 600ms linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (max-width: 540px) { .gd-stats { grid-template-columns: repeat(2, 1fr); } .preview-grid { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
};

export default GardenPage;
