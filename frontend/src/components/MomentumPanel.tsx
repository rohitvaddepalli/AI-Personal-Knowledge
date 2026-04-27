import { useState, useEffect, useCallback } from 'react';
import { Flame, X } from 'lucide-react';
import { apiUrl } from '../lib/api';

interface StreakData {
  current_streak: number;
  best_streak: number;
  daily_target_met: boolean;
  captured_today: number;
  reviewed_today: number;
  target_label: string;
}

interface Milestone {
  id: number;
  type: string;
  emoji: string;
  title: string;
  description: string;
  achieved_at: string;
}

export default function MomentumPanel() {
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [visibleMilestone, setVisibleMilestone] = useState<Milestone | null>(null);

  const load = useCallback(async () => {
    try {
      const [sRes, mRes] = await Promise.all([
        fetch(apiUrl('/api/momentum/streak')),
        fetch(apiUrl('/api/momentum/milestones')),
      ]);
      if (sRes.ok) setStreak(await sRes.json());
      if (mRes.ok) {
        const ms: Milestone[] = await mRes.json();
        setMilestones(ms);
        if (ms.length > 0) setVisibleMilestone(ms[0]);
      }
    } catch {/* ignore */}
  }, []);

  // Ping activity on mount
  useEffect(() => {
    fetch(apiUrl('/api/momentum/ping'), { method: 'POST' }).catch(() => {});
    load();
  }, [load]);

  const dismissMilestone = async (id: number) => {
    await fetch(apiUrl(`/api/momentum/milestones/${id}/seen`), { method: 'POST' });
    setVisibleMilestone(null);
    setMilestones((prev) => prev.filter((m) => m.id !== id));
  };

  if (!streak) return null;

  const flameColor = streak.current_streak >= 7
    ? '#ff6b35'
    : streak.current_streak >= 3
    ? '#ff9500'
    : streak.daily_target_met
    ? 'var(--primary)'
    : 'var(--on-surface-dim)';

  return (
    <>
      {/* ─── Milestone Toast ─── */}
      {visibleMilestone && (
        <div
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 1000,
            background: 'var(--surface-container-high)',
            border: '1px solid var(--outline)',
            borderRadius: 'var(--radius-xl)',
            padding: '16px 20px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            display: 'flex', alignItems: 'flex-start', gap: 14,
            maxWidth: 320,
            animation: 'slideUp 400ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          className="animate-fade-in"
        >
          <span style={{ fontSize: 28, lineHeight: 1 }}>{visibleMilestone.emoji}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: 'var(--font-display)', fontWeight: 700,
              fontSize: '0.9rem', color: 'var(--on-surface)', marginBottom: 4,
            }}>
              {visibleMilestone.title}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--on-surface-variant)', lineHeight: 1.4 }}>
              {visibleMilestone.description}
            </div>
          </div>
          <button
            onClick={() => dismissMilestone(visibleMilestone.id)}
            style={{
              background: 'transparent', border: 'none',
              color: 'var(--on-surface-dim)', cursor: 'pointer', padding: 4,
              borderRadius: 'var(--radius-sm)', flexShrink: 0,
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* ─── Streak Card ─── */}
      <div style={{
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--outline-variant)',
        background: 'var(--surface-container)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--outline-variant)',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Flame size={15} style={{ color: flameColor }} />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.8125rem' }}>
            Daily Momentum
          </span>
          {streak.daily_target_met && (
            <span style={{
              marginLeft: 'auto', fontSize: '0.625rem', fontFamily: 'var(--font-mono)',
              color: 'var(--secondary)', fontWeight: 700,
              background: 'var(--secondary-container)', padding: '2px 6px',
              borderRadius: 'var(--radius-full)',
            }}>
              ✓ Goal met
            </span>
          )}
        </div>

        {/* Body */}
        <div style={{ padding: '16px', display: 'flex', gap: 12 }}>
          {/* Flame count */}
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', minWidth: 72,
            background: streak.current_streak > 0 ? 'var(--primary-container)' : 'var(--surface-container-high)',
            borderRadius: 'var(--radius-lg)', padding: '12px 8px',
          }}>
            <Flame size={24} style={{ color: flameColor, marginBottom: 4 }} />
            <span style={{
              fontFamily: 'var(--font-display)', fontWeight: 800,
              fontSize: '1.5rem', color: flameColor, lineHeight: 1,
            }}>
              {streak.current_streak}
            </span>
            <span style={{ fontSize: '0.5625rem', color: 'var(--on-surface-dim)', marginTop: 2 }}>
              day streak
            </span>
          </div>

          {/* Stats */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: '0.6875rem', color: 'var(--on-surface-dim)', lineHeight: 1.4 }}>
              🎯 {streak.target_label}
            </div>

            {/* Progress dots for the week */}
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              {Array.from({ length: 7 }).map((_, i) => {
                const filled = i < Math.min(streak.current_streak, 7);
                const isToday = i === Math.min(streak.current_streak - 1, 6) && streak.daily_target_met;
                return (
                  <div
                    key={i}
                    title={`Day ${i + 1}`}
                    style={{
                      width: 8, height: 8, borderRadius: '50%',
                      background: filled
                        ? isToday ? flameColor : 'var(--primary)'
                        : 'var(--surface-container-high)',
                      transition: 'all 300ms',
                      boxShadow: isToday ? `0 0 6px ${flameColor}` : 'none',
                    }}
                  />
                );
              })}
              <span style={{ fontSize: '0.5625rem', color: 'var(--on-surface-dim)', marginLeft: 4 }}>
                /7d
              </span>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{
                flex: 1, padding: '6px 8px',
                background: 'var(--surface-container-high)',
                borderRadius: 'var(--radius-sm)', textAlign: 'center',
              }}>
                <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--on-surface)', fontFamily: 'var(--font-display)' }}>
                  {streak.captured_today}
                </div>
                <div style={{ fontSize: '0.5625rem', color: 'var(--on-surface-dim)' }}>captured</div>
              </div>
              <div style={{
                flex: 1, padding: '6px 8px',
                background: 'var(--surface-container-high)',
                borderRadius: 'var(--radius-sm)', textAlign: 'center',
              }}>
                <div style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--on-surface)', fontFamily: 'var(--font-display)' }}>
                  {streak.reviewed_today}
                </div>
                <div style={{ fontSize: '0.5625rem', color: 'var(--on-surface-dim)' }}>reviewed</div>
              </div>
              <div style={{
                flex: 1, padding: '6px 8px',
                background: 'var(--surface-container-high)',
                borderRadius: 'var(--radius-sm)', textAlign: 'center',
              }}>
                <div style={{
                  fontSize: '0.9375rem', fontWeight: 700, fontFamily: 'var(--font-display)',
                  color: streak.best_streak > 0 ? '#ff9500' : 'var(--on-surface)',
                }}>
                  {streak.best_streak}
                </div>
                <div style={{ fontSize: '0.5625rem', color: 'var(--on-surface-dim)' }}>best</div>
              </div>
            </div>
          </div>
        </div>

        {/* Milestone chips */}
        {milestones.length > 0 && (
          <div style={{
            borderTop: '1px solid var(--outline-variant)',
            padding: '8px 16px',
            display: 'flex', gap: 6, overflowX: 'auto',
          }}>
            {milestones.map((m) => (
              <div
                key={m.id}
                onClick={() => setVisibleMilestone(m)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  background: 'var(--tertiary-container)',
                  borderRadius: 'var(--radius-full)',
                  padding: '3px 10px', cursor: 'pointer', flexShrink: 0,
                  fontSize: '0.625rem', color: 'var(--on-surface)',
                  fontFamily: 'var(--font-display)', fontWeight: 600,
                }}
              >
                <span>{m.emoji}</span>
                {m.title}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
