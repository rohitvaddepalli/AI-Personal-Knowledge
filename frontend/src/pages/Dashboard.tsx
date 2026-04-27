import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Sparkles, X, PenTool, Shuffle, Search, Brain, AlertCircle, Inbox, RefreshCw, Zap, ArrowRight, BookOpen } from 'lucide-react';
import { apiUrl } from '../lib/api';
import MomentumPanel from '../components/MomentumPanel';
import ResurfacingWidgets from '../components/ResurfacingWidgets';
import WeeklyDigest from '../components/WeeklyDigest';
import FocusModeBar from '../components/FocusModeBar';

function getErrorMessage(status: number) {
  if (status === 401) return 'Sign in required to load dashboard.';
  if (status === 403) return 'Access denied. Check API permissions.';
  return `Request failed with status ${status}.`;
}


export default function Dashboard() {
  const navigate = useNavigate();
  const [insights, setInsights] = useState<any[]>([]);
  const [showWeeklyDigest, setShowWeeklyDigest] = useState(false);
  const [recentNotes, setRecentNotes] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [recentNotesError, setRecentNotesError] = useState<string | null>(null);
  const [todayStats, setTodayStats] = useState<{
    captured_today: number;
    connected_notes: number;
    due_review: number;
    total_notes: number;
  } | null>(null);

  useEffect(() => {
    fetchInsights();
    fetchRecentNotes();
    fetch(apiUrl('/api/inbox/stats'))
      .then((r) => r.json())
      .then(setTodayStats)
      .catch(console.error);
  }, []);

  const fetchInsights = async () => {
    try {
      const res = await fetch(apiUrl('/api/insights'));
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
      const res = await fetch(apiUrl('/api/notes?limit=10'));
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
      await fetch(apiUrl('/api/insights/generate'), { method: 'POST' });
      await fetchInsights();
      setTimeout(() => setGenerating(false), 2000);
    } catch (e) {
      console.error(e);
      setGenerating(false);
    }
  };

  const dismissInsight = async (id: number) => {
    try {
      await fetch(apiUrl(`/api/insights/${id}`), { method: 'DELETE' });
      fetchInsights();
    } catch (e) {
      console.error(e);
    }
  };

  const quickActions = [
    { icon: PenTool, label: 'Capture', action: () => navigate('/notes/new') },
    { icon: Shuffle, label: 'Surprise', action: async () => {
      try {
        const res = await fetch(apiUrl('/api/notes?limit=50'));
        if (!res.ok) throw new Error('Failed to fetch notes');
        const notes = await res.json();
        if (!Array.isArray(notes) || notes.length === 0) {
          navigate('/notes');
          return;
        }
        const rand = notes[Math.floor(Math.random() * notes.length)];
        navigate(`/notes/${rand.id}`);
      } catch {
        if (recentNotes.length > 0) {
          navigate(`/notes/${recentNotes[Math.floor(Math.random() * recentNotes.length)].id}`);
        } else {
          navigate('/notes');
        }
      }
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
          <FocusModeBar />
          <button
            onClick={() => setShowWeeklyDigest(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '6px 12px',
              background: 'var(--surface-container)',
              border: '1px solid var(--outline-variant)',
              borderRadius: 'var(--radius-full)',
              color: 'var(--on-surface-variant)',
              fontSize: '0.75rem', fontFamily: 'var(--font-display)', fontWeight: 600,
              cursor: 'pointer', transition: 'all 200ms',
            }}
          >
            <BookOpen size={12} /> Weekly Digest
          </button>
          <span style={{
            fontSize: '0.6875rem', color: 'var(--on-surface-dim)',
            fontFamily: 'var(--font-mono)', padding: '4px 8px',
            background: 'var(--surface-container)', borderRadius: 'var(--radius-sm)',
          }}>
            Ctrl K <span style={{ opacity: 0.5 }}>Open notes</span>
          </span>
        </div>
      </div>

      {/* Error Banner */}
      {(insightsError || recentNotesError) && (
        <div style={{
          borderRadius: 'var(--radius-md)', padding: '12px 16px',
          background: 'var(--error-container)', fontSize: '0.8125rem',
          color: 'var(--on-surface)', display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <AlertCircle size={14} style={{ color: 'var(--error)', flexShrink: 0 }} />
          <span style={{ flex: 1 }}>{insightsError ?? recentNotesError}</span>
          <button
            className="btn-ghost"
            onClick={() => { fetchInsights(); fetchRecentNotes(); }}
            style={{ fontSize: '0.75rem', flexShrink: 0 }}
          >
            Retry
          </button>
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

      {/* ═══ Today's Progress Pipeline ═══ */}
      {todayStats && (
        <div style={{
          borderRadius: 'var(--radius-xl)', overflow: 'hidden',
          border: '1px solid var(--outline-variant)',
          background: 'var(--surface-container)',
        }}>
          {/* Header */}
          <div style={{
            padding: '14px 18px',
            borderBottom: '1px solid var(--outline-variant)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <Zap size={16} style={{ color: 'var(--primary)' }} />
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.875rem' }}>
              Today's Progress
            </span>
            <span style={{
              marginLeft: 'auto', fontSize: '0.625rem', fontFamily: 'var(--font-mono)',
              color: 'var(--on-surface-dim)', fontWeight: 600,
            }}>
              {todayStats.total_notes} total notes
            </span>
          </div>

          {/* 3-step pipeline */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr auto 1fr auto 1fr',
            padding: '16px 20px', gap: 8, alignItems: 'center',
          }}>
            {/* Capture */}
            <div onClick={() => navigate('/notes/new')} style={{ textAlign: 'center', cursor: 'pointer' }}>
              <div style={{
                width: 48, height: 48, borderRadius: 'var(--radius-lg)',
                margin: '0 auto 8px',
                background: todayStats.captured_today > 0 ? 'var(--primary)' : 'var(--surface-container-high)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 200ms',
              }}>
                <PenTool size={20} style={{ color: todayStats.captured_today > 0 ? 'var(--on-primary)' : 'var(--on-surface-dim)' }} />
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.875rem', color: 'var(--on-surface)', marginBottom: 2 }}>Capture</div>
              <div style={{ fontSize: '0.6875rem', color: todayStats.captured_today > 0 ? 'var(--secondary)' : 'var(--on-surface-dim)' }}>
                {todayStats.captured_today > 0 ? `${todayStats.captured_today} today ✓` : '+ Add notes'}
              </div>
            </div>

            <ArrowRight size={14} style={{ color: 'var(--on-surface-dim)', opacity: 0.4 }} />

            {/* Connect */}
            <div onClick={() => navigate('/notes')} style={{ textAlign: 'center', cursor: 'pointer' }}>
              <div style={{
                width: 48, height: 48, borderRadius: 'var(--radius-lg)',
                margin: '0 auto 8px',
                background: todayStats.connected_notes > 0 ? 'var(--secondary)' : 'var(--surface-container-high)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 200ms',
              }}>
                <Inbox size={20} style={{ color: todayStats.connected_notes > 0 ? '#fff' : 'var(--on-surface-dim)' }} />
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.875rem', color: 'var(--on-surface)', marginBottom: 2 }}>Connect</div>
              <div style={{ fontSize: '0.6875rem', color: todayStats.connected_notes > 0 ? 'var(--secondary)' : 'var(--on-surface-dim)' }}>
                {todayStats.connected_notes > 0 ? `${todayStats.connected_notes} linked ✓` : 'Tag & link notes'}
              </div>
            </div>

            <ArrowRight size={14} style={{ color: 'var(--on-surface-dim)', opacity: 0.4 }} />

            {/* Review */}
            <div onClick={() => navigate('/review')} style={{ textAlign: 'center', cursor: 'pointer' }}>
              <div style={{
                width: 48, height: 48, borderRadius: 'var(--radius-lg)',
                margin: '0 auto 8px',
                background: todayStats.due_review === 0 ? 'var(--tertiary)' : 'var(--surface-container-high)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 200ms',
              }}>
                <RefreshCw size={20} style={{ color: todayStats.due_review === 0 ? '#fff' : 'var(--error)' }} />
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.875rem', color: 'var(--on-surface)', marginBottom: 2 }}>Review</div>
              <div style={{ fontSize: '0.6875rem', color: todayStats.due_review > 0 ? 'var(--error)' : 'var(--secondary)' }}>
                {todayStats.due_review > 0 ? `${todayStats.due_review} due` : 'All caught up ✓'}
              </div>
            </div>
          </div>

          {/* Next best action */}
          {(() => {
            let action = { icon: <PenTool size={14} />, label: 'Start capturing your first note', href: '/notes/new', cta: 'Write now' };
            if (todayStats.captured_today > 0 && todayStats.connected_notes === 0)
              action = { icon: <Inbox size={14} />, label: 'You have unprocessed notes in Inbox', href: '/inbox', cta: 'Open Inbox' };
            else if (todayStats.due_review > 0)
              action = { icon: <RefreshCw size={14} />, label: `${todayStats.due_review} note${todayStats.due_review > 1 ? 's' : ''} due for review`, href: '/review', cta: 'Review now' };
            else if (todayStats.captured_today > 0)
              action = { icon: <Brain size={14} />, label: 'Ask your brain about today\'s captures', href: '/ask', cta: 'Ask Brain' };
            return (
              <div style={{
                margin: '0 16px 16px',
                padding: '10px 14px', borderRadius: 'var(--radius-md)',
                background: 'var(--primary-container)',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <span style={{ color: 'var(--primary)' }}>{action.icon}</span>
                <span style={{ flex: 1, fontSize: '0.8125rem', color: 'var(--on-surface)', fontFamily: 'var(--font-display)' }}>
                  {action.label}
                </span>
                <button
                  className="btn"
                  onClick={() => navigate(action.href)}
                  style={{ fontSize: '0.75rem', padding: '6px 12px', gap: 6 }}
                >
                  {action.cta} <ArrowRight size={12} />
                </button>
              </div>
            );
          })()}
        </div>
      )}

      {/* ═══ Momentum Panel ═══ */}
      <MomentumPanel />

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

      {/* ═══ Resurfacing Widgets ═══ */}
      <ResurfacingWidgets />

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

      {/* ═══ Weekly Digest Modal ═══ */}
      {showWeeklyDigest && (
        <WeeklyDigest onClose={() => setShowWeeklyDigest(false)} />
      )}
    </div>
  );
}
