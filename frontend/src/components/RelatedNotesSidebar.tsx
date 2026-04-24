/**
 * RelatedNotesSidebar — Phase 3.2
 * Shows vector-similar or keyword-matched notes alongside a note.
 * Includes one-click bidirectional wikilink insertion.
 */
import { useState, useEffect } from 'react';
import { Link2, ExternalLink, RefreshCw, Brain, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiUrl } from '../lib/api';

interface RelatedNote {
  id: string;
  title: string;
  tags: string[];
  updated_at: string;
  source: 'vector' | 'keyword';
}

interface Props {
  noteId: string;
  noteTitle?: string;
  /** Called when user clicks "Link" to insert a wikilink */
  onInsertLink?: (title: string) => void;
}

export default function RelatedNotesSidebar({ noteId, onInsertLink }: Props) {
  const navigate = useNavigate();
  const [notes, setNotes] = useState<RelatedNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [linked, setLinked] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(apiUrl(`/api/notes/${noteId}/related?limit=6`));
      if (!res.ok) throw new Error();
      setNotes(await res.json());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [noteId]);

  const handleLink = (note: RelatedNote) => {
    onInsertLink?.(`[[${note.title}]]`);
    setLinked((prev) => new Set(prev).add(note.id));
  };

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const d = Math.floor(diff / 86400000);
    if (d === 0) return 'today';
    if (d === 1) return 'yesterday';
    if (d < 30) return `${d}d ago`;
    return `${Math.floor(d / 30)}mo ago`;
  };

  return (
    <div style={{
      width: 220, flexShrink: 0,
      borderLeft: '1px solid var(--outline-variant)',
      background: 'var(--surface-container)',
      display: 'flex', flexDirection: 'column',
      fontSize: '0.8125rem',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 14px',
        borderBottom: '1px solid var(--outline-variant)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <Brain size={14} style={{ color: 'var(--primary)' }} />
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.8125rem', flex: 1 }}>
          Related
        </span>
        <button
          onClick={load}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--on-surface-dim)', padding: 3, borderRadius: 'var(--radius-sm)' }}
          title="Refresh"
        >
          <RefreshCw size={13} />
        </button>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 10 }}>
        {loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1, 2, 3].map((i) => (
              <div key={i} style={{
                height: 64, borderRadius: 'var(--radius-md)',
                background: 'var(--surface-container-low)',
                animation: 'pulse 1.5s ease-in-out infinite',
              }} />
            ))}
          </div>
        )}

        {!loading && error && (
          <div style={{ textAlign: 'center', padding: '20px 8px', color: 'var(--on-surface-dim)', fontSize: '0.75rem' }}>
            <p>Could not load related notes.</p>
            <button onClick={load} className="btn-ghost" style={{ marginTop: 8, fontSize: '0.75rem' }}>Retry</button>
          </div>
        )}

        {!loading && !error && notes.length === 0 && (
          <div style={{ textAlign: 'center', padding: '20px 8px', color: 'var(--on-surface-dim)', fontSize: '0.75rem' }}>
            <Brain size={28} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.3 }} />
            <p>No related notes found yet.</p>
            <p style={{ marginTop: 4, opacity: 0.7 }}>Add more notes and tags to build connections.</p>
          </div>
        )}

        {!loading && !error && notes.map((note) => (
          <div
            key={note.id}
            style={{
              marginBottom: 8, padding: '10px 10px 8px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--surface-container-lowest)',
              border: '1px solid var(--outline-variant)',
              transition: 'border-color 160ms',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--outline-variant)')}
          >
            {/* Title row */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4, marginBottom: 5 }}>
              <span
                onClick={() => navigate(`/notes/${note.id}`)}
                style={{
                  flex: 1, fontSize: '0.8125rem', fontFamily: 'var(--font-display)',
                  fontWeight: 600, color: 'var(--on-surface)', cursor: 'pointer',
                  lineHeight: 1.35, wordBreak: 'break-word',
                }}
              >
                {note.title}
              </span>
              <button
                onClick={() => navigate(`/notes/${note.id}`)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--on-surface-dim)', padding: 1, flexShrink: 0 }}
                title="Open"
              >
                <ExternalLink size={11} />
              </button>
            </div>

            {/* Meta row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Clock size={10} style={{ color: 'var(--on-surface-dim)', flexShrink: 0 }} />
              <span style={{ fontSize: '0.625rem', color: 'var(--on-surface-dim)' }}>
                {timeAgo(note.updated_at)}
              </span>
              {note.source === 'vector' && (
                <span style={{
                  fontSize: '0.5rem', padding: '1px 5px', borderRadius: 'var(--radius-full)',
                  background: 'var(--primary-container)', color: 'var(--primary)', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>AI</span>
              )}
            </div>

            {/* Tags */}
            {note.tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                {note.tags.slice(0, 3).map((t) => (
                  <span key={t} style={{
                    fontSize: '0.5625rem', padding: '1px 6px', borderRadius: 'var(--radius-full)',
                    background: 'var(--surface-container)', border: '1px solid var(--outline-variant)',
                    color: 'var(--on-surface-dim)',
                  }}>
                    {t}
                  </span>
                ))}
              </div>
            )}

            {/* Link action */}
            {onInsertLink && (
              <button
                onClick={() => handleLink(note)}
                disabled={linked.has(note.id)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  padding: '4px 0', borderRadius: 'var(--radius-sm)',
                  border: `1px solid ${linked.has(note.id) ? 'var(--secondary)' : 'var(--outline-variant)'}`,
                  background: linked.has(note.id) ? 'var(--secondary-container)' : 'transparent',
                  color: linked.has(note.id) ? 'var(--secondary)' : 'var(--on-surface-dim)',
                  fontSize: '0.625rem', cursor: linked.has(note.id) ? 'default' : 'pointer',
                  fontFamily: 'var(--font-display)', fontWeight: 600,
                  transition: 'all 150ms',
                }}
              >
                <Link2 size={11} />
                {linked.has(note.id) ? 'Linked ✓' : 'Insert link'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
