import { useState, useEffect } from 'react';
import { useDesktopRuntime } from '../context/DesktopRuntimeContext';
import { useDownload } from '../context/DownloadContext';
import { apiUrl } from '../lib/api';

export default function Settings() {
  const [profileName, setProfileName] = useState(() => localStorage.getItem('profileName') || 'User');
  const [profileBio, setProfileBio] = useState(() => localStorage.getItem('profileBio') || '');
  const [activeModel, setActiveModel] = useState(() => localStorage.getItem('activeModel') || 'qwen2.5:0.5b');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [ollamaHost, setOllamaHost] = useState('http://localhost:11434');
  const [systemSaving, setSystemSaving] = useState(false);
  const [telemetryEnabled, setTelemetryEnabled] = useState(() => localStorage.getItem('telemetry_enabled') === '1');
  const [reduceMotion, setReduceMotion] = useState(() => localStorage.getItem('reduce_motion') === '1');
  const [fontSize, setFontSize] = useState(() => parseInt(localStorage.getItem('font_size') || '15'));
  
  const [modelName, setModelName] = useState('llama3');
  const { pulling, pullResult, pullModel } = useDownload();
  const { saveSystemSettings, status } = useDesktopRuntime();

  const fetchModels = () => {
    fetch('http://localhost:8000/api/ask/models')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) setAvailableModels(data);
      })
      .catch(console.error);
  };

  useEffect(() => {
    fetchModels();
  }, [pulling]);

  useEffect(() => {
    if (status?.ollamaBaseUrl) {
      setOllamaHost(status.ollamaBaseUrl);
    }
  }, [status?.ollamaBaseUrl]);

  const [fontSize, setFontSizeState] = useState(() => Number(localStorage.getItem('fontSize')) || 16);

  const saveSettings = () => {
    localStorage.setItem('profileName', profileName);
    localStorage.setItem('profileBio', profileBio);
    localStorage.setItem('activeModel', activeModel);
    localStorage.setItem('fontSize', String(fontSize));
    alert('Settings saved globally!');
  };

  const handleFontSizeChange = (val: number) => {
    setFontSizeState(val);
    document.documentElement.style.fontSize = `${val}px`;
    localStorage.setItem('fontSize', String(val));
    window.dispatchEvent(new Event('storage'));
  };

  const handleDeleteModel = async (name: string) => {
    if (!confirm(`Are you sure you want to delete ${name}?`)) return;
    try {
      const res = await fetch(`http://localhost:8000/api/ask/models/${name}`, { method: 'DELETE' });
      if (res.ok) {
        alert('Model deleted successfully');
        fetchModels();
      } else {
        const error = await res.json();
        alert(`Error: ${error.detail}`);
      }
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    }
  };

  const handleSaveSystemSettings = async () => {
    setSystemSaving(true);
    try {
      await saveSystemSettings({ ollamaBaseUrl: ollamaHost });
      fetchModels();
    } catch (e: any) {
      alert(`Error: ${e.message}`);
    } finally {
      setSystemSaving(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', height: '100%', overflowY: 'auto' }}>
      <h1>Settings</h1>
      
      <div className="card">
        <h2>Appearance</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>Adjust how the Second Brain looks and feels.</p>
        
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Global Text Size ({fontSize}px)</label>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.5rem' }}>
          <span style={{ fontSize: '12px' }}>A</span>
          <input 
            type="range" 
            min="12" 
            max="24" 
            step="1" 
            value={fontSize} 
            onChange={e => handleFontSizeChange(Number(e.target.value))}
            style={{ flex: 1, accentColor: 'var(--accent-color)' }}
          />
          <span style={{ fontSize: '24px' }}>A</span>
        </div>
      </div>

      <div className="card">
        <h2>Global Settings & Profile</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>Personalize how the Second Brain interacts with you and which local AI Model it uses.</p>
        
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Active AI Model</label>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: 0 }}>This model will be used for all generations, tags, answering, and summarization.</p>
        <select className="input" value={activeModel} onChange={e => setActiveModel(e.target.value)}>
          {availableModels.length === 0 && <option value={activeModel}>{activeModel}</option>}
          {availableModels.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Name</label>
        <input className="input" value={profileName} onChange={e => setProfileName(e.target.value)} placeholder="Your Name" />
        
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Bio / Context / Writing Style</label>
        <textarea 
          className="input" 
          rows={4}
          value={profileBio} 
          onChange={e => setProfileBio(e.target.value)} 
          placeholder="E.g. I am a software engineer building AI products. Prefer concise, technical responses." 
        />
        
        <button className="btn" onClick={saveSettings}>Save Settings</button>
      </div>

      <div className="card">
        <h2>Desktop Runtime</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Configure how the bundled backend reaches Ollama on this machine.
        </p>

        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Ollama Host</label>
        <input
          className="input"
          value={ollamaHost}
          onChange={e => setOllamaHost(e.target.value)}
          placeholder="http://localhost:11434"
        />

        <div style={{ marginTop: '0.75rem', color: status?.ollamaReachable ? 'var(--accent-color)' : '#ff4444' }}>
          {status?.ollamaReachable
            ? 'Ollama is reachable.'
            : 'Ollama is not reachable. Start Ollama or update the host before using AI features.'}
        </div>

        <button className="btn" onClick={handleSaveSystemSettings} disabled={systemSaving} style={{ marginTop: '1rem' }}>
          {systemSaving ? 'Saving...' : 'Save Ollama Host'}
        </button>
      </div>

      <div className="card">
        <h2>AI Models (Ollama)</h2>
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Manage Downloaded Models</h3>
          <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
            {availableModels.map(m => (
              <div key={m} className="flex items-center justify-between p-3 bg-bg-base/50 hover:bg-bg-base transition-colors">
                <span className="font-medium text-text-main">{m}</span>
                <button 
                  className="px-3 py-1.5 text-sm font-medium text-red-400 hover:text-red-300 bg-red-400/10 hover:bg-red-400/20 rounded-lg transition-colors" 
                  onClick={() => handleDeleteModel(m)}
                >
                  Delete
                </button>
              </div>
            ))}
            {availableModels.length === 0 && <p className="p-4 text-text-muted text-center">No models found.</p>}
          </div>
        </div>

        <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>Download New Model</h3>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Type the name of an Ollama model (e.g., <code>qwen2.5:0.5b</code>, <code>llama3</code>, <code>mistral</code>) and click Download.
        </p>
        
        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Model Name</label>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <input className="input" style={{ marginBottom: 0, flex: 1 }} value={modelName} onChange={e => setModelName(e.target.value)} placeholder="e.g. mxbai-embed-large" />
          <button className="btn" onClick={() => pullModel(modelName)} disabled={pulling}>
            {pulling ? 'Downloading... (See Sidebar)' : 'Download Model'}
          </button>
        </div>
        {pullResult && !pulling && <p style={{ marginTop: '1rem', color: pullResult.includes('Error') ? '#ff4444' : 'var(--accent-color)' }}>{pullResult}</p>}
      </div>

      <div className="card">
        <h2>📤 Export & Backup</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>Export your notes in various formats for backup or portability.</p>
        
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <a 
            href={apiUrl('/api/export/all/zip')}
            className="btn"
            style={{ textDecoration: 'none' }}
          >
            📦 Export All (ZIP)
          </a>
          <a 
            href={apiUrl('/api/export/vault/obsidian')}
            className="btn"
            style={{ 
              textDecoration: 'none', 
              backgroundColor: 'var(--surface-color)',
              color: 'var(--text-main)',
              border: '1px solid var(--border-color)'
            }}
          >
            🏛️ Obsidian Vault
          </a>
        </div>
      </div>

      {/* Privacy-First Telemetry */}
      <div className="card">
        <h2>🔒 Privacy &amp; Telemetry</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
          Second Brain is local-first. Telemetry is <strong>strictly opt-in</strong>, anonymous, and never contains your notes or personal data.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', backgroundColor: 'var(--bg-highlight)', borderRadius: '10px', border: '1px solid var(--border-color)', marginBottom: '1rem' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Anonymous Usage Analytics</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Opt-in to share anonymous feature usage stats. No notes, no identifiers, no IP addresses are ever collected.</div>
          </div>
          <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', cursor: 'pointer', flexShrink: 0 }}>
            <input type="checkbox" checked={telemetryEnabled} onChange={e => { setTelemetryEnabled(e.target.checked); localStorage.setItem('telemetry_enabled', e.target.checked ? '1' : '0'); }} style={{ opacity: 0, width: 0, height: 0 }} />
            <span style={{ position: 'absolute', inset: 0, backgroundColor: telemetryEnabled ? 'var(--accent-color)' : 'var(--border-color)', borderRadius: '24px', transition: 'all 0.2s' }}>
              <span style={{ position: 'absolute', left: telemetryEnabled ? '22px' : '2px', top: '2px', width: '20px', height: '20px', borderRadius: '50%', backgroundColor: 'white', transition: 'left 0.2s' }} />
            </span>
          </label>
        </div>
        {telemetryEnabled && (
          <div style={{ fontSize: '0.8rem', color: 'var(--accent-color)', padding: '0.5rem 0.75rem', backgroundColor: 'var(--accent-color)10', borderRadius: '8px', border: '1px solid var(--accent-color)33' }}>
            ✓ Thank you! Anonymous analytics are enabled. You can opt out at any time.
          </div>
        )}
        <div style={{ marginTop: '1rem' }}>
          <div style={{ fontWeight: 500, fontSize: '0.9rem', marginBottom: '0.4rem' }}>What is never collected:</div>
          <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.8 }}>
            <li>Note content, titles, or metadata</li>
            <li>Personal identifiers (name, email, IP addresses)</li>
            <li>API keys or Ollama model names</li>
          </ul>
        </div>
      </div>

      {/* Cross-Platform Native Feel */}
      <div className="card">
        <h2>🖥️ Appearance &amp; Platform</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>Fine-tune how the app looks and behaves on your system.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', backgroundColor: 'var(--bg-highlight)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div>
              <div style={{ fontWeight: 500, marginBottom: '0.15rem' }}>Reduce Motion</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Disable animations for accessibility</div>
            </div>
            <label style={{ position: 'relative', display: 'inline-block', width: '44px', height: '24px', cursor: 'pointer', flexShrink: 0 }}>
              <input type="checkbox" checked={reduceMotion} onChange={e => { setReduceMotion(e.target.checked); localStorage.setItem('reduce_motion', e.target.checked ? '1' : '0'); document.documentElement.setAttribute('data-reduce-motion', String(e.target.checked)); }} style={{ opacity: 0, width: 0, height: 0 }} />
              <span style={{ position: 'absolute', inset: 0, backgroundColor: reduceMotion ? 'var(--accent-color)' : 'var(--border-color)', borderRadius: '24px', transition: 'all 0.2s' }}>
                <span style={{ position: 'absolute', left: reduceMotion ? '22px' : '2px', top: '2px', width: '20px', height: '20px', borderRadius: '50%', backgroundColor: 'white', transition: 'left 0.2s' }} />
              </span>
            </label>
          </div>
          <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-highlight)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <div style={{ fontWeight: 500 }}>Base Font Size</div>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{fontSize}px</span>
            </div>
            <input type="range" min={13} max={20} value={fontSize} onChange={e => { const val = parseInt(e.target.value); setFontSize(val); localStorage.setItem('font_size', val.toString()); document.documentElement.style.fontSize = `${val}px`; }} style={{ width: '100%', accentColor: 'var(--accent-color)' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-muted)' }}><span>13px</span><span>20px</span></div>
          </div>
          <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-highlight)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ fontWeight: 500, marginBottom: '0.5rem' }}>Keyboard Shortcuts</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', fontSize: '0.8rem' }}>
              {[['Ctrl+K','Open notes'],['Ctrl+N','New note'],['Esc','Close modal'],['Ctrl+S','Save']].map(([k,d]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.3rem 0.5rem', backgroundColor: 'var(--surface-color)', borderRadius: '6px' }}>
                  <code style={{ fontSize: '0.75rem', color: 'var(--accent-color)' }}>{k}</code>
                  <span style={{ color: 'var(--text-muted)' }}>{d}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
