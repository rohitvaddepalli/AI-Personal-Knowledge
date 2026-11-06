import { useEffect, useState } from 'react';
import { BarChart2, Tag, Globe, BookOpen, Zap, TrendingUp, Clock } from 'lucide-react';
import { apiUrl } from '../lib/api';

interface Overview {
  total_notes: number;
  total_words: number;
  avg_words_per_note: number;
  recent_notes_7d: number;
  unique_tags: number;
  pinned_notes: number;
  public_notes: number;
  source_breakdown: Record<string, number>;
}

interface DayCount {
  date: string;
  count: number;
}

interface TagCount {
  tag: string;
  count: number;
}

interface StaleNote {
  id: string;
  title: string;
  days_idle: number;
  tags: string[];
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
  return (
    <div style={{
      padding: '20px 24px',
      borderRadius: 'var(--radius-xl)',
      background: 'var(--surface-container)',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--primary)' }}>
        {icon}
        <span style={{ fontSize: '0.8rem', color: 'var(--on-surface-dim)', fontWeight: 600 }}>{label}</span>
      </div>
      <div style={{ fontSize: '2rem', fontFamily: 'var(--font-display)', fontWeight: 800, lineHeight: 1 }}>
        {value.toLocaleString()}
      </div>
      {sub && <div style={{ fontSize: '0.75rem', color: 'var(--on-surface-dim)' }}>{sub}</div>}
    </div>
  );
}

function MiniBar({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: '0.75rem', width: 100, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 8, borderRadius: 99, background: 'var(--surface-container-high)', overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--primary)', borderRadius: 99, transition: 'width 600ms ease' }} />
      </div>
      <span style={{ fontSize: '0.7rem', color: 'var(--on-surface-dim)', width: 28, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function SparkLine({ data }: { data: DayCount[] }) {
  if (!data.length) return null;
  const maxVal = Math.max(...data.map((d) => d.count), 1);
  const w = 300;
  const h = 60;
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - (d.count / maxVal) * h;
    return `${x},${y}`;
  });
  return (
    <svg width={w} height={h} style={{ overflow: 'visible' }}>
      <polyline points={pts.join(' ')} fill="none" stroke="var(--primary)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) =>
        d.count > 0 ? (
          <circle key={d.date} cx={(i / (data.length - 1)) * w} cy={h - (d.count / maxVal) * h} r={3} fill="var(--primary)" />
        ) : null
      )}
    </svg>
  );
}

export default function AnalyticsPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [notesPerDay, setNotesPerDay] = useState<DayCount[]>([]);
  const [topTags, setTopTags] = useState<TagCount[]>([]);
  const [stale, setStale] = useState<StaleNote[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [ov, npd, tt, st] = await Promise.all([
          fetch(apiUrl('/api/analytics/overview')).then((r) => r.json()),
          fetch(apiUrl('/api/analytics/notes-per-day?days=30')).then((r) => r.json()),
          fetch(apiUrl('/api/analytics/top-tags?limit=15')).then((r) => r.json()),
          fetch(apiUrl('/api/analytics/stale-notes?idle_days=30&limit=10')).then((r) => r.json()),
        ]);
        setOverview(ov);
        setNotesPerDay(npd);
        setTopTags(tt);
        setStale(st);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
        <span style={{ color: 'var(--on-surface-dim)' }}>Loading analytics…</span>
      </div>
    );
  }

  const topTagMax = topTags[0]?.count ?? 1;
  const sourceEntries = overview ? Object.entries(overview.source_breakdown) : [];
  const sourceMax = Math.max(...sourceEntries.map(([, v]) => v), 1);

  return (
    <div style={{ display: 'grid', gap: 24, maxWidth: 900 }}>
      <header>
        <h1 style={{ fontFamily: 'var(--font-display)', marginBottom: 4 }}>Analytics</h1>
        <p style={{ color: 'var(--on-surface-dim)', margin: 0 }}>Insights into your knowledge base activity.</p>
      </header>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <StatCard icon={<BookOpen size={18} />} label="Total Notes" value={overview?.total_notes ?? 0} />
        <StatCard icon={<TrendingUp size={18} />} label="Total Words" value={overview?.total_words ?? 0} sub={`≈ ${overview?.avg_words_per_note ?? 0} per note`} />
        <StatCard icon={<Zap size={18} />} label="Last 7 Days" value={overview?.recent_notes_7d ?? 0} sub="new notes" />
        <StatCard icon={<Tag size={18} />} label="Unique Tags" value={overview?.unique_tags ?? 0} />
        <StatCard icon={<Globe size={18} />} label="Public Notes" value={overview?.public_notes ?? 0} sub="in garden" />
      </div>

      {/* Activity Sparkline */}
      <section style={{ padding: 20, borderRadius: 'var(--radius-xl)', background: 'var(--surface-container)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', margin: 0 }}>Note Creation — Last 30 Days</h2>
          <BarChart2 size={18} style={{ color: 'var(--on-surface-dim)' }} />
        </div>
        <SparkLine data={notesPerDay} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--on-surface-dim)', marginTop: 4 }}>
          <span>{notesPerDay[0]?.date}</span>
          <span>{notesPerDay[notesPerDay.length - 1]?.date}</span>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
        {/* Top Tags */}
        <section style={{ padding: 20, borderRadius: 'var(--radius-xl)', background: 'var(--surface-container)', display: 'grid', gap: 10 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', margin: 0, marginBottom: 8 }}>Top Tags</h2>
          {topTags.length === 0 && <span style={{ color: 'var(--on-surface-dim)', fontSize: '0.85rem' }}>No tags yet.</span>}
          {topTags.map((t) => (
            <MiniBar key={t.tag} label={t.tag} value={t.count} max={topTagMax} />
          ))}
        </section>

        {/* Source Breakdown */}
        <section style={{ padding: 20, borderRadius: 'var(--radius-xl)', background: 'var(--surface-container)', display: 'grid', gap: 10 }}>
          <h2 style={{ fontFamily: 'var(--font-display)', margin: 0, marginBottom: 8 }}>Ingestion Sources</h2>
          {sourceEntries.length === 0 && <span style={{ color: 'var(--on-surface-dim)', fontSize: '0.85rem' }}>No sources yet.</span>}
          {sourceEntries.map(([src, cnt]) => (
            <MiniBar key={src} label={src || 'manual'} value={cnt} max={sourceMax} />
          ))}
        </section>
      </div>

      {/* Stale Notes */}
      {stale.length > 0 && (
        <section style={{ padding: 20, borderRadius: 'var(--radius-xl)', background: 'var(--surface-container)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <Clock size={18} style={{ color: 'var(--on-surface-dim)' }} />
            <h2 style={{ fontFamily: 'var(--font-display)', margin: 0 }}>Forgotten Notes (30+ days idle)</h2>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {stale.map((note) => (
              <a
                key={note.id}
                href={`/notes/${note.id}`}
                style={{
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--surface-container-high)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  textDecoration: 'none',
                  color: 'inherit',
                }}
              >
                <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>{note.title}</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--on-surface-dim)' }}>{note.days_idle}d ago</span>
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

