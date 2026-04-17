import { useState, useEffect } from 'react';
import { useDesktopRuntime } from '../context/DesktopRuntimeContext';
import { useDownload } from '../context/DownloadContext';
import { apiUrl } from '../lib/api';
import { Download, Trash2, Save, ServerCog, User, Palette, Shield, Keyboard, Package } from 'lucide-react';

export default function Settings() {
  const [profileName, setProfileName] = useState(() => localStorage.getItem('profileName') || 'User');
  const [profileBio, setProfileBio] = useState(() => localStorage.getItem('profileBio') || '');
  const [activeModel, setActiveModel] = useState(() => localStorage.getItem('activeModel') || 'qwen2.5:0.5b');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [ollamaHost, setOllamaHost] = useState('http://localhost:11434');
  const [systemSaving, setSystemSaving] = useState(false);
  const [telemetryEnabled, setTelemetryEnabled] = useState(() => localStorage.getItem('telemetry_enabled') === '1');
  const [reduceMotion, setReduceMotion] = useState(() => localStorage.getItem('reduce_motion') === '1');
  const [fontSize, setFontSize] = useState(() => Number(localStorage.getItem('fontSize')) || 16);
  
  const [modelName, setModelName] = useState('llama3');
  const { pulling, pullResult, pullModel } = useDownload();
  const { saveSystemSettings, status } = useDesktopRuntime();

  const fetchModels = () => {
    fetch('http://localhost:8000/api/ask/models')
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setAvailableModels(data); })
      .catch(console.error);
  };

  useEffect(() => { fetchModels(); }, [pulling]);

  useEffect(() => {
    if (status?.ollamaBaseUrl) setOllamaHost(status.ollamaBaseUrl);
  }, [status?.ollamaBaseUrl]);

  const saveSettings = () => {
    localStorage.setItem('profileName', profileName);
    localStorage.setItem('profileBio', profileBio);
    localStorage.setItem('activeModel', activeModel);
    localStorage.setItem('fontSize', String(fontSize));
    alert('Settings saved!');
  };

  const handleFontSizeChange = (val: number) => {
    setFontSize(val);
    document.documentElement.style.fontSize = `${val}px`;
    localStorage.setItem('fontSize', String(val));
    window.dispatchEvent(new Event('storage'));
  };

  const handleDeleteModel = async (name: string) => {
    if (!confirm(`Delete model ${name}?`)) return;
    try {
      const res = await fetch(`http://localhost:8000/api/ask/models/${name}`, { method: 'DELETE' });
      if (res.ok) { alert('Model deleted'); fetchModels(); }
      else { const error = await res.json(); alert(`Error: ${error.detail}`); }
    } catch (e: any) { alert(`Error: ${e.message}`); }
  };

  const handleSaveSystemSettings = async () => {
    setSystemSaving(true);
    try { await saveSystemSettings({ ollamaBaseUrl: ollamaHost }); fetchModels(); }
    catch (e: any) { alert(`Error: ${e.message}`); }
    finally { setSystemSaving(false); }
  };

  const SectionHeader = ({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
      <div style={{
        width: 36, height: 36, borderRadius: 'var(--radius-md)', flexShrink: 0,
        background: 'var(--surface-container-high)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--primary)',
      }}>
        {icon}
      </div>
      <div>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', marginBottom: 2 }}>{title}</h2>
        <p style={{ fontSize: '0.8125rem', color: 'var(--on-surface-dim)', margin: 0 }}>{desc}</p>
      </div>
    </div>
  );

  const ToggleSwitch = ({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) => (
    <div
      onClick={() => onChange(!checked)}
      style={{
        width: 40, height: 22, borderRadius: 11, cursor: 'pointer', flexShrink: 0,
        background: checked ? 'var(--primary)' : 'var(--surface-container-highest)',
        padding: 2, transition: 'background 200ms',
      }}
    >
      <div style={{
        width: 18, height: 18, borderRadius: '50%', background: 'white',
        marginLeft: checked ? 18 : 0, transition: 'margin 200ms cubic-bezier(0.16, 1, 0.3, 1)',
      }} />
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, height: '100%', overflowY: 'auto' }}>
      <h1 style={{ fontFamily: 'var(--font-display)' }}>Settings</h1>

      {/* ═══ Profile & AI Model ═══ */}
      <div style={{ padding: 24, borderRadius: 'var(--radius-lg)', background: 'var(--surface-container)' }}>
        <SectionHeader icon={<User size={18} />} title="Profile & AI Model" desc="Personalize how Second Brain interacts with you." />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <span className="label-sm" style={{ marginBottom: 6, display: 'block' }}>Active AI Model</span>
            <p style={{ fontSize: '0.75rem', color: 'var(--on-surface-dim)', margin: '0 0 6px' }}>
              Used for all generation, tagging, and summarization.
            </p>
            <select className="input" value={activeModel} onChange={e => setActiveModel(e.target.value)}
              style={{ borderRadius: 'var(--radius-full)' }}>
              {availableModels.length === 0 && <option value={activeModel}>{activeModel}</option>}
              {availableModels.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>

          <div>
            <span className="label-sm" style={{ marginBottom: 6, display: 'block' }}>Name</span>
            <input className="input" value={profileName} onChange={e => setProfileName(e.target.value)} placeholder="Your Name" />
          </div>

          <div>
            <span className="label-sm" style={{ marginBottom: 6, display: 'block' }}>Bio / Context / Writing Style</span>
            <textarea
              className="input" rows={3} value={profileBio} onChange={e => setProfileBio(e.target.value)}
              placeholder="E.g. I am a software engineer building AI products. Prefer concise, technical responses."
              style={{ resize: 'vertical' }}
            />
          </div>

          <button className="btn" onClick={saveSettings} style={{ alignSelf: 'flex-start' }}>
            <Save size={14} /> Save Settings
          </button>
        </div>
      </div>

      {/* ═══ Desktop Runtime ═══ */}
      <div style={{ padding: 24, borderRadius: 'var(--radius-lg)', background: 'var(--surface-container)' }}>
        <SectionHeader icon={<ServerCog size={18} />} title="Desktop Runtime" desc="Configure how the bundled backend reaches Ollama." />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <span className="label-sm" style={{ marginBottom: 6, display: 'block' }}>Ollama Host</span>
            <input className="input" value={ollamaHost} onChange={e => setOllamaHost(e.target.value)} placeholder="http://localhost:11434" />
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontSize: '0.8125rem',
            color: status?.ollamaReachable ? 'var(--secondary)' : 'var(--error)',
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: status?.ollamaReachable ? 'var(--secondary)' : 'var(--error)',
            }} />
            {status?.ollamaReachable ? 'Ollama is reachable.' : 'Ollama is not reachable.'}
          </div>

          <button className="btn" onClick={handleSaveSystemSettings} disabled={systemSaving} style={{ alignSelf: 'flex-start' }}>
            {systemSaving ? 'Saving...' : 'Save Ollama Host'}
          </button>
        </div>
      </div>

      {/* ═══ AI Models ═══ */}
      <div style={{ padding: 24, borderRadius: 'var(--radius-lg)', background: 'var(--surface-container)' }}>
        <SectionHeader icon={<Package size={18} />} title="AI Models (Ollama)" desc="Manage and download local AI models." />

        {/* Installed models */}
        <span className="label-sm" style={{ marginBottom: 8, display: 'block' }}>Installed Models</span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 20 }}>
          {availableModels.length === 0 && (
            <p style={{ fontSize: '0.8125rem', color: 'var(--on-surface-dim)' }}>No models found.</p>
          )}
          {availableModels.map(m => (
            <div key={m} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 14px', borderRadius: 'var(--radius-md)',
              background: 'var(--surface-container-low)',
            }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', fontWeight: 500 }}>{m}</span>
              <button
                onClick={() => handleDeleteModel(m)}
                style={{
                  background: 'var(--error-container)', border: 'none',
                  color: 'var(--error)', cursor: 'pointer',
                  padding: '4px 10px', borderRadius: 'var(--radius-sm)',
                  fontSize: '0.6875rem', fontWeight: 600,
                  fontFamily: 'var(--font-display)',
                  transition: 'all 200ms',
                }}
              >
                <Trash2 size={11} style={{ marginRight: 4 }} />
                Delete
              </button>
            </div>
          ))}
        </div>

        {/* Download new */}
        <span className="label-sm" style={{ marginBottom: 6, display: 'block' }}>Download New Model</span>
        <p style={{ fontSize: '0.75rem', color: 'var(--on-surface-dim)', margin: '0 0 8px' }}>
          Enter an Ollama model name (e.g. <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--primary)' }}>qwen2.5:0.5b</span>,{' '}
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--primary)' }}>llama3</span>).
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input className="input" style={{ flex: 1 }} value={modelName} onChange={e => setModelName(e.target.value)} placeholder="e.g. mxbai-embed-large" />
          <button className="btn" onClick={() => pullModel(modelName)} disabled={pulling}>
            <Download size={14} /> {pulling ? 'Downloading...' : 'Download'}
          </button>
        </div>
        {pullResult && !pulling && (
          <p style={{
            marginTop: 8, fontSize: '0.8125rem',
            color: pullResult.includes('Error') ? 'var(--error)' : 'var(--secondary)',
          }}>
            {pullResult}
          </p>
        )}
      </div>

      {/* ═══ Export & Backup ═══ */}
      <div style={{ padding: 24, borderRadius: 'var(--radius-lg)', background: 'var(--surface-container)' }}>
        <SectionHeader icon={<Download size={18} />} title="Export & Backup" desc="Export your notes for backup or portability." />

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <a href={apiUrl('/api/export/all/zip')} className="btn" style={{ textDecoration: 'none' }}>
            Export All (ZIP)
          </a>
          <a href={apiUrl('/api/export/vault/obsidian')} className="btn-secondary" style={{ textDecoration: 'none' }}>
            Obsidian Vault
          </a>
        </div>
      </div>

      {/* ═══ Privacy ═══ */}
      <div style={{ padding: 24, borderRadius: 'var(--radius-lg)', background: 'var(--surface-container)' }}>
        <SectionHeader icon={<Shield size={18} />} title="Privacy & Telemetry" desc="Second Brain is local-first. Telemetry is strictly opt-in." />

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: 16, borderRadius: 'var(--radius-md)',
          background: 'var(--surface-container-low)',
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, marginBottom: 4, fontSize: '0.875rem' }}>
              Anonymous Usage Analytics
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--on-surface-dim)' }}>
              Opt-in to share anonymous feature usage stats.
            </div>
          </div>
          <ToggleSwitch
            checked={telemetryEnabled}
            onChange={v => { setTelemetryEnabled(v); localStorage.setItem('telemetry_enabled', v ? '1' : '0'); }}
          />
        </div>

        {telemetryEnabled && (
          <div style={{
            marginTop: 10, fontSize: '0.75rem', color: 'var(--secondary)',
            padding: '8px 12px', borderRadius: 'var(--radius-sm)',
            background: 'var(--secondary-dim)',
          }}>
            ✓ Anonymous analytics are enabled. You can opt out at any time.
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <span style={{ fontWeight: 500, fontSize: '0.8125rem', marginBottom: 6, display: 'block' }}>What is never collected:</span>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.75rem', color: 'var(--on-surface-dim)', lineHeight: 1.8 }}>
            <li>Note content, titles, or metadata</li>
            <li>Personal identifiers (name, email, IP addresses)</li>
            <li>API keys or Ollama model names</li>
          </ul>
        </div>
      </div>

      {/* ═══ Appearance ═══ */}
      <div style={{ padding: 24, borderRadius: 'var(--radius-lg)', background: 'var(--surface-container)' }}>
        <SectionHeader icon={<Palette size={18} />} title="Appearance & Platform" desc="Fine-tune how the app looks and behaves." />

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Reduce Motion */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: 12, borderRadius: 'var(--radius-md)',
            background: 'var(--surface-container-low)',
          }}>
            <div>
              <div style={{ fontWeight: 500, fontSize: '0.875rem', marginBottom: 2 }}>Reduce Motion</div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--on-surface-dim)' }}>Disable animations for accessibility</div>
            </div>
            <ToggleSwitch
              checked={reduceMotion}
              onChange={v => {
                setReduceMotion(v);
                localStorage.setItem('reduce_motion', v ? '1' : '0');
                document.documentElement.setAttribute('data-reduce-motion', String(v));
              }}
            />
          </div>

          {/* Font Size */}
          <div style={{
            padding: 12, borderRadius: 'var(--radius-md)',
            background: 'var(--surface-container-low)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>Base Font Size</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--on-surface-dim)', fontFamily: 'var(--font-mono)' }}>{fontSize}px</span>
            </div>
            <input
              type="range" min={13} max={20} value={fontSize}
              onChange={e => handleFontSizeChange(parseInt(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--primary)' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.625rem', color: 'var(--on-surface-dim)', marginTop: 4 }}>
              <span>13px</span><span>20px</span>
            </div>
          </div>

          {/* Keyboard Shortcuts */}
          <div style={{
            padding: 12, borderRadius: 'var(--radius-md)',
            background: 'var(--surface-container-low)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
              <Keyboard size={14} style={{ color: 'var(--on-surface-dim)' }} />
              <span style={{ fontWeight: 500, fontSize: '0.875rem' }}>Keyboard Shortcuts</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {[['Ctrl+K', 'Open notes'], ['Ctrl+N', 'New note'], ['Esc', 'Close modal'], ['Ctrl+S', 'Save']].map(([k, d]) => (
                <div key={k} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '6px 10px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--surface-container)',
                }}>
                  <code style={{ fontSize: '0.6875rem', color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>{k}</code>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--on-surface-dim)' }}>{d}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
