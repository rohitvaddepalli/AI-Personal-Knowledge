import { useState, useEffect } from 'react';
import { X, BookOpen, Link2, RefreshCw, Sparkles, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiUrl } from '../lib/api';

interface DigestNote {
  id: string;
  title: string;
  snippet: string;
  created_at: string | null;
}

interface DigestData {
  period: string;
  captured: DigestNote[];
  connected: DigestNote[];
  to_revisit: DigestNote[];
  stats: {
    captured_count: number;
    connected_count: number;
    revisit_count: number;
  };
}

interface WeeklyDigestProps {
  onClose: () => void;
}

export default function WeeklyDigest({ onClose }: WeeklyDigestProps) {
  const navigate = useNavigate();
  const [data, setData] = useState<DigestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [synthStatus, setSynthStatus] = useState<'idle' | 'running' | 'done'>('idle');
  const [activeTab, setActiveTab] = useState<'captured' | 'connected' | 'revisit'>('captured');

  useEffect(() => {
    fetch(apiUrl('/api/momentum/digest'))
      .then((r) => r.json())
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const runSynthesis = async () => {
    setSynthStatus('running');
    await fetch(apiUrl('/api/synthesis/weekly'), { method: 'POST' });
    setTimeout(() => setSynthStatus('done'), 2000);
  };

  const tabs = [
    { id: 'captured' as const, label: 'Captured', icon: BookOpen, count: data?.stats.captured_count ?? 0 },
    { id: 'connected' as const, label: 'Connected', icon: Link2, count: data?.stats.connected_count ?? 0 },
    { id: 'revisit' as const, label: 'Revisit', icon: RefreshCw, count: data?.stats.revisit_count ?? 0 },
  ];

  const currentNotes = data ? data[activeTab === 'revisit' ? 'to_revisit' : activeTab] : [];

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, backdropFilter: 'blur(4px)',
    }}>
      <div style={{
        background: 'var(--surface)',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--outline)',
        width: '90%', maxWidth: 660, maxHeight: '85vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--outline-variant)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <Sparkles size={18} style={{ color: 'var(--primary)' }} />
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem' }}>
              Weekly Digest
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--on-surface-dim)', marginTop: 1 }}>
              {data?.period ?? 'Last 7 days'} — your knowledge at a glance
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              marginLeft: 'auto', background: 'transparent', border: 'none',
              color: 'var(--on-surface-dim)', cursor: 'pointer', padding: 6,
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Stats Row */}
        {data && (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
            borderBottom: '1px solid var(--outline-variant)',
          }}>
            {[
              { label: 'Notes Captured', value: data.stats.captured_count, color: 'var(--primary)' },
              { label: 'Notes Connected', value: data.stats.connected_count, color: 'var(--secondary)' },
              { label: 'To Revisit', value: data.stats.revisit_count, color: 'var(--tertiary)' },
            ].map((stat) => (
              <div key={stat.label} style={{
                padding: '14px 16px', textAlign: 'center',
                borderRight: '1px solid var(--outline-variant)',
              }}>
                <div style={{
                  fontFamily: 'var(--font-display)', fontWeight: 800,
                  fontSize: '1.5rem', color: stat.color,
                }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--on-surface-dim)' }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div style={{
          display: 'flex', borderBottom: '1px solid var(--outline-variant)',
          padding: '0 24px',
        }}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '12px 16px', background: 'transparent', border: 'none',
                  borderBottom: active ? '2px solid var(--primary)' : '2px solid transparent',
                  color: active ? 'var(--primary)' : 'var(--on-surface-dim)',
                  fontSize: '0.8125rem', fontFamily: 'var(--font-display)', fontWeight: 600,
                  cursor: 'pointer', transition: 'color 200ms', marginBottom: -1,
                }}
              >
                <Icon size={14} />
                {tab.label}
                <span style={{
                  background: active ? 'var(--primary)' : 'var(--surface-container)',
                  color: active ? 'var(--on-primary)' : 'var(--on-surface-dim)',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.5625rem', padding: '1px 5px', fontWeight: 700,
                }}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Note List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--on-surface-dim)', fontSize: '0.875rem' }}>
              Loading your digest…
            </div>
          ) : currentNotes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--on-surface-dim)', fontSize: '0.875rem' }}>
              No notes in this category yet.
            </div>
          ) : (
            currentNotes.map((note) => (
              <div
                key={note.id}
                onClick={() => { navigate(`/notes/${note.id}`); onClose(); }}
                style={{
                  padding: '12px 16px',
                  background: 'var(--surface-container)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--outline-variant)',
                  cursor: 'pointer',
                  transition: 'all 200ms',
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--surface-container-high)';
                  e.currentTarget.style.borderColor = 'var(--outline)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'var(--surface-container)';
                  e.currentTarget.style.borderColor = 'var(--outline-variant)';
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontFamily: 'var(--font-display)', fontWeight: 600,
                    fontSize: '0.875rem', color: 'var(--on-surface)', marginBottom: 3,
                  }}>
                    {note.title}
                  </div>
                  <div style={{
                    fontSize: '0.75rem', color: 'var(--on-surface-dim)',
                    lineHeight: 1.4, overflow: 'hidden',
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any,
                  }}>
                    {note.snippet}
                  </div>
                </div>
                <ExternalLink size={12} style={{ color: 'var(--on-surface-dim)', flexShrink: 0, marginTop: 2 }} />
              </div>
            ))
          )}
        </div>

        {/* Footer: Synthesis CTA */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid var(--outline-variant)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <Sparkles size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: '0.8125rem', color: 'var(--on-surface-variant)' }}>
            {synthStatus === 'done'
              ? '✓ Synthesis queued — check Insights on your dashboard'
              : 'Let AI synthesize cross-note themes from this week'}
          </span>
          <button
            className="btn"
            onClick={runSynthesis}
            disabled={synthStatus !== 'idle'}
            style={{ fontSize: '0.75rem', padding: '6px 14px' }}
          >
            {synthStatus === 'running' ? 'Synthesizing…' : synthStatus === 'done' ? 'Done ✓' : 'Synthesize'}
          </button>
        </div>
      </div>
    </div>
  );
}
