import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Newspaper, BookOpen, AlertTriangle, Clock, Zap } from 'lucide-react';
import { useUI } from '../context/UIContext';

// ── Types ──────────────────────────────────────────────────────────────────

interface DigestNote {
  id: string;
  title: string;
  updated_at?: string;
  created_at?: string;
  tags?: string[];
}

interface DigestResponse {
  generated_at: string;
  note_count: number;
  digest: string;
  recent_notes: DigestNote[];
  forgotten_notes: DigestNote[];
  cached: boolean;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Sub-components ──────────────────────────────────────────────────────────

function NoteCard({ note, dimmed }: { note: DigestNote; dimmed?: boolean }) {
  return (
    <Link
      to={`/notes/${note.id}`}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: '10px 14px',
        borderRadius: 'var(--radius-md)',
        background: dimmed ? 'var(--surface-container-lowest)' : 'var(--surface-container)',
        border: `1px solid ${dimmed ? 'var(--outline-variant)' : 'var(--outline)'}`,
        textDecoration: 'none',
        color: 'var(--on-surface)',
        opacity: dimmed ? 0.75 : 1,
        transition: 'all 160ms',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLAnchorElement).style.borderColor = 'var(--primary)';
        (e.currentTarget as HTMLAnchorElement).style.opacity = '1';
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLAnchorElement).style.borderColor = dimmed ? 'var(--outline-variant)' : 'var(--outline)';
        (e.currentTarget as HTMLAnchorElement).style.opacity = dimmed ? '0.75' : '1';
      }}
    >
      <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{note.title || 'Untitled'}</span>
      {(note.updated_at || note.created_at) && (
        <span style={{ fontSize: '0.75rem', color: 'var(--on-surface-dim)' }}>
          <Clock size={10} style={{ display: 'inline', marginRight: 4 }} />
          {timeAgo(note.updated_at || note.created_at!)}
        </span>
      )}
      {note.tags && note.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 2 }}>
          {note.tags.slice(0, 4).map(tag => (
            <span
              key={tag}
              style={{
                fontSize: '0.625rem',
                padding: '1px 6px',
                borderRadius: 'var(--radius-full)',
                background: 'var(--primary-container)',
                color: 'var(--on-primary-container)',
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function DigestPage() {
  const { showToast } = useUI();
  const [digest, setDigest] = useState<DigestResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDigest = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/digest/today');
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data: DigestResponse = await res.json();
      setDigest(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load digest';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  const regenerate = async () => {
    setRegenerating(true);
    try {
      const res = await fetch('/api/digest/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      showToast('Digest regenerated!', 'success');
      await fetchDigest();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Regeneration failed';
      showToast(msg, 'error');
    } finally {
      setRegenerating(false);
    }
  };

  useEffect(() => {
    void fetchDigest();
  }, [fetchDigest]);

  // ── Loading skeleton ─────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <Newspaper size={22} style={{ color: 'var(--primary)' }} />
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontFamily: 'var(--font-display)' }}>Daily Digest</h1>
        </div>
        {[1, 2, 3].map(i => (
          <div
            key={i}
            style={{
              height: i === 1 ? 180 : 60,
              borderRadius: 'var(--radius-lg)',
              background: 'var(--surface-container)',
              marginBottom: 16,
              animation: 'pulse 1.5s ease-in-out infinite',
            }}
          />
        ))}
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────────────────
  if (error && !digest) {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <Newspaper size={22} style={{ color: 'var(--primary)' }} />
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontFamily: 'var(--font-display)' }}>Daily Digest</h1>
        </div>
        <div style={{
          padding: 24,
          borderRadius: 'var(--radius-lg)',
          background: 'var(--error-container)',
          color: 'var(--on-error-container)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <AlertTriangle size={20} />
          <div>
            <p style={{ margin: 0, fontWeight: 600 }}>Could not load today's digest</p>
            <p style={{ margin: '4px 0 12px', fontSize: '0.875rem' }}>{error}</p>
            <button className="btn" onClick={() => void fetchDigest()}>Try again</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main render ──────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <Newspaper size={22} style={{ color: 'var(--primary)' }} />
        <div style={{ flex: 1 }}>
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontFamily: 'var(--font-display)' }}>Daily Digest</h1>
          {digest && (
            <span style={{ fontSize: '0.75rem', color: 'var(--on-surface-dim)' }}>
              {digest.cached ? (
                <>
                  <Zap size={10} style={{ display: 'inline', marginRight: 4 }} />
                  Cached · generated {timeAgo(digest.generated_at)} · {digest.note_count} notes
                </>
              ) : (
                <>Fresh · {new Date(digest.generated_at).toLocaleTimeString()} · {digest.note_count} notes</>
              )}
            </span>
          )}
        </div>
        <button
          className="btn-ghost"
          onClick={() => void regenerate()}
          disabled={regenerating}
          style={{ gap: 6, fontSize: '0.8125rem' }}
        >
          <RefreshCw size={14} style={{ animation: regenerating ? 'spin 1s linear infinite' : 'none' }} />
          {regenerating ? 'Regenerating…' : 'Regenerate'}
        </button>
      </div>

      {digest && (
        <>
          {/* AI Digest Text */}
          <section style={{
            padding: '20px 24px',
            borderRadius: 'var(--radius-xl)',
            background: 'var(--surface-container)',
            border: '1px solid var(--outline)',
            marginBottom: 28,
          }}>
            <h2 style={{ margin: '0 0 12px', fontSize: '0.9375rem', fontFamily: 'var(--font-display)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <BookOpen size={16} style={{ color: 'var(--primary)' }} />
              Today's AI Summary
            </h2>
            <div style={{
              fontSize: '0.9375rem',
              lineHeight: 1.7,
              color: 'var(--on-surface)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}>
              {digest.digest || 'No digest available. Add more notes to get started.'}
            </div>
          </section>

          {/* Recent notes */}
          {digest.recent_notes?.length > 0 && (
            <section style={{ marginBottom: 28 }}>
              <h2 style={{ margin: '0 0 12px', fontSize: '0.875rem', fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--on-surface-dim)' }}>
                Recently Active ({digest.recent_notes.length})
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                {digest.recent_notes.map(n => <NoteCard key={n.id} note={n} />)}
              </div>
            </section>
          )}

          {/* Forgotten notes */}
          {digest.forgotten_notes?.length > 0 && (
            <section>
              <h2 style={{ margin: '0 0 12px', fontSize: '0.875rem', fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--on-surface-dim)' }}>
                Time to Revisit ({digest.forgotten_notes.length})
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                {digest.forgotten_notes.map(n => <NoteCard key={n.id} note={n} dimmed />)}
              </div>
            </section>
          )}

          {digest.recent_notes?.length === 0 && digest.forgotten_notes?.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--on-surface-dim)' }}>
              <Newspaper size={40} style={{ marginBottom: 12, opacity: 0.3 }} />
              <p style={{ margin: 0 }}>Start capturing notes and your digest will appear here.</p>
              <Link to="/notes/new" className="btn" style={{ display: 'inline-flex', marginTop: 16 }}>Create first note</Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
