import { useEffect, useMemo, useState } from 'react';
import { Download, Save, ServerCog, Shield, Sparkles, Gauge, KeyRound } from 'lucide-react';
import { apiUrl } from '../lib/api';
import { RuntimeSettings, useDesktopRuntime } from '../context/DesktopRuntimeContext';
import { useDownload } from '../context/DownloadContext';

const PROVIDERS = ['ollama', 'openai', 'anthropic', 'google', 'openrouter', 'groq', 'custom'] as const;

export default function Settings() {
  const { saveSystemSettings, status } = useDesktopRuntime();
  const { pulling, pullResult, pullModel } = useDownload();
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [modelName, setModelName] = useState('qwen2.5:0.5b');
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<RuntimeSettings | null>(null);

  useEffect(() => {
    if (status?.runtime) setDraft(status.runtime);
  }, [status?.runtime]);

  useEffect(() => {
    fetch(apiUrl('/api/ask/models'))
      .then((res) => res.json())
      .then((data) => { if (Array.isArray(data)) setAvailableModels(data); })
      .catch(() => {});
  }, [pulling, status?.runtime.llm.default_provider, status?.runtime.ollama_base_url]);

  const activeModel = useMemo(() => draft?.llm.default_model || localStorage.getItem('activeModel') || 'qwen2.5:0.5b', [draft]);
  if (!draft || !status) return null;

  const patchDraft = (patch: Partial<RuntimeSettings>) => setDraft((current) => current ? { ...current, ...patch } : current);

  const patchProvider = (provider: string, patch: Record<string, unknown>) => {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        llm: {
          ...current.llm,
          providers: {
            ...current.llm.providers,
            [provider]: {
              ...(current.llm.providers[provider] || { enabled: false }),
              ...patch,
            },
          },
        },
      };
    });
  };

  const patchFeatureRoute = (feature: string, key: 'provider' | 'model', value: string) => {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        llm: {
          ...current.llm,
          feature_routing: {
            ...current.llm.feature_routing,
            [feature]: {
              ...(current.llm.feature_routing[feature] || { provider: current.llm.default_provider, model: current.llm.default_model }),
              [key]: value,
            },
          },
        },
      };
    });
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      await saveSystemSettings(draft);
      localStorage.setItem('activeModel', draft.llm.default_model);
      localStorage.setItem('sb_low_resource_mode', draft.low_resource_mode ? '1' : '0');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 20, overflowY: 'auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', marginBottom: 6 }}>Settings</h1>
          <p style={{ color: 'var(--on-surface-dim)', margin: 0 }}>Phase 4 controls for providers, auth, streaming quality, and low-resource operation.</p>
        </div>
        <button className="btn" onClick={saveAll} disabled={saving}>
          <Save size={14} /> {saving ? 'Saving...' : 'Save Runtime Settings'}
        </button>
      </header>

      <Section icon={<ServerCog size={18} />} title="Runtime & Resource Mode" description="Tune local runtime safety and performance defaults.">
        <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <Field label="Ollama Host">
            <input className="input" value={draft.ollama_base_url} onChange={(e) => patchDraft({ ollama_base_url: e.target.value })} />
          </Field>
          <Field label="RAM Tier">
            <select className="input" value={draft.model_ram_tier} onChange={(e) => patchDraft({ model_ram_tier: e.target.value })}>
              <option value="4gb">4 GB</option>
              <option value="8gb">8 GB</option>
              <option value="16gb">16 GB+</option>
            </select>
          </Field>
          <Field label="AI Concurrency">
            <input className="input" type="number" min={1} max={8} value={draft.max_ai_concurrency} onChange={(e) => patchDraft({ max_ai_concurrency: Number(e.target.value) })} />
          </Field>
          <Field label="Context Window">
            <input className="input" type="number" min={512} max={32768} step={256} value={draft.ai_context_window} onChange={(e) => patchDraft({ ai_context_window: Number(e.target.value) })} />
          </Field>
        </div>
        <ToggleRow label="Low Resource Mode" description="Smaller responses, safer defaults, and reduced concurrency." checked={draft.low_resource_mode} onChange={(checked) => patchDraft({ low_resource_mode: checked })} />
        <ToggleRow label="Battery / Performance Saver" description="Reduce update intensity and AI pressure." checked={draft.battery_saver_mode} onChange={(checked) => patchDraft({ battery_saver_mode: checked })} />
        <ToggleRow label="Reduced Animations" description="Frontend performance saver for low-end machines." checked={draft.reduced_animations} onChange={(checked) => patchDraft({ reduced_animations: checked })} />
        <ToggleRow label="Pinned Resource Monitor" description="Show the compact CPU/RAM/model widget." checked={draft.resource_monitor_enabled} onChange={(checked) => patchDraft({ resource_monitor_enabled: checked })} />
        <Field label="Monitor Corner">
          <select className="input" value={draft.resource_monitor_corner} onChange={(e) => patchDraft({ resource_monitor_corner: e.target.value })}>
            <option value="bottom-right">Bottom Right</option>
            <option value="bottom-left">Bottom Left</option>
            <option value="top-right">Top Right</option>
            <option value="top-left">Top Left</option>
          </select>
        </Field>
      </Section>

      <Section icon={<Sparkles size={18} />} title="LLM Routing" description="Choose default providers/models and per-feature routing with fallback.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <Field label="Default Provider">
            <select className="input" value={draft.llm.default_provider} onChange={(e) => setDraft({ ...draft, llm: { ...draft.llm, default_provider: e.target.value } })}>
              {PROVIDERS.map((provider) => <option key={provider} value={provider}>{provider}</option>)}
            </select>
          </Field>
          <Field label="Default Model">
            <input className="input" value={draft.llm.default_model} onChange={(e) => setDraft({ ...draft, llm: { ...draft.llm, default_model: e.target.value } })} />
          </Field>
          <Field label="Fallback Chain">
            <input className="input" value={draft.llm.fallback_chain.join(',')} onChange={(e) => setDraft({ ...draft, llm: { ...draft.llm, fallback_chain: e.target.value.split(',').map((item) => item.trim()).filter(Boolean) } })} />
          </Field>
        </div>
        <ToggleRow label="Allow Cloud Providers" description="Local-only remains the default until you opt in." checked={draft.llm.cloud_opt_in} onChange={(checked) => setDraft({ ...draft, llm: { ...draft.llm, cloud_opt_in: checked } })} />
        {(['chat', 'summarize', 'embeddings', 'edit', 'transcription'] as const).map((feature) => (
          <div key={feature} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Field label={`${feature} provider`}>
              <select className="input" value={draft.llm.feature_routing[feature]?.provider || draft.llm.default_provider} onChange={(e) => patchFeatureRoute(feature, 'provider', e.target.value)}>
                {PROVIDERS.map((provider) => <option key={provider} value={provider}>{provider}</option>)}
              </select>
            </Field>
            <Field label={`${feature} model`}>
              <input className="input" value={draft.llm.feature_routing[feature]?.model || draft.llm.default_model} onChange={(e) => patchFeatureRoute(feature, 'model', e.target.value)} />
            </Field>
          </div>
        ))}
      </Section>

      <Section icon={<KeyRound size={18} />} title="Provider Keys & Endpoints" description="User-managed API keys. Secrets are stored by the backend runtime settings layer.">
        <div style={{ display: 'grid', gap: 12 }}>
          {PROVIDERS.map((provider) => (
            <div key={provider} style={{ padding: 14, borderRadius: 'var(--radius-lg)', background: 'var(--surface-container-low)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <strong style={{ fontFamily: 'var(--font-display)', textTransform: 'capitalize' }}>{provider}</strong>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem' }}>
                  <input type="checkbox" checked={!!draft.llm.providers[provider]?.enabled} onChange={(e) => patchProvider(provider, { enabled: e.target.checked })} />
                  Enabled
                </label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="Base URL">
                  <input className="input" value={draft.llm.providers[provider]?.base_url || ''} onChange={(e) => patchProvider(provider, { base_url: e.target.value })} placeholder={provider === 'ollama' ? 'http://localhost:11434' : ''} />
                </Field>
                <Field label="API Key">
                  <input className="input" value={draft.llm.providers[provider]?.api_key || ''} onChange={(e) => patchProvider(provider, { api_key: e.target.value })} placeholder={provider === 'ollama' ? 'Not required' : 'Paste key'} />
                </Field>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section icon={<Shield size={18} />} title="Auth & Security" description="Switch between localhost mode and multi-user cookie auth.">
        <Field label="Auth Mode">
          <select className="input" value={draft.auth_mode} onChange={(e) => patchDraft({ auth_mode: e.target.value })}>
            <option value="localhost">Single-user localhost</option>
            <option value="multi_user">Optional multi-user</option>
          </select>
        </Field>
        <div style={{ fontSize: '0.82rem', color: 'var(--on-surface-dim)' }}>
          Multi-user mode enables JWT access/refresh cookies and CSRF enforcement for mutating routes.
        </div>
      </Section>

      <Section icon={<Gauge size={18} />} title="Models & Health" description="Manage local models and verify provider availability.">
        <div style={{ display: 'grid', gap: 10 }}>
          <div style={{ color: status.ollamaReachable ? 'var(--secondary)' : 'var(--error)' }}>
            {status.ollamaReachable ? 'Ollama is reachable.' : 'Ollama is not reachable.'}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select className="input" value={activeModel} onChange={(e) => setDraft({ ...draft, llm: { ...draft.llm, default_model: e.target.value } })}>
              {availableModels.length === 0 ? <option value={activeModel}>{activeModel}</option> : availableModels.map((model) => <option key={model} value={model}>{model}</option>)}
            </select>
            <input className="input" value={modelName} onChange={(e) => setModelName(e.target.value)} placeholder="Model to pull" />
            <button className="btn" onClick={() => pullModel(modelName)} disabled={pulling}>
              <Download size={14} /> {pulling ? 'Downloading...' : 'Download'}
            </button>
          </div>
          {pullResult && <div style={{ fontSize: '0.8rem', color: pullResult.startsWith('Error') ? 'var(--error)' : 'var(--secondary)' }}>{pullResult}</div>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a href={apiUrl('/api/export/all/zip')} className="btn" style={{ textDecoration: 'none' }}>Export All (ZIP)</a>
            <a href={apiUrl('/api/export/vault/obsidian')} className="btn-secondary" style={{ textDecoration: 'none' }}>Obsidian Vault</a>
          </div>
        </div>
      </Section>
    </div>
  );
}

function Section({ icon, title, description, children }: { icon: React.ReactNode; title: string; description: string; children: React.ReactNode }) {
  return (
    <section style={{ padding: 20, borderRadius: 'var(--radius-xl)', background: 'var(--surface-container)', display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 14, background: 'var(--surface-container-high)', display: 'grid', placeItems: 'center', color: 'var(--primary)' }}>{icon}</div>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 2 }}>{title}</h2>
          <p style={{ margin: 0, color: 'var(--on-surface-dim)', fontSize: '0.85rem' }}>{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'grid', gap: 6 }}>
      <span className="label-sm">{label}</span>
      {children}
    </label>
  );
}

function ToggleRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: 12, borderRadius: 'var(--radius-lg)', background: 'var(--surface-container-low)' }}>
      <div>
        <div style={{ fontWeight: 600 }}>{label}</div>
        <div style={{ color: 'var(--on-surface-dim)', fontSize: '0.8rem' }}>{description}</div>
      </div>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}
