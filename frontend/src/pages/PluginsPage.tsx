import { useEffect, useState } from 'react';
import { Code2, Puzzle, CheckCircle2, XCircle, ExternalLink, RefreshCw, Info } from 'lucide-react';

interface Plugin {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  hooks: string[];
  permissions: string[];
  enabled: boolean;
  error?: string;
}

interface SdkInfo {
  plugins_dir: string;
  manifest_schema: Record<string, any>;
  available_hooks: string[];
  example_main_py: string;
}

export default function PluginsPage() {
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [sdkInfo, setSdkInfo] = useState<SdkInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'installed' | 'develop'>('installed');

  const fetchPlugins = async () => {
    setLoading(true);
    try {
      const [pluginsRes, sdkRes] = await Promise.all([
        fetch('http://localhost:8000/api/plugins'),
        fetch('http://localhost:8000/api/plugins/sdk/info'),
      ]);
      if (pluginsRes.ok) setPlugins((await pluginsRes.json()).plugins ?? []);
      if (sdkRes.ok) setSdkInfo(await sdkRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPlugins(); }, []);

  const togglePlugin = async (plugin: Plugin) => {
    const endpoint = plugin.enabled ? 'disable' : 'enable';
    try {
      await fetch(`http://localhost:8000/api/plugins/${plugin.id}/${endpoint}`, { method: 'POST' });
      fetchPlugins();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>Plugin System</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>Extend Second Brain with community-built plugins</p>
        </div>
        <button onClick={fetchPlugins} style={{ background: 'var(--bg-highlight)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.5rem 1rem', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem' }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)' }}>
        {(['installed', 'develop'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '0.6rem 1.2rem',
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: activeTab === tab ? 600 : 400,
              color: activeTab === tab ? 'var(--accent-color)' : 'var(--text-muted)',
              borderBottom: activeTab === tab ? '2px solid var(--accent-color)' : '2px solid transparent',
              transition: 'all 0.15s',
              textTransform: 'capitalize',
            }}
          >
            {tab === 'installed' ? <><Puzzle size={14} style={{ marginRight: '0.3rem', verticalAlign: 'text-bottom' }} />Installed</> : <><Code2 size={14} style={{ marginRight: '0.3rem', verticalAlign: 'text-bottom' }} />Develop</>}
          </button>
        ))}
      </div>

      {activeTab === 'installed' ? (
        <div>
          {loading ? (
            <p style={{ color: 'var(--text-muted)' }}>Loading plugins...</p>
          ) : plugins.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              <Puzzle size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
              <p style={{ margin: '0 0 0.5rem' }}>No plugins installed yet.</p>
              <p style={{ fontSize: '0.85rem', margin: 0 }}>
                Drop plugin folders into: <code style={{ backgroundColor: 'var(--bg-highlight)', padding: '0.2rem 0.4rem', borderRadius: '4px' }}>{sdkInfo?.plugins_dir ?? '~/.second-brain/plugins/'}</code>
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
              {plugins.map(plugin => (
                <div key={plugin.id} className="card" style={{ padding: '1.25rem', borderLeft: `3px solid ${plugin.enabled ? 'var(--accent-color)' : 'var(--border-color)'}` }}>
                  {plugin.error ? (
                    <div style={{ color: '#ff4444', fontSize: '0.85rem' }}>⚠️ {plugin.error}</div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                        <div>
                          <h3 style={{ margin: '0 0 0.2rem', fontSize: '0.95rem' }}>{plugin.name}</h3>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>v{plugin.version} by {plugin.author}</span>
                        </div>
                        <button
                          onClick={() => togglePlugin(plugin)}
                          style={{
                            background: 'transparent', border: 'none', cursor: 'pointer',
                            color: plugin.enabled ? 'var(--accent-color)' : 'var(--text-muted)',
                            display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.8rem',
                          }}
                        >
                          {plugin.enabled ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
                          {plugin.enabled ? 'Enabled' : 'Disabled'}
                        </button>
                      </div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 0.75rem' }}>{plugin.description}</p>
                      <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                        {plugin.hooks?.map(h => (
                          <span key={h} style={{ fontSize: '0.7rem', padding: '0.15rem 0.4rem', borderRadius: '6px', backgroundColor: 'var(--bg-highlight)', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}>{h}</span>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        // Developer guide
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <div className="card" style={{ borderLeft: '3px solid var(--accent-color)' }}>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
              <Info size={18} style={{ color: 'var(--accent-color)', marginTop: '2px', flexShrink: 0 }} />
              <div>
                <h3 style={{ margin: '0 0 0.4rem' }}>Building a Plugin</h3>
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  Plugins are directories in <code style={{ backgroundColor: 'var(--bg-highlight)', padding: '0.1rem 0.3rem', borderRadius: '4px' }}>{sdkInfo?.plugins_dir ?? '~/.second-brain/plugins/'}</code>. Each plugin needs a <strong>manifest.json</strong> and an entry point script.
                </p>
              </div>
            </div>
          </div>

          <div>
            <h3 style={{ marginBottom: '0.75rem', fontSize: '0.95rem' }}>Available Hooks</h3>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {(sdkInfo?.available_hooks ?? []).map(hook => (
                <span key={hook} style={{ fontSize: '0.8rem', padding: '0.3rem 0.7rem', borderRadius: '20px', backgroundColor: 'var(--accent-color)15', color: 'var(--accent-color)', border: '1px solid var(--accent-color)33' }}>{hook}</span>
              ))}
            </div>
          </div>

          <div>
            <h3 style={{ marginBottom: '0.75rem', fontSize: '0.95rem' }}>manifest.json Schema</h3>
            <pre style={{ backgroundColor: 'var(--bg-highlight)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '1rem', fontSize: '0.8rem', overflow: 'auto', color: 'var(--text-main)', fontFamily: 'monospace' }}>
              {JSON.stringify(sdkInfo?.manifest_schema ?? {}, null, 2)}
            </pre>
          </div>

          <div>
            <h3 style={{ marginBottom: '0.75rem', fontSize: '0.95rem' }}>Example main.py</h3>
            <pre style={{ backgroundColor: 'var(--bg-highlight)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '1rem', fontSize: '0.8rem', overflow: 'auto', color: 'var(--text-main)', fontFamily: 'monospace' }}>
              {sdkInfo?.example_main_py ?? ''}
            </pre>
          </div>

          <div className="card" style={{ backgroundColor: 'var(--accent-color)08' }}>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>Security Model</h3>
            <ul style={{ margin: 0, paddingLeft: '1.2rem', fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.8 }}>
              <li>Each plugin runs in an <strong>isolated subprocess</strong> with a 10-second timeout</li>
              <li>Plugins communicate via <strong>JSON over stdin/stdout</strong></li>
              <li>Plugins declare required <strong>permissions</strong> in their manifest</li>
              <li>Plugins can be <strong>enabled/disabled</strong> at runtime without restart</li>
              <li>Plugins directory is <strong>user-controlled</strong> — only install plugins you trust</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
