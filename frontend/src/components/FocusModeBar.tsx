import { useState, useEffect } from 'react';
import { PenTool, BookOpen, RefreshCw, Search, X, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiUrl } from '../lib/api';

interface FocusPreset {
  id: string;
  label: string;
  description: string;
  icon: string;
  sidebar_collapsed: boolean;
  reduced_animations: boolean;
  default_view: string;
  hide_sections: string[];
}

const ICON_MAP: Record<string, React.FC<any>> = {
  PenTool,
  BookOpen,
  RefreshCw,
  Search,
};

interface FocusModeBarProps {
  onPresetApply?: (preset: FocusPreset) => void;
}

export default function FocusModeBar({ onPresetApply }: FocusModeBarProps) {
  const navigate = useNavigate();
  const [presets, setPresets] = useState<FocusPreset[]>([]);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch(apiUrl('/api/personalization/focus-presets'))
      .then((r) => r.json())
      .then(setPresets)
      .catch(console.error);

    // Restore saved preset
    const saved = localStorage.getItem('focus_mode');
    if (saved) setActivePreset(saved);
  }, []);

  const applyPreset = async (preset: FocusPreset) => {
    setActivePreset(preset.id);
    localStorage.setItem('focus_mode', preset.id);
    setOpen(false);

    // Save to backend
    await fetch(apiUrl('/api/personalization/preferences/focus_mode'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: preset.id }),
    }).catch(() => {});

    onPresetApply?.(preset);
    navigate(preset.default_view);
  };

  const clearPreset = async () => {
    setActivePreset(null);
    localStorage.removeItem('focus_mode');
    await fetch(apiUrl('/api/personalization/preferences/focus_mode'), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ value: null }),
    }).catch(() => {});
  };

  const current = presets.find((p) => p.id === activePreset);
  const CurrentIcon = current ? (ICON_MAP[current.icon] ?? PenTool) : null;

  return (
    <div style={{ position: 'relative' }}>
      {/* Trigger */}
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 12px',
          background: activePreset ? 'var(--primary-container)' : 'var(--surface-container)',
          border: `1px solid ${activePreset ? 'var(--primary)' : 'var(--outline-variant)'}`,
          borderRadius: 'var(--radius-full)',
          color: activePreset ? 'var(--primary)' : 'var(--on-surface-variant)',
          fontSize: '0.75rem', fontFamily: 'var(--font-display)', fontWeight: 600,
          cursor: 'pointer', transition: 'all 200ms',
        }}
      >
        {CurrentIcon && <CurrentIcon size={12} />}
        {current ? current.label : 'Focus Mode'}
        <ChevronDown size={11} style={{ opacity: 0.6 }} />
      </button>

      {/* Clear active preset */}
      {activePreset && (
        <button
          onClick={clearPreset}
          title="Exit focus mode"
          style={{
            position: 'absolute', top: -4, right: -4,
            width: 16, height: 16,
            background: 'var(--error)', border: 'none', borderRadius: '50%',
            color: '#fff', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, lineHeight: 1,
          }}
        >
          <X size={9} />
        </button>
      )}

      {/* Dropdown */}
      {open && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 8px)', right: 0,
            background: 'var(--surface)',
            border: '1px solid var(--outline)',
            borderRadius: 'var(--radius-xl)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            minWidth: 240, zIndex: 500,
            overflow: 'hidden',
          }}
        >
          <div style={{
            padding: '10px 14px',
            fontSize: '0.625rem', color: 'var(--on-surface-dim)',
            fontFamily: 'var(--font-mono)', fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.08em',
            borderBottom: '1px solid var(--outline-variant)',
          }}>
            Select Focus Preset
          </div>
          {presets.map((preset) => {
            const Icon = ICON_MAP[preset.icon] ?? PenTool;
            const isActive = preset.id === activePreset;
            return (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '12px 14px', width: '100%',
                  background: isActive ? 'var(--primary-container)' : 'transparent',
                  border: 'none', cursor: 'pointer',
                  borderBottom: '1px solid var(--outline-variant)',
                  textAlign: 'left', transition: 'background 200ms',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'var(--surface-container)';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.background = 'transparent';
                }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: 'var(--radius-md)',
                  background: isActive ? 'var(--primary)' : 'var(--surface-container-high)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Icon size={14} style={{ color: isActive ? 'var(--on-primary)' : 'var(--on-surface-dim)' }} />
                </div>
                <div>
                  <div style={{
                    fontFamily: 'var(--font-display)', fontWeight: 600,
                    fontSize: '0.8125rem', color: 'var(--on-surface)', marginBottom: 2,
                  }}>
                    {preset.label}
                    {isActive && (
                      <span style={{
                        marginLeft: 6, fontSize: '0.5625rem',
                        color: 'var(--primary)', fontWeight: 700,
                      }}>
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--on-surface-dim)', lineHeight: 1.4 }}>
                    {preset.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Backdrop */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 499 }}
        />
      )}
    </div>
  );
}
