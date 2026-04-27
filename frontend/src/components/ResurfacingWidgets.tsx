import { useState, useEffect } from 'react';
import { Clock, Archive, Shuffle, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiUrl } from '../lib/api';

interface NoteRef {
  id: string;
  title: string;
  snippet: string;
  last_updated?: string | null;
  days_ago?: number | null;
}

interface OnThisDayGroup {
  label: string;
  notes: NoteRef[];
}

export default function ResurfacingWidgets() {
  const navigate = useNavigate();
  const [onThisDay, setOnThisDay] = useState<OnThisDayGroup[]>([]);
  const [forgotten, setForgotten] = useState<NoteRef[]>([]);
  const [surprise, setSurprise] = useState<{ note: NoteRef | null; hook: string | null } | null>(null);
  const [surpriseLoading, setSurpriseLoading] = useState(false);
  const [tab, setTab] = useState<'day' | 'forgotten' | 'surprise'>('day');

  useEffect(() => {
    Promise.all([
      fetch(apiUrl('/api/momentum/on-this-day')).then((r) => r.json()),
      fetch(apiUrl('/api/momentum/forgotten')).then((r) => r.json()),
    ])
      .then(([dayData, forgottenData]) => {
        setOnThisDay(dayData.groups ?? []);
        setForgotten(Array.isArray(forgottenData) ? forgottenData : []);
      })
      .catch(console.error);
  }, []);

  const loadSurprise = async () => {
    setSurpriseLoading(true);
    try {
      const res = await fetch(apiUrl('/api/momentum/surprise'));
      const data = await res.json();
      setSurprise(data);
    } catch { /* ignore */ }
    setSurpriseLoading(false);
  };

  const hasDay = onThisDay.length > 0;
  const hasForgotten = forgotten.length > 0;

  if (!hasDay && !hasForgotten) return null;

  return (
    <div style={{
      borderRadius: 'var(--radius-xl)',
      border: '1px solid var(--outline-variant)',
      background: 'var(--surface-container)',
      overflow: 'hidden',
    }}>
      {/* Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--outline-variant)',
      }}>
        {[
          { id: 'day' as const, icon: Clock, label: 'On This Day', show: hasDay },
          { id: 'forgotten' as const, icon: Archive, label: 'Forgotten', show: hasForgotten },
          { id: 'surprise' as const, icon: Shuffle, label: 'Surprise', show: true },
        ].filter((t) => t.show).map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => {
              setTab(id);
              if (id === 'surprise' && !surprise) loadSurprise();
            }}
            style={{
              flex: 1, padding: '10px 12px',
              background: 'transparent', border: 'none',
              borderBottom: tab === id ? '2px solid var(--primary)' : '2px solid transparent',
              color: tab === id ? 'var(--primary)' : 'var(--on-surface-dim)',
              fontSize: '0.75rem', fontFamily: 'var(--font-display)', fontWeight: 600,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              gap: 5, marginBottom: -1, transition: 'color 200ms',
            }}
          >
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: '12px 16px', minHeight: 100 }}>
        {/* On This Day */}
        {tab === 'day' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {onThisDay.map((group) => (
              <div key={group.label}>
                <div style={{
                  fontSize: '0.625rem', color: 'var(--primary)',
                  fontFamily: 'var(--font-mono)', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.08em',
                  marginBottom: 6,
                }}>
                  {group.label}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {group.notes.map((note) => (
                    <button
                      key={note.id}
                      onClick={() => navigate(`/notes/${note.id}`)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '8px 10px', background: 'var(--surface-container-high)',
                        borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
                        textAlign: 'left', width: '100%', transition: 'all 200ms',
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-container)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface-container-high)'; }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontFamily: 'var(--font-display)', fontWeight: 600,
                          fontSize: '0.8125rem', color: 'var(--on-surface)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {note.title}
                        </div>
                        <div style={{
                          fontSize: '0.6875rem', color: 'var(--on-surface-dim)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {note.snippet}
                        </div>
                      </div>
                      <ChevronRight size={12} style={{ color: 'var(--on-surface-dim)', flexShrink: 0 }} />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Forgotten Notes */}
        {tab === 'forgotten' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{
              fontSize: '0.6875rem', color: 'var(--on-surface-dim)',
              marginBottom: 8, lineHeight: 1.4,
            }}>
              Notes you haven't touched in a while — dust them off!
            </div>
            {forgotten.map((note) => (
              <button
                key={note.id}
                onClick={() => navigate(`/notes/${note.id}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', background: 'var(--surface-container-high)',
                  borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer',
                  textAlign: 'left', width: '100%', transition: 'all 200ms',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-container)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface-container-high)'; }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: 'var(--font-display)', fontWeight: 600,
                    fontSize: '0.8125rem', color: 'var(--on-surface)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {note.title}
                  </div>
                </div>
                {note.days_ago != null && (
                  <span style={{
                    fontSize: '0.5625rem', color: 'var(--on-surface-dim)',
                    background: 'var(--surface-container)', borderRadius: 'var(--radius-full)',
                    padding: '2px 6px', flexShrink: 0, fontFamily: 'var(--font-mono)',
                  }}>
                    {note.days_ago}d ago
                  </span>
                )}
                <ChevronRight size={12} style={{ color: 'var(--on-surface-dim)', flexShrink: 0 }} />
              </button>
            ))}
          </div>
        )}

        {/* Surprise Me */}
        {tab === 'surprise' && (
          <div style={{ padding: '8px 0' }}>
            {surpriseLoading ? (
              <div style={{
                textAlign: 'center', padding: 24,
                fontSize: '0.8125rem', color: 'var(--on-surface-dim)',
              }}>
                Finding something interesting…
              </div>
            ) : surprise?.note ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {surprise.hook && (
                  <div style={{
                    padding: '8px 12px',
                    background: 'var(--primary-container)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.75rem', color: 'var(--on-surface)',
                    fontStyle: 'italic', lineHeight: 1.5,
                  }}>
                    ✨ {surprise.hook}
                  </div>
                )}
                <button
                  onClick={() => navigate(`/notes/${surprise.note!.id}`)}
                  style={{
                    padding: '12px 14px', background: 'var(--surface-container-high)',
                    borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
                    textAlign: 'left', transition: 'all 200ms', display: 'flex',
                    alignItems: 'center', gap: 10,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-container)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface-container-high)'; }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{
                      fontFamily: 'var(--font-display)', fontWeight: 600,
                      fontSize: '0.875rem', color: 'var(--on-surface)', marginBottom: 4,
                    }}>
                      {surprise.note.title}
                    </div>
                    <div style={{
                      fontSize: '0.75rem', color: 'var(--on-surface-dim)', lineHeight: 1.4,
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any,
                      overflow: 'hidden',
                    }}>
                      {surprise.note.snippet}
                    </div>
                  </div>
                  <ChevronRight size={14} style={{ color: 'var(--on-surface-dim)', flexShrink: 0 }} />
                </button>
                <button
                  className="btn-ghost"
                  onClick={loadSurprise}
                  style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}
                >
                  <Shuffle size={12} /> Another one
                </button>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 20 }}>
                <button className="btn-secondary" onClick={loadSurprise} style={{ fontSize: '0.8125rem' }}>
                  <Shuffle size={14} style={{ marginRight: 6 }} />
                  Surprise Me
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
