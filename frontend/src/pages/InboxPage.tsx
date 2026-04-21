import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Inbox, Tag, Archive, RefreshCw, Sparkles, ExternalLink,
  CheckCircle, AlertCircle, FileText, Clock,
} from 'lucide-react';
import { apiUrl } from '../lib/api';

interface InboxNote {
  id: string;
  title: string;
  content: string;
  tags: string[];
  source_type: string | null;
  created_at: string | null;
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function Toast({ message, type = 'success' }: { message: string; type?: 'success' | 'error' | 'info' }) {
  const color = type === 'error' ? 'var(--error)' : type === 'success' ? 'var(--secondary)' : 'var(--primary)';
  return (
    <div className="animate-fade-in" style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 300,
      padding: '12px 18px', borderRadius: 'var(--radius-lg)',
      background: 'var(--surface-container-high)', border: `1px solid ${color}`,
      color: 'var(--on-surface)', fontSize: '0.8125rem',
      boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
      display: 'flex', alignItems: 'center', gap: 8, maxWidth: 360,
    }}>
      <CheckCircle size={14} style={{ color, flexShrink: 0 }} />
      {message}
    </div>
  );
}

// ── Tag input inline ───────────────────────────────────────────────────────
function TagInput({ onSave, onCancel }: { onSave: (tags: string[]) => void; onCancel: () => void }) {
  const [value, setValue] = useState('');
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8 }}>
      <input
        autoFocus
        className="input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSave(value.split(',').map((t) => t.trim()).filter(Boolean));
          if (e.key === 'Escape') onCancel();
        }}
        placeholder="tag1, tag2, tag3"
        style={{ fontSize: '0.75rem', padding: '4px 10px', borderRadius: 'var(--radius-full)', flex: 1 }}
      />
      <button className="btn" style={{ padding: '4px 10px', fontSize: '0.75rem' }}
        onClick={() => onSave(value.split(',').map((t) => t.trim()).filter(Boolean))}>
        Save
      </button>
      <button className="btn-ghost" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}

