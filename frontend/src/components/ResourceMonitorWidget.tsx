import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { Activity, Cpu, MemoryStick, MinusCircle, PauseCircle } from 'lucide-react';
import { useDesktopRuntime } from '../context/DesktopRuntimeContext';

const STORAGE_KEY = 'sb_monitor_pos';

function loadPos(): { x: number; y: number } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return null;
}

export default function ResourceMonitorWidget() {
  const { status, saveSystemSettings } = useDesktopRuntime();
  const [expanded, setExpanded] = useState(false);
  const runtime = status?.runtime;
  const metrics = status?.metrics;

  // ── Drag state ────────────────────────────────────────────────────────────
  const defaultPos = { x: window.innerWidth - 300, y: window.innerHeight - 80 };
  const [pos, setPos] = useState<{ x: number; y: number }>(() => loadPos() ?? defaultPos);
  const dragRef = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);
  const widgetRef = useRef<HTMLDivElement>(null);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLSpanElement>) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, originX: pos.x, originY: pos.y };
  }, [pos]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLSpanElement>) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    const el = widgetRef.current;
    const maxX = el ? window.innerWidth - el.offsetWidth : window.innerWidth - 280;
    const maxY = el ? window.innerHeight - el.offsetHeight : window.innerHeight - 60;
    setPos({
      x: Math.max(0, Math.min(maxX, dragRef.current.originX + dx)),
      y: Math.max(0, Math.min(maxY, dragRef.current.originY + dy)),
    });
  }, []);

  const onPointerUp = useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setPos(prev => { localStorage.setItem(STORAGE_KEY, JSON.stringify(prev)); return prev; });
  }, []);

  // Save on unmount
  useEffect(() => () => { localStorage.setItem(STORAGE_KEY, JSON.stringify(pos)); }, [pos]);

  const warningTone = useMemo(() => {
    if (!metrics) return 'var(--secondary)';
    if (metrics.warnings.cpu === 'high' || metrics.warnings.ram === 'high') return 'var(--error)';
    if (metrics.warnings.cpu === 'warn' || metrics.warnings.ram === 'warn') return 'var(--tertiary)';
    return 'var(--secondary)';
  }, [metrics]);

  if (!runtime?.resource_monitor_enabled || !metrics) return null;

  const expandUp = pos.y > window.innerHeight / 2;

  const compact = (
    <>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Cpu size={12} /> {metrics.cpuPercent}%</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><MemoryStick size={12} /> {metrics.ramPercent}%</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Activity size={12} /> {metrics.activeProvider}:{metrics.activeModel}</span>
    </>
  );

  return (
    <div
      ref={widgetRef}
      style={{ position: 'fixed', zIndex: 60, left: pos.x, top: pos.y }}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 14px',
          borderRadius: expanded ? (expandUp ? '6px 6px 18px 18px' : '18px 18px 6px 6px') : 999,
          border: `1px solid ${warningTone}`,
          background: 'rgba(10, 12, 18, 0.92)',
          color: '#f7f8fb',
          backdropFilter: 'blur(10px)',
          boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
          fontSize: '0.7rem',
          fontFamily: 'var(--font-mono)',
          cursor: 'pointer',
          minWidth: expanded ? 340 : 260,
        }}
      >
        {/* Drag handle */}
        <span
          title="Drag to move"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onClick={(e) => e.stopPropagation()}
          style={{
            cursor: 'grab',
            fontSize: '1rem',
            lineHeight: 1,
            color: 'rgba(255,255,255,0.4)',
            userSelect: 'none',
            flexShrink: 0,
            paddingRight: 2,
          }}
        >
          ⠿
        </span>
        {compact}
      </button>

      {expanded && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            ...(expandUp
              ? { bottom: '100%', borderBottom: 'none', borderRadius: '18px 18px 6px 6px' }
              : { top: '100%', borderTop: 'none', borderRadius: '0 0 18px 18px' }),
            width: 340,
            padding: 14,
            border: '1px solid var(--outline)',
            background: 'rgba(15, 18, 26, 0.96)',
            color: '#f7f8fb',
            display: 'grid',
            gap: 12,
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Metric label="CPU" value={`${metrics.cpuPercent}%`} history={metrics.cpuHistory} tone={metrics.warnings.cpu} />
            <Metric label="RAM" value={`${metrics.ramPercent}%`} history={metrics.ramHistory} tone={metrics.warnings.ram} />
          </div>

          <div style={{ fontSize: '0.72rem', display: 'grid', gap: 6 }}>
            <div>Queue depth: {metrics.queueDepth}</div>
            <div>Process memory: {metrics.processMemoryMb.toFixed(1)} MB</div>
            <div>Active model: {metrics.activeProvider}:{metrics.activeModel}</div>
            <div>Recent heavy ops: {metrics.activeTasks.length === 0 ? 'None' : metrics.activeTasks.map((task) => `${task.job_type} (${task.status})`).join(', ')}</div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn-secondary" onClick={() => saveSystemSettings({ low_resource_mode: true, battery_saver_mode: true })}>
              <PauseCircle size={13} /> Low Resource
            </button>
            <button className="btn-secondary" onClick={() => saveSystemSettings({ max_ai_concurrency: 1, ai_context_window: 2048 })}>
              <MinusCircle size={13} /> Throttle AI
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, history, tone }: { label: string; value: string; history: number[]; tone: string }) {
  const stroke = tone === 'high' ? '#ff7272' : tone === 'warn' ? '#e9b44c' : '#4fd1a5';
  const points = history.map((entry, index) => `${index * 10},${40 - Math.min(40, entry / 2.5)}`).join(' ');
  return (
    <div style={{ padding: 10, borderRadius: 12, background: 'rgba(255,255,255,0.04)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: '0.68rem' }}>
        <span>{label}</span>
        <span style={{ color: stroke }}>{value}</span>
      </div>
      <svg width="100%" height="40" viewBox="0 0 190 40" preserveAspectRatio="none">
        <polyline fill="none" stroke={stroke} strokeWidth="2" points={points || '0,38 190,38'} />
      </svg>
    </div>
  );
}
