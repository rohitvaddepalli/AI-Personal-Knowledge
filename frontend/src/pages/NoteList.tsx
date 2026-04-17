import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Pin, Trash2, CheckSquare, X, Link2, Upload, FileText, Globe, Plus } from 'lucide-react';

interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  created_at: string;
  is_pinned: boolean;
}

function getErrorMessage(status: number) {
  if (status === 401) return 'Sign in required.';
  if (status === 403) return 'Access denied.';
  return `Request failed with status ${status}.`;
}

function timeAgo(dateStr: string) {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  const diff = Date.now() - date.getTime();
  if (diff <= 0) return 'Just now';
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function NoteList() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [importUrlStr, setImportUrlStr] = useState('');
  const [importing, setImporting] = useState(false);
  const [collections, setCollections] = useState<any[]>([]);
  const [selectedCol, setSelectedCol] = useState('');
  const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [collectionsError, setCollectionsError] = useState<string | null>(null);
  const [showCaptureModal, setShowCaptureModal] = useState(false);
  const [captureTab, setCaptureTab] = useState('url');
  const [aiSummarize, setAiSummarize] = useState(true);

  const fetchCollections = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:8000/api/collections');
      if (!res.ok) throw new Error(getErrorMessage(res.status));
      const data = await res.json();
      setCollections(Array.isArray(data) ? data : []);
      setCollectionsError(null);
    } catch (e) {
      console.error(e);
      setCollections([]);
      setCollectionsError(e instanceof Error ? e.message : 'Failed to load collections.');
    }
  }, []);

  const fetchNotes = useCallback(async (query?: string) => {
    if (query && query.trim()) {
      try {
        const res = await fetch('http://localhost:8000/api/search', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, limit: 20 })
        });
        if (!res.ok) throw new Error(getErrorMessage(res.status));
        const data = await res.json();
        setNotes(Array.isArray(data) ? data : []);
        setNotesError(null);
      } catch (e) {
        console.error(e);
        setNotes([]);
        setNotesError(e instanceof Error ? e.message : 'Search failed.');
      }
    } else {
      try {
        const res = await fetch('http://localhost:8000/api/notes');
        if (!res.ok) throw new Error(getErrorMessage(res.status));
        const data = await res.json();
        setNotes(Array.isArray(data) ? data : []);
        setNotesError(null);
      } catch (err) {
        console.error(err);
        setNotes([]);
        setNotesError(err instanceof Error ? err.message : 'Failed to load notes.');
      }
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    if (q) { setSearchQuery(q); setDebouncedQuery(q); }
    fetchCollections();
  }, [fetchCollections]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(searchQuery.trim()), 220);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => { fetchNotes(debouncedQuery); }, [debouncedQuery, fetchNotes]);

  const handleImport = async () => {
    if (!importUrlStr.trim()) return;
    setImporting(true);
    try {
      const res = await fetch('http://localhost:8000/api/import/url', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: importUrlStr, model: localStorage.getItem('activeModel') || 'qwen2.5:0.5b', ai_summarize: aiSummarize })
      });
      if (!res.ok) throw new Error(await res.text());
      setImportUrlStr('');
      setShowCaptureModal(false);
      await fetchNotes(debouncedQuery);
    } catch (e: any) {
      alert(`Import failed: ${e.message}`);
    } finally { setImporting(false); }
  };

  const deleteNote = async (id: string) => {
    if (!confirm('Delete this note?')) return;
    try {
      const res = await fetch(`http://localhost:8000/api/notes/${id}`, { method: 'DELETE' });
      if (res.ok) fetchNotes(debouncedQuery);
    } catch (e) { console.error(e); }
  };

  const togglePin = async (id: string, isPinned: boolean) => {
    try {
      const res = await fetch(`http://localhost:8000/api/notes/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_pinned: !isPinned }),
      });
      if (res.ok) fetchNotes(debouncedQuery);
    } catch (e) { console.error(e); }
  };

  const toggleNoteSelection = (id: string) => {
    const newSelected = new Set(selectedNotes);
    if (newSelected.has(id)) newSelected.delete(id); else newSelected.add(id);
    setSelectedNotes(newSelected);
  };

  const selectAll = () => setSelectedNotes(new Set(sortedNotes.map(n => n.id)));
  const deselectAll = () => setSelectedNotes(new Set());

  const bulkDelete = async () => {
    if (!confirm(`Move ${selectedNotes.size} notes to trash?`)) return;
    await Promise.all(Array.from(selectedNotes).map(id =>
      fetch(`http://localhost:8000/api/notes/${id}`, { method: 'DELETE' })
    ));
    setSelectedNotes(new Set());
    fetchNotes(debouncedQuery);
  };

  const bulkPin = async (pin: boolean) => {
    await Promise.all(Array.from(selectedNotes).map(id =>
      fetch(`http://localhost:8000/api/notes/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_pinned: pin }),
      })
    ));
    setSelectedNotes(new Set());
    fetchNotes(debouncedQuery);
  };

  const collectionLookup = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const collection of Array.isArray(collections) ? collections : []) {
      map.set(collection.id.toString(), new Set((collection.notes ?? []).map((cn: any) => cn.id)));
    }
    return map;
  }, [collections]);

  const filteredNotes = useMemo(() => {
    if (!selectedCol) return notes;
    const noteIds = collectionLookup.get(selectedCol);
    if (!noteIds) return notes;
    return notes.filter(n => noteIds.has(n.id));
  }, [collectionLookup, notes, selectedCol]);

  const sortedNotes = useMemo(() => [...filteredNotes].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  }), [filteredNotes]);

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, height: '100%', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--font-display)', marginBottom: 4 }}>Analytics</h1>
            <p style={{ fontSize: '0.8125rem', color: 'var(--on-surface-dim)' }}>
              Measuring your mental momentum.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="btn-secondary"
              onClick={() => setBulkMode(!bulkMode)}
            >
              <CheckSquare size={14} />
              {bulkMode ? 'Done' : 'Select'}
            </button>
            <button className="btn" onClick={() => setShowCaptureModal(true)}>
              <Plus size={14} /> Capture
            </button>
            <Link to="/notes/new" className="btn" style={{ textDecoration: 'none' }}>
              <FileText size={14} /> New Note
            </Link>
          </div>
        </div>

        {/* Bulk Actions */}
        {bulkMode && selectedNotes.size > 0 && (
          <div style={{
            display: 'flex', gap: 8, alignItems: 'center',
            padding: '10px 14px', borderRadius: 'var(--radius-md)',
            background: 'var(--surface-container)',
          }}>
            <span style={{ color: 'var(--on-surface-dim)', fontSize: '0.8125rem' }}>
              {selectedNotes.size} selected
            </span>
            <button className="btn-ghost" onClick={selectAll} style={{ fontSize: '0.75rem' }}>All</button>
            <button className="btn-ghost" onClick={deselectAll} style={{ fontSize: '0.75rem' }}>Clear</button>
            <button className="btn-ghost" onClick={() => bulkPin(true)} style={{ fontSize: '0.75rem' }}>
              <Pin size={12} /> Pin
            </button>
            <button className="btn-ghost" onClick={() => bulkPin(false)} style={{ fontSize: '0.75rem' }}>Unpin</button>
            <button className="btn-ghost" onClick={bulkDelete} style={{ fontSize: '0.75rem', color: 'var(--error)' }}>
              <Trash2 size={12} /> Trash
            </button>
          </div>
        )}

        {/* Search + Filter Bar */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--surface-container-lowest)',
            borderRadius: 'var(--radius-full)', padding: '8px 14px', flex: 2,
          }}>
            <Search size={16} style={{ color: 'var(--on-surface-dim)', flexShrink: 0 }} />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search semantic + keywords..."
              style={{
                background: 'transparent', border: 'none', outline: 'none',
                color: 'var(--on-surface)', fontSize: '0.8125rem',
                fontFamily: 'var(--font-body)', width: '100%',
              }}
            />
          </div>

          <select
            className="input"
            value={selectedCol}
            onChange={e => setSelectedCol(e.target.value)}
            style={{
              width: 180, fontSize: '0.75rem', padding: '8px 12px',
              borderRadius: 'var(--radius-full)',
            }}
          >
            <option value="">All Collections</option>
            {collections.map(c => <option key={c.id} value={c.id.toString()}>{c.name}</option>)}
          </select>
        </div>

        {/* Error */}
        {(collectionsError || notesError) && (
          <div style={{
            padding: '10px 14px', borderRadius: 'var(--radius-md)',
            background: 'var(--tertiary-container)', fontSize: '0.8125rem',
          }}>
            {notesError ?? collectionsError}
          </div>
        )}

        {/* Notes Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 12,
        }}>
          {sortedNotes.length === 0 ? (
            <div style={{
              gridColumn: '1 / -1', padding: 48, textAlign: 'center',
              color: 'var(--on-surface-dim)', fontSize: '0.875rem',
            }}>
              No notes found. Create your first thought.
            </div>
          ) : (
            sortedNotes.map(note => (
              <div
                key={note.id}
                className="animate-fade-in"
                style={{
                  position: 'relative', padding: '16px 18px',
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--surface-container)',
                  border: '1px solid var(--outline-variant)',
                  transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'var(--surface-container-high)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'var(--surface-container)';
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                {/* Bulk checkbox */}
                {bulkMode && (
                  <input
                    type="checkbox"
                    checked={selectedNotes.has(note.id)}
                    onChange={() => toggleNoteSelection(note.id)}
                    style={{
                      position: 'absolute', top: 14, left: 14,
                      width: 16, height: 16, cursor: 'pointer', zIndex: 10,
                      accentColor: 'var(--primary)',
                    }}
                  />
                )}

                {/* Action buttons */}
                <div style={{
                  position: 'absolute', top: 12, right: 12,
                  display: 'flex', gap: 4,
                }}>
                  <button
                    onClick={e => { e.stopPropagation(); togglePin(note.id, note.is_pinned); }}
                    style={{
                      background: 'transparent', border: 'none',
                      color: note.is_pinned ? 'var(--tertiary)' : 'var(--on-surface-dim)',
                      cursor: 'pointer', padding: 4,
                      opacity: note.is_pinned ? 1 : 0.4,
                      transition: 'opacity 200ms',
                    }}
                  >
                    <Pin size={13} />
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); deleteNote(note.id); }}
                    style={{
                      background: 'transparent', border: 'none',
                      color: 'var(--error)', cursor: 'pointer', padding: 4,
                      opacity: 0.4, transition: 'opacity 200ms',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '0.4')}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                <Link to={`/notes/${note.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  {/* Date */}
                  <div style={{
                    fontSize: '0.625rem', color: 'var(--on-surface-dim)',
                    fontFamily: 'var(--font-mono)', marginBottom: 6,
                    paddingLeft: bulkMode ? 24 : 0,
                  }}>
                    {note.created_at ? timeAgo(note.created_at) : 'Unknown date'}
                  </div>

                  {/* Title */}
                  <h3 style={{
                    fontFamily: 'var(--font-display)', fontSize: '0.9375rem',
                    fontWeight: 600, marginBottom: 6,
                    paddingRight: 40, paddingLeft: bulkMode ? 24 : 0,
                    color: 'var(--on-surface)',
                  }}>
                    {note.is_pinned && <Pin size={11} style={{ marginRight: 4, color: 'var(--tertiary)', display: 'inline' }} />}
                    {note.title || 'Untitled'}
                  </h3>

                  {/* Content preview */}
                  <p style={{
                    fontSize: '0.8125rem', color: 'var(--on-surface-variant)',
                    lineHeight: 1.5, marginBottom: 10,
                    overflow: 'hidden', display: '-webkit-box',
                    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any,
                  }}>
                    {note.content?.substring(0, 120)}...
                  </p>

                  {/* Tags */}
                  {note.tags && note.tags.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {note.tags.slice(0, 3).map(tag => (
                        <span key={tag} className="tag" style={{ fontSize: '0.5625rem', padding: '1px 6px' }}>
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ═══ Capture Knowledge Modal ═══ */}
      {showCaptureModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 100,
            background: 'rgba(12, 14, 20, 0.8)',
            backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => setShowCaptureModal(false)}
        >
          <div
            className="animate-slide-up"
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 540,
              background: 'var(--surface-container)',
              borderRadius: 'var(--radius-xl)',
              padding: 28, position: 'relative',
              border: '1px solid var(--outline)',
            }}
          >
            <button
              onClick={() => setShowCaptureModal(false)}
              style={{
                position: 'absolute', top: 16, right: 16,
                background: 'transparent', border: 'none',
                color: 'var(--on-surface-dim)', cursor: 'pointer', padding: 4,
              }}
            >
              <X size={18} />
            </button>

            <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 16 }}>Capture Knowledge</h2>

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 20, borderBottom: '1px solid var(--outline-variant)', paddingBottom: 8 }}>
              {[
                { key: 'url', label: 'URL' },
                { key: 'youtube', label: 'YouTube' },
                { key: 'upload', label: 'File Upload' },
                { key: 'quick', label: 'Quick Note' },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setCaptureTab(tab.key)}
                  style={{
                    background: 'transparent', border: 'none',
                    color: captureTab === tab.key ? 'var(--on-surface)' : 'var(--on-surface-dim)',
                    fontFamily: 'var(--font-display)', fontWeight: captureTab === tab.key ? 600 : 400,
                    fontSize: '0.8125rem', cursor: 'pointer',
                    borderBottom: captureTab === tab.key ? '2px solid var(--primary)' : 'none',
                    paddingBottom: 4,
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Contents */}
            {captureTab === 'url' && (
              <div>
                <span className="label-sm" style={{ marginBottom: 8, display: 'block' }}>Source Link</span>
                <div style={{
                  display: 'flex', gap: 8, alignItems: 'center',
                }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, flex: 1,
                    background: 'var(--surface-container-lowest)',
                    borderRadius: 'var(--radius-md)', padding: '10px 14px',
                  }}>
                    <Link2 size={16} style={{ color: 'var(--on-surface-dim)', flexShrink: 0 }} />
                    <input
                      value={importUrlStr}
                      onChange={e => setImportUrlStr(e.target.value)}
                      placeholder="https://example.com/article-to-save"
                      style={{
                        background: 'transparent', border: 'none', outline: 'none',
                        color: 'var(--on-surface)', fontSize: '0.8125rem',
                        fontFamily: 'var(--font-body)', width: '100%',
                      }}
                    />
                  </div>
                  <button className="btn" onClick={handleImport} disabled={importing || !importUrlStr.trim()} style={{ padding: '10px 16px' }}>
                    {importing ? 'Fetching...' : 'Fetch & Import'}
                  </button>
                </div>

                {/* AI toggle */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--outline-variant)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div
                      role="switch"
                      aria-checked={aiSummarize}
                      tabIndex={0}
                      onClick={() => setAiSummarize(!aiSummarize)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setAiSummarize(!aiSummarize);
                        }
                      }}
                      style={{
                        width: 36, height: 20, borderRadius: 10,
                        background: aiSummarize ? 'var(--secondary)' : 'var(--surface-container-highest)', padding: 2,
                        cursor: 'pointer', transition: 'background 200ms',
                      }}>
                      <div style={{
                        width: 16, height: 16, borderRadius: '50%',
                        background: 'white', marginLeft: aiSummarize ? 14 : 0,
                        transition: 'margin 200ms',
                      }} />
                    </div>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)' }}>
                      AI will summarize on import
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn-ghost" onClick={() => setShowCaptureModal(false)}>Cancel</button>
                    <button className="btn" onClick={handleImport} disabled={importing || !importUrlStr.trim()}>
                      Save to Inbox
                    </button>
                  </div>
                </div>
              </div>
            )}
            {captureTab !== 'url' && (
              <div style={{ padding: '40px 0', textAlign: 'center' }}>
                <p style={{ color: 'var(--on-surface-dim)', fontSize: '0.875rem' }}>This capture method is coming soon.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