export default function InboxPage() {
  const [notes, setNotes] = useState<InboxNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [triaging, setTriaging] = useState<Record<string, string>>({});
  const [tagInputId, setTagInputId] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchInbox = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(apiUrl('/api/inbox'));
      if (!res.ok) throw new Error(`Failed to load inbox: ${res.status}`);
      const data = await res.json();
      setNotes(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchInbox(); }, [fetchInbox]);

  const triage = async (id: string, action: string, tags?: string[]) => {
    setTriaging((prev) => ({ ...prev, [id]: action }));
    try {
      await fetch(apiUrl(`/api/inbox/${id}/triage`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, tags }),
      });
      if (action === 'archive') {
        setNotes((prev) => prev.filter((n) => n.id !== id));
        showToast('Note archived.', 'success');
      } else if (action === 'schedule_review') {
        showToast('Scheduled for review tomorrow.', 'info');
        setNotes((prev) => prev.filter((n) => n.id !== id));
      } else if (action === 'add_tags') {
        showToast('Tags added!', 'success');
        setNotes((prev) => prev.filter((n) => n.id !== id));
        setTagInputId(null);
      }
    } catch (e: any) {
      showToast(`Action failed: ${e.message}`, 'error');
    } finally {
      setTriaging((prev) => { const copy = { ...prev }; delete copy[id]; return copy; });
    }
  };

  const summarize = async (note: InboxNote) => {
    setSummarizing(note.id);
    try {
      const res = await fetch(apiUrl(`/api/notes/${note.id}/summarize`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: localStorage.getItem('activeModel') || 'qwen2.5:0.5b' }),
      });
      if (!res.ok) throw new Error('Summarize failed');
      const data = await res.json();
      setSummaries((prev) => ({ ...prev, [note.id]: data.result }));
    } catch (e: any) {
      showToast(`Summarize failed: ${e.message}`, 'error');
    } finally {
      setSummarizing(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, height: '100%', overflowY: 'auto' }}>
      {toast && <Toast message={toast.msg} type={toast.type} />}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Inbox size={20} style={{ color: 'var(--primary)' }} />
            <h1 style={{ fontFamily: 'var(--font-display)' }}>Inbox</h1>
            {notes.length > 0 && (
              <span style={{
                padding: '2px 8px', borderRadius: 'var(--radius-full)',
                background: 'var(--primary)', color: 'var(--on-primary)',
                fontSize: '0.625rem', fontWeight: 700,
              }}>
                {notes.length}
              </span>
            )}
          </div>
          <p style={{ fontSize: '0.8125rem', color: 'var(--on-surface-dim)' }}>
            Untagged and recently imported notes — process these to grow your knowledge graph.
          </p>
        </div>
        <button className="btn-ghost" onClick={fetchInbox} disabled={loading} style={{ gap: 6 }}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Triage guide */}
      <div style={{
        display: 'flex', gap: 12, padding: '10px 14px',
        borderRadius: 'var(--radius-md)', background: 'var(--surface-container-lowest)',
        fontSize: '0.75rem', color: 'var(--on-surface-dim)', flexWrap: 'wrap',
      }}>
        <span style={{ color: 'var(--secondary)', fontWeight: 600, fontFamily: 'var(--font-display)' }}>Triage guide:</span>
        <span>📎 <strong>Tag</strong> → adds to index</span>
        <span>🔁 <strong>Review</strong> → schedules for tomorrow</span>
        <span>✨ <strong>Summarize</strong> → AI bullet summary</span>
        <span>📦 <strong>Archive</strong> → removes from inbox</span>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          display: 'flex', gap: 10, padding: '10px 14px',
          borderRadius: 'var(--radius-md)', background: 'var(--error-container)',
          fontSize: '0.8125rem', color: 'var(--on-surface)', alignItems: 'center',
        }}>
          <AlertCircle size={14} style={{ color: 'var(--error)', flexShrink: 0 }} />
          {error}
          <button className="btn-ghost" onClick={fetchInbox} style={{ marginLeft: 'auto', fontSize: '0.75rem' }}>Retry</button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{
              height: 96, borderRadius: 'var(--radius-lg)',
              background: 'var(--surface-container)',
              animation: 'pulse 1.5s ease-in-out infinite',
              opacity: 0.5,
            }} />
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && !error && notes.length === 0 && (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          color: 'var(--on-surface-dim)', textAlign: 'center', padding: 48,
        }}>
          <CheckCircle size={48} style={{ color: 'var(--secondary)', marginBottom: 16, opacity: 0.6 }} />
          <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 8 }}>Inbox Zero 🎉</h2>
          <p style={{ fontSize: '0.875rem', maxWidth: 360 }}>
            All your recent notes have been processed. Capture more to keep growing.
          </p>
          <Link to="/notes/new" className="btn" style={{ marginTop: 20, textDecoration: 'none' }}>
            <FileText size={14} /> Write a note
          </Link>
        </div>
      )}

      {/* Note cards */}
      {!loading && notes.map((note) => (
        <div key={note.id} className="animate-fade-in" style={{
          borderRadius: 'var(--radius-xl)',
          background: 'var(--surface-container)',
          border: '1px solid var(--outline-variant)',
          overflow: 'hidden',
        }}>
          {/* Card header */}
          <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 'var(--radius-md)', flexShrink: 0,
              background: note.source_type === 'url' ? 'var(--secondary-container)'
                : note.source_type === 'guide' ? 'var(--tertiary-container)'
                : 'var(--surface-container-high)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <FileText size={16} style={{ color: 'var(--on-surface-variant)' }} />
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <Link to={`/notes/${note.id}`} style={{
                  fontFamily: 'var(--font-display)', fontWeight: 600,
                  fontSize: '0.9375rem', color: 'var(--on-surface)',
                  textDecoration: 'none',
                }}>
                  {note.title}
                </Link>
                {note.source_type && (
                  <span style={{
                    fontSize: '0.5rem', fontWeight: 700, padding: '1px 6px',
                    borderRadius: 'var(--radius-full)',
                    background: 'var(--surface-container-highest)',
                    color: 'var(--on-surface-dim)',
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                  }}>
                    {note.source_type}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--on-surface-dim)', marginTop: 2 }}>
                <Clock size={10} style={{ display: 'inline', marginRight: 4 }} />
                {timeAgo(note.created_at)}
              </div>
            </div>

            <Link to={`/notes/${note.id}`} style={{ color: 'var(--on-surface-dim)' }}>
              <ExternalLink size={14} />
            </Link>
          </div>

          {/* Content preview */}
          <div style={{
            padding: '0 18px 12px',
            fontSize: '0.8125rem', color: 'var(--on-surface-variant)',
            lineHeight: 1.55,
            overflow: 'hidden', display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any,
          }}>
            {note.content?.substring(0, 200)}
          </div>

          {/* AI summary result */}
          {summaries[note.id] && (
            <div style={{
              margin: '0 18px 12px',
              padding: '10px 14px', borderRadius: 'var(--radius-md)',
              background: 'var(--surface-container-low)',
              borderLeft: '2px solid var(--secondary)',
              fontSize: '0.8125rem', color: 'var(--on-surface-variant)',
              lineHeight: 1.55, whiteSpace: 'pre-wrap',
            }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                <Sparkles size={11} style={{ color: 'var(--secondary)' }} />
                <span style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--secondary)' }}>AI Summary</span>
              </div>
              {summaries[note.id]}
            </div>
          )}

          {/* Tag input */}
          {tagInputId === note.id && (
            <div style={{ padding: '0 18px 12px' }}>
              <TagInput
                onSave={(tags) => triage(note.id, 'add_tags', tags)}
                onCancel={() => setTagInputId(null)}
              />
            </div>
          )}

          {/* Triage actions */}
          <div style={{
            padding: '10px 18px', borderTop: '1px solid var(--outline-variant)',
            display: 'flex', gap: 6, flexWrap: 'wrap',
            background: 'var(--surface-container-lowest)',
          }}>
            <button
              className="btn-ghost"
              style={{ fontSize: '0.75rem', gap: 5 }}
              onClick={() => setTagInputId(tagInputId === note.id ? null : note.id)}
            >
              <Tag size={12} /> Tag
            </button>
            <button
              className="btn-ghost"
              style={{ fontSize: '0.75rem', gap: 5 }}
              disabled={summarizing === note.id}
              onClick={() => summarize(note)}
            >
              <Sparkles size={12} style={{ color: 'var(--secondary)' }} />
              {summarizing === note.id ? 'Summarizing...' : 'Summarize'}
            </button>
            <button
              className="btn-ghost"
              style={{ fontSize: '0.75rem', gap: 5 }}
              disabled={!!triaging[note.id]}
              onClick={() => triage(note.id, 'schedule_review')}
            >
              <RefreshCw size={12} /> Schedule Review
            </button>
            <button
              className="btn-ghost"
              style={{ fontSize: '0.75rem', gap: 5, marginLeft: 'auto', color: 'var(--on-surface-dim)' }}
              disabled={!!triaging[note.id]}
              onClick={() => triage(note.id, 'archive')}
            >
              <Archive size={12} />
              {triaging[note.id] === 'archive' ? 'Archiving...' : 'Archive'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
