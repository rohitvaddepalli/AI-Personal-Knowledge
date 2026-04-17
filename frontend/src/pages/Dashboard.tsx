import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Sparkles, X, PenTool, Shuffle, Search, Brain } from 'lucide-react';

function getErrorMessage(status: number) {
  if (status === 401) return 'Sign in required to load dashboard.';
  if (status === 403) return 'Access denied. Check API permissions.';
  return `Request failed with status ${status}.`;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [insights, setInsights] = useState<any[]>([]);
  const [recentNotes, setRecentNotes] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [recentNotesError, setRecentNotesError] = useState<string | null>(null);

  useEffect(() => {
    fetchInsights();
    fetchRecentNotes();
  }, []);

  const fetchInsights = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/insights');
      if (!res.ok) throw new Error(getErrorMessage(res.status));
      const data = await res.json();
      setInsights(Array.isArray(data) ? data : []);
      setInsightsError(null);
    } catch (e) {
      console.error(e);
      setInsights([]);
      setInsightsError(e instanceof Error ? e.message : 'Failed to load insights.');
    }
  };

  const fetchRecentNotes = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/notes?limit=10');
      if (!res.ok) throw new Error(getErrorMessage(res.status));
      const data = await res.json();
      const notes = Array.isArray(data) ? data.slice(0, 10) : [];
      setRecentNotes(notes);
      setRecentNotesError(null);
    } catch (e) {
      console.error(e);
      setRecentNotes([]);
      setRecentNotesError(e instanceof Error ? e.message : 'Failed to load recent notes.');
    }
  };

  const generateDigest = async () => {
    setGenerating(true);
    try {
      await fetch('http://localhost:8000/api/insights/generate', { method: 'POST' });
      await fetchInsights();
      setTimeout(() => setGenerating(false), 2000);
    } catch (e) {
      console.error(e);
      setGenerating(false);
    }
  };

  const dismissInsight = async (id: number) => {
    try {
      await fetch(`http://localhost:8000/api/insights/${id}`, { method: 'DELETE' });
      fetchInsights();
    } catch (e) {
      console.error(e);
    }
  };

  const quickActions = [
    { icon: PenTool, label: 'Capture', action: () => navigate('/notes/new') },
    { icon: Shuffle, label: 'Surprise', action: async () => {
      try {
        const res = await fetch('http://localhost:8000/api/notes?limit=50');
        if (!res.ok) throw new Error('Failed to fetch notes');
        const notes = await res.json();
        if (!Array.isArray(notes) || notes.length === 0) { alert('No notes yet — create some first!'); return; }
        const rand = notes[Math.floor(Math.random() * notes.length)];
        navigate(`/notes/${rand.id}`);
      } catch { if (recentNotes.length > 0) { navigate(`/notes/${recentNotes[Math.floor(Math.random() * recentNotes.length)].id}`); } else { alert('No notes yet — create some first!'); } }
    }},
    { icon: Search, label: 'Search', action: () => navigate('/notes') },
    { icon: Brain, label: 'Think', action: () => navigate('/ask') },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28, height: '100%', overflowY: 'auto' }}>
      {/* ═══ Header ═══ */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div className="label-xs" style={{ color: 'var(--primary)', marginBottom: 6 }}>
            ● Second Brain
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 700 }}>
            Dashboard
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{
            fontSize: '0.6875rem', color: 'var(--on-surface-dim)',
            fontFamily: 'var(--font-mono)', padding: '4px 8px',
            background: 'var(--surface-container)', borderRadius: 'var(--radius-sm)',
          }}>
            Ctrl K <span style={{ opacity: 0.5 }}>Open notes</span>
          </span>
          <span style={{
            fontSize: '0.6875rem', color: 'var(--on-surface-dim)',
            fontFamily: 'var(--font-mono)', padding: '4px 8px',
            background: 'var(--surface-container)', borderRadius: 'var(--radius-sm)',
          }}>
            Ctrl N <span style={{ opacity: 0.5 }}>New note</span>
          </span>
        </div>
      </div>

      {/* Error Banner */}
      {(insightsError || recentNotesError) && (
        <div style={{
          borderRadius: 'var(--radius-md)', padding: '12px 16px',
          background: 'var(--tertiary-container)', fontSize: '0.8125rem',
          color: 'var(--on-surface)', display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          {insightsError && <span>{insightsError}</span>}
          {recentNotesError && <span>{recentNotesError}</span>}
        </div>
      )}

      {/* ═══ Welcome ═══ */}
      <div>
        <h2 style={{
          fontFamily: 'var(--font-display)', fontSize: '1.5rem',
          fontWeight: 600, marginBottom: 6, color: 'var(--on-surface)',
        }}>
          Welcome to your space.
        </h2>
        <p style={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)' }}>
          A calm environment for capturing, connecting, and deep thinking.
        </p>
      </div>

      {/* ═══ Quick Actions ═══ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.label}
              onClick={action.action}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 8, padding: '20px 12px',
                background: 'var(--surface-container)',
                borderRadius: 'var(--radius-lg)', border: '1px solid var(--outline-variant)',
                cursor: 'pointer', color: 'var(--on-surface-variant)',
                fontFamily: 'var(--font-display)', fontSize: '0.8125rem',
                fontWeight: 500, transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = 'var(--surface-container-high)';
                e.currentTarget.style.color = 'var(--on-surface)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'var(--surface-container)';
                e.currentTarget.style.color = 'var(--on-surface-variant)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <Icon size={20} strokeWidth={1.5} />
              {action.label}
            </button>
          );
        })}
      </div>

      {/* ═══ Two Column: Recent Notes + Deep Insights ═══ */}
      <div style={{ display: 'flex', gap: 24, flex: 1, minHeight: 0 }}>
        {/* Recent Notes — left column */}
        <div style={{ flex: 3, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontFamily: 'var(--font-display)' }}>Recent Notes</h3>
            <Link
              to="/notes"
              style={{
                fontSize: '0.75rem', color: 'var(--primary)',
                textDecoration: 'none', fontWeight: 500,
              }}
            >
              View all →
            </Link>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recentNotes.length === 0 ? (
              <div style={{
                padding: 40, textAlign: 'center', color: 'var(--on-surface-dim)',
                fontSize: '0.8125rem', background: 'var(--surface-container)',
                borderRadius: 'var(--radius-lg)',
              }}>
                No notes yet. Create your first thought.
              </div>
            ) : (
              recentNotes.map((note) => (
                <Link
                  key={note.id}
                  to={`/notes/${note.id}`}
                  style={{
                    textDecoration: 'none', color: 'inherit',
                    padding: '14px 18px',
                    background: 'var(--surface-container)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--outline-variant)',
                    transition: 'all 200ms cubic-bezier(0.16, 1, 0.3, 1)',
                    display: 'block',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = 'var(--surface-container-high)';
                    e.currentTarget.style.borderColor = 'var(--outline)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = 'var(--surface-container)';
                    e.currentTarget.style.borderColor = 'var(--outline-variant)';
                  }}
                >
                  <div style={{
                    fontFamily: 'var(--font-display)', fontWeight: 600,
                    fontSize: '0.875rem', color: 'var(--on-surface)',
                    marginBottom: 4,
                  }}>
                    {note.title || 'Untitled Note'}
                  </div>
                  <div style={{
                    fontSize: '0.75rem', color: 'var(--on-surface-dim)',
                    lineHeight: 1.4, overflow: 'hidden',
                    display: '-webkit-box', WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical' as any,
                  }}>
                    {note.content?.substring(0, 150)}
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Deep Insights — right column */}
        <div style={{ flex: 2, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontFamily: 'var(--font-display)' }}>Deep Insights</h3>
            {generating && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'var(--surface-container)', padding: '4px 12px',
                borderRadius: 'var(--radius-full)', fontSize: '0.6875rem',
                color: 'var(--on-surface-dim)',
              }}>
                <div style={{
                  width: 50, height: 2, borderRadius: 99,
                  background: 'var(--surface-container-low)', overflow: 'hidden',
                }}>
                  <div className="dashboard-progress-bar" style={{
                    height: '100%', width: '100%',
                    background: 'linear-gradient(90deg, var(--primary), var(--primary-container))',
                  }} />
                </div>
                Synthesizing...
              </div>
            )}
          </div>

          <div style={{
            padding: 24, borderRadius: 'var(--radius-lg)',
            background: 'var(--surface-container)',
            border: '1px solid var(--outline-variant)',
            display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            {insights.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <Sparkles style={{ margin: '0 auto 12px', color: 'var(--on-surface-dim)', opacity: 0.4 }} size={24} />
                <p style={{ fontSize: '0.8125rem', color: 'var(--on-surface-dim)', marginBottom: 16 }}>
                  No recent insights generated.
                </p>
                <button className="btn-secondary" onClick={generateDigest} disabled={generating}>
                  {generating ? 'Processing...' : 'Synthesize Ideas'}
                </button>
              </div>
            ) : (
              insights.map((ins) => (
                <div
                  key={ins.id}
                  className="animate-fade-in"
                  style={{
                    position: 'relative', padding: '14px 16px',
                    background: 'var(--surface-container-low)',
                    borderRadius: 'var(--radius-md)',
                    borderLeft: '2px solid var(--secondary)',
                  }}
                >
                  <button
                    onClick={() => dismissInsight(ins.id)}
                    style={{
                      position: 'absolute', top: 8, right: 8,
                      background: 'transparent', border: 'none',
                      color: 'var(--on-surface-dim)', cursor: 'pointer',
                      padding: 4, borderRadius: 'var(--radius-sm)',
                      transition: 'color 200ms',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--on-surface)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--on-surface-dim)')}
                  >
                    <X size={14} />
                  </button>
                  <div className="label-xs" style={{ color: 'var(--secondary)', marginBottom: 6 }}>
                    {ins.insight_type.replace(/_/g, ' ')}
                  </div>
                  <div style={{
                    fontSize: '0.8125rem', lineHeight: 1.6,
                    color: 'var(--on-surface-variant)', whiteSpace: 'pre-wrap',
                  }}>
                    {ins.content.replace(/(\*\*|##)/g, '')}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
