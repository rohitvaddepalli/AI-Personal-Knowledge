import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Pin, Trash2, CheckSquare, X, Link2, FileText, Plus, AlertCircle } from 'lucide-react';
import { apiUrl } from '../lib/api';
import FileUploadModal from '../components/FileUploadModal';

interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  created_at: string;
  is_pinned: boolean;
}

// ── Inline confirm dialog ──────────────────────────────────────────────────
function ConfirmDialog({
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}: {
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onCancel}
    >
      <div
        className="animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface-container)', borderRadius: 'var(--radius-xl)',
          padding: 28, maxWidth: 400, width: '90%',
          border: '1px solid var(--outline)',
        }}
      >
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <AlertCircle size={20} style={{ color: 'var(--error)', flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: '0.875rem', lineHeight: 1.6, color: 'var(--on-surface)' }}>{message}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button
            className="btn"
            style={{ background: 'var(--error)', color: '#fff' }}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Toast notification ─────────────────────────────────────────────────────
function Toast({ message, type = 'error' }: { message: string; type?: 'error' | 'success' | 'info' }) {
  const color = type === 'error' ? 'var(--error)' : type === 'success' ? 'var(--secondary)' : 'var(--primary)';
  return (
    <div
      className="animate-fade-in"
      style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 300,
        padding: '12px 18px', borderRadius: 'var(--radius-lg)',
        background: 'var(--surface-container-high)',
        border: `1px solid ${color}`,
        color: 'var(--on-surface)', fontSize: '0.8125rem',
        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        display: 'flex', alignItems: 'center', gap: 8, maxWidth: 360,
      }}
    >
      <AlertCircle size={14} style={{ color, flexShrink: 0 }} />
      {message}
    </div>
  );
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
  const [uploadModalOpen, setUploadModalOpen] = useState(false);

  // Dialog / toast state
  const [confirmDeleteNote, setConfirmDeleteNote] = useState<string | null>(null);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'error' | 'success' | 'info' } | null>(null);

  const showToast = (msg: string, type: 'error' | 'success' | 'info' = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchCollections = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/collections'));
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
        const res = await fetch(apiUrl('/api/search'), {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, limit: 20 }),
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
        const res = await fetch(apiUrl('/api/notes'));
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
      const res = await fetch(apiUrl('/api/import/url'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: importUrlStr,
          model: localStorage.getItem('activeModel') || 'qwen2.5:0.5b',
          ai_summarize: aiSummarize,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setImportUrlStr('');
      setShowCaptureModal(false);
      await fetchNotes(debouncedQuery);
      showToast('URL imported successfully!', 'success');
    } catch (e: any) {
      showToast(`Import failed: ${e.message}`, 'error');
    } finally {
      setImporting(false);
    }
  };

  const deleteNote = async (id: string) => {
    try {
      const res = await fetch(apiUrl(`/api/notes/${id}`), { method: 'DELETE' });
      if (res.ok) {
        fetchNotes(debouncedQuery);
        showToast('Note moved to trash.', 'success');
      }
    } catch (e) {
      console.error(e);
      showToast('Failed to delete note.', 'error');
    }
  };

  const togglePin = async (id: string, isPinned: boolean) => {
    try {
      const res = await fetch(apiUrl(`/api/notes/${id}`), {
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

  const selectAll = () => setSelectedNotes(new Set(sortedNotes.map((n) => n.id)));
  const deselectAll = () => setSelectedNotes(new Set());

  const bulkDelete = async () => {
    const results = await Promise.allSettled(
      Array.from(selectedNotes).map((id) =>
        fetch(apiUrl(`/api/notes/${id}`), { method: 'DELETE' })
      )
    );
    const failed = results.filter((r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok)).length;
    if (failed === 0) {
      showToast(`${selectedNotes.size} notes moved to trash.`, 'success');
    } else if (failed < selectedNotes.size) {
      showToast(`${selectedNotes.size - failed} moved, ${failed} failed.`, 'error');
    } else {
      showToast('Failed to delete notes.', 'error');
    }
    setSelectedNotes(new Set());
    setConfirmBulkDelete(false);
    fetchNotes(debouncedQuery);
  };

  const bulkPin = async (pin: boolean) => {
    const results = await Promise.allSettled(
      Array.from(selectedNotes).map((id) =>
        fetch(apiUrl(`/api/notes/${id}`), {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_pinned: pin }),
        })
      )
    );
    const failed = results.filter((r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok)).length;
    if (failed > 0) {
      showToast(`${failed} note${failed > 1 ? 's' : ''} failed to ${pin ? 'pin' : 'unpin'}.`, 'error');
    }
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
    return notes.filter((n) => noteIds.has(n.id));
  }, [collectionLookup, notes, selectedCol]);

  const sortedNotes = useMemo(
    () =>
      [...filteredNotes].sort((a, b) => {
        if (a.is_pinned && !b.is_pinned) return -1;
        if (!a.is_pinned && b.is_pinned) return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }),
    [filteredNotes]
  );

  return (
    <>
      {/* Dialogs */}
      {confirmDeleteNote && (
        <ConfirmDialog
          message="Move this note to trash? You can restore it later."
          confirmLabel="Move to Trash"
          onConfirm={() => { deleteNote(confirmDeleteNote); setConfirmDeleteNote(null); }}
          onCancel={() => setConfirmDeleteNote(null)}
        />
      )}
      {confirmBulkDelete && (
        <ConfirmDialog
          message={`Move ${selectedNotes.size} note${selectedNotes.size > 1 ? 's' : ''} to trash? You can restore them later.`}
          confirmLabel="Move to Trash"
          onConfirm={bulkDelete}
          onCancel={() => setConfirmBulkDelete(false)}
        />
      )}
      {toast && <Toast message={toast.msg} type={toast.type} />}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, height: '100%', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            {/* ✅ 1.2: Fixed misleading label — was "Analytics" */}
            <h1 style={{ fontFamily: 'var(--font-display)', marginBottom: 4 }}>Notes</h1>
            <p style={{ fontSize: '0.8125rem', color: 'var(--on-surface-dim)' }}>
              {sortedNotes.length > 0 ? `${sortedNotes.length} note${sortedNotes.length !== 1 ? 's' : ''}` : 'Your knowledge vault'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-secondary" onClick={() => setBulkMode(!bulkMode)}>
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
            <button
              className="btn-ghost"
              onClick={() => setConfirmBulkDelete(true)}
              style={{ fontSize: '0.75rem', color: 'var(--error)' }}
            >
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
              onChange={(e) => setSearchQuery(e.target.value)}
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
            onChange={(e) => setSelectedCol(e.target.value)}
            style={{ width: 180, fontSize: '0.75rem', padding: '8px 12px', borderRadius: 'var(--radius-full)' }}
          >
            <option value="">All Collections</option>
            {collections.map((c) => <option key={c.id} value={c.id.toString()}>{c.name}</option>)}
          </select>
        </div>

        {/* Error banner */}
        {(collectionsError || notesError) && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 14px', borderRadius: 'var(--radius-md)',
            background: 'var(--error-container)', fontSize: '0.8125rem',
            color: 'var(--on-surface)',
          }}>
            <AlertCircle size={14} style={{ color: 'var(--error)', flexShrink: 0 }} />
            <span>{notesError ?? collectionsError}</span>
            <button
              className="btn-ghost"
              onClick={() => { fetchNotes(debouncedQuery); fetchCollections(); }}
              style={{ marginLeft: 'auto', fontSize: '0.75rem' }}
            >
              Retry
            </button>
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
              {searchQuery ? 'No notes match your search.' : 'No notes yet. Create your first thought.'}
            </div>
          ) : (
            sortedNotes.map((note) => (
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
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--surface-container-high)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }}
                onMouseLeave={(e) => {
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
                <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: 4 }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); togglePin(note.id, note.is_pinned); }}
                    style={{
                      background: 'transparent', border: 'none',
                      color: note.is_pinned ? 'var(--tertiary)' : 'var(--on-surface-dim)',
                      cursor: 'pointer', padding: 4,
                      opacity: note.is_pinned ? 1 : 0.4,
                      transition: 'opacity 200ms',
                    }}
                    title={note.is_pinned ? 'Unpin' : 'Pin'}
                  >
                    <Pin size={13} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteNote(note.id); }}
                    style={{
                      background: 'transparent', border: 'none',
                      color: 'var(--error)', cursor: 'pointer', padding: 4,
                      opacity: 0.4, transition: 'opacity 200ms',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.4')}
                    title="Move to trash"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                <Link to={`/notes/${note.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div style={{
                    fontSize: '0.625rem', color: 'var(--on-surface-dim)',
                    fontFamily: 'var(--font-mono)', marginBottom: 6,
                    paddingLeft: bulkMode ? 24 : 0,
                  }}>
                    {note.created_at ? timeAgo(note.created_at) : 'Unknown date'}
                  </div>
                  <h3 style={{
                    fontFamily: 'var(--font-display)', fontSize: '0.9375rem',
                    fontWeight: 600, marginBottom: 6,
                    paddingRight: 40, paddingLeft: bulkMode ? 24 : 0,
                    color: 'var(--on-surface)',
                  }}>
                    {note.is_pinned && <Pin size={11} style={{ marginRight: 4, color: 'var(--tertiary)', display: 'inline' }} />}
                    {note.title || 'Untitled'}
                  </h3>
                  <p style={{
                    fontSize: '0.8125rem', color: 'var(--on-surface-variant)',
                    lineHeight: 1.5, marginBottom: 10,
                    overflow: 'hidden', display: '-webkit-box',
                    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any,
                  }}>
                    {note.content ? (note.content.length > 120 ? `${note.content.substring(0, 120)}...` : note.content) : ''}
                  </p>
                  {note.tags && note.tags.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {note.tags.slice(0, 3).map((tag) => (
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
            background: 'rgba(12, 14, 20, 0.8)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => setShowCaptureModal(false)}
        >
          <div
            className="animate-slide-up"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 540,
              background: 'var(--surface-container)',
              borderRadius: 'var(--radius-xl)', padding: 28, position: 'relative',
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

            {/* Tabs — only URL is implemented; others show "Coming soon" badge */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--outline-variant)', paddingBottom: 8 }}>
              {/* URL — live */}
              <button
                onClick={() => setCaptureTab('url')}
                style={{
                  background: captureTab === 'url' ? 'var(--primary-dim)' : 'transparent',
                  border: 'none', borderRadius: 'var(--radius-sm)',
                  color: captureTab === 'url' ? 'var(--primary)' : 'var(--on-surface-dim)',
                  fontFamily: 'var(--font-display)', fontWeight: 600,
                  fontSize: '0.8125rem', cursor: 'pointer', padding: '4px 12px',
                }}
              >
                URL
              </button>

              {[
                { key: 'youtube', label: 'YouTube' },
                { key: 'upload', label: 'File Upload' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => {
                    if (tab.key === 'upload') {
                      setShowCaptureModal(false);
                      setUploadModalOpen(true);
                    } else {
                      setCaptureTab(tab.key);
                    }
                  }}
                  style={{
                    background: captureTab === tab.key ? 'var(--primary-dim)' : 'transparent',
                    border: 'none', borderRadius: 'var(--radius-sm)',
                    color: captureTab === tab.key ? 'var(--primary)' : 'var(--on-surface-dim)',
                    fontFamily: 'var(--font-display)', fontWeight: 600,
                    fontSize: '0.8125rem', cursor: 'pointer', padding: '4px 12px',
                    display: 'flex', alignItems: 'center', gap: 5,
                    position: 'relative',
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* URL & YouTube tab content */}
            {(captureTab === 'url' || captureTab === 'youtube') && (
              <div>
                <span className="label-sm" style={{ marginBottom: 8, display: 'block' }}>{captureTab === 'youtube' ? 'YouTube Link' : 'Source Link'}</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, flex: 1,
                    background: 'var(--surface-container-lowest)',
                    borderRadius: 'var(--radius-md)', padding: '10px 14px',
                  }}>
                    <Link2 size={16} style={{ color: 'var(--on-surface-dim)', flexShrink: 0 }} />
                    <input
                      value={importUrlStr}
                      onChange={(e) => setImportUrlStr(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleImport(); }}
                      placeholder={captureTab === 'youtube' ? "https://youtube.com/watch?v=..." : "https://example.com/article-to-save"}
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
                      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAiSummarize(!aiSummarize); } }}
                      style={{
                        width: 36, height: 20, borderRadius: 10,
                        background: aiSummarize ? 'var(--secondary)' : 'var(--surface-container-highest)',
                        padding: 2, cursor: 'pointer', transition: 'background 200ms',
                      }}
                    >
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
          </div>
        </div>
      )}

      {uploadModalOpen && (
        <FileUploadModal onClose={() => setUploadModalOpen(false)} />
      )}
    </>
  );
}
