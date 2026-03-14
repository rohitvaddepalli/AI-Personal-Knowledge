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

  const saveSettings = () => {
    localStorage.setItem('profileName', profileName);
    localStorage.setItem('profileBio', profileBio);
    localStorage.setItem('activeModel', activeModel);
    alert('Settings saved globally!');
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
    </div>
  );
}
