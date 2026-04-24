import { useMemo, useState } from 'react';
import { Activity, Cpu, MemoryStick, MinusCircle, PauseCircle } from 'lucide-react';
import { useDesktopRuntime } from '../context/DesktopRuntimeContext';

const cornerStyles: Record<string, React.CSSProperties> = {
  'top-left': { top: 16, left: 16 },
  'top-right': { top: 16, right: 16 },
  'bottom-left': { bottom: 16, left: 16 },
  'bottom-right': { bottom: 16, right: 16 },
};

export default function ResourceMonitorWidget() {
  const { status, saveSystemSettings } = useDesktopRuntime();
  const [expanded, setExpanded] = useState(false);
  const runtime = status?.runtime;
  const metrics = status?.metrics;

  const warningTone = useMemo(() => {
    if (!metrics) return 'var(--secondary)';
    if (metrics.warnings.cpu === 'high' || metrics.warnings.ram === 'high') return 'var(--error)';
    if (metrics.warnings.cpu === 'warn' || metrics.warnings.ram === 'warn') return 'var(--tertiary)';
    return 'var(--secondary)';
  }, [metrics]);

  if (!runtime?.resource_monitor_enabled || !metrics) return null;

  const compact = (
    <>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Cpu size={12} /> {metrics.cpuPercent}%</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><MemoryStick size={12} /> {metrics.ramPercent}%</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Activity size={12} /> {metrics.activeProvider}:{metrics.activeModel}</span>
    </>
  );

  return (
    <div
      style={{
        position: 'fixed',
        zIndex: 60,
        ...cornerStyles[runtime.resource_monitor_corner || 'bottom-right'],
      }}
    >
      <button
        onClick={() => setExpanded((value) => !value)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '10px 14px',
          borderRadius: expanded ? '18px 18px 6px 6px' : 999,
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
        {compact}
      </button>

      {expanded && (
        <div
          style={{
            width: 340,
            padding: 14,
            borderRadius: '0 0 18px 18px',
            border: '1px solid var(--outline)',
            borderTop: 'none',
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
