import { ReactNode, createContext, useContext, useEffect, useState } from 'react';
import { apiUrl, isDesktopRuntime, resolveDesktopRuntime, setApiBaseUrl } from '../lib/api';

export interface ProviderConfig {
  enabled: boolean;
  base_url?: string;
  api_key?: string;
  models?: string[];
}

export interface RuntimeSettings {
  ollama_base_url: string;
  low_resource_mode: boolean;
  model_ram_tier: string;
  max_ai_concurrency: number;
  ai_context_window: number;
  battery_saver_mode: boolean;
  reduced_animations: boolean;
  resource_monitor_enabled: boolean;
  resource_monitor_corner: string;
  auth_mode: string;
  llm: {
    default_provider: string;
    default_model: string;
    cloud_opt_in: boolean;
    fallback_chain: string[];
    feature_routing: Record<string, { provider: string; model: string }>;
    providers: Record<string, ProviderConfig>;
  };
}

export interface ResourceMetrics {
  cpuPercent: number;
  ramPercent: number;
  processMemoryMb: number;
  cpuHistory: number[];
  ramHistory: number[];
  queueDepth: number;
  activeTasks: Array<{ id: string; job_type: string; status: string; progress?: number }>;
  activeModel: string;
  activeProvider: string;
  warnings: { cpu: string; ram: string };
}

interface DesktopStatus {
  apiBaseUrl: string;
  appDataDir: string;
  ollamaBaseUrl: string;
  ollamaReachable: boolean;
  sidecarMode: boolean;
  databaseMode?: string;
  databaseBackend?: string;
  runtime: RuntimeSettings;
  metrics: ResourceMetrics;
  providerHealth: Record<string, boolean>;
}

interface DesktopRuntimeContextValue {
  error: string | null;
  initializing: boolean;
  isDesktop: boolean;
  status: DesktopStatus | null;
  refreshStatus: () => Promise<void>;
  refreshMetrics: () => Promise<void>;
  retryStartup: () => Promise<void>;
  saveSystemSettings: (payload: Partial<RuntimeSettings> & { llm?: RuntimeSettings['llm'] }) => Promise<DesktopStatus>;
}

const DesktopRuntimeContext = createContext<DesktopRuntimeContextValue | undefined>(undefined);

const STARTUP_TIMEOUT_MS = 20_000;
const RETRY_INTERVAL_MS = 750;

async function fetchStatus() {
  const response = await fetch(apiUrl('/api/system/status'));
  if (!response.ok) throw new Error('Failed to fetch desktop status');
  return response.json() as Promise<DesktopStatus>;
}

export function DesktopRuntimeProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<DesktopStatus | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const desktop = isDesktopRuntime();

  const refreshStatus = async () => {
    const nextStatus = await fetchStatus();
    setStatus(nextStatus);
  };

  const refreshMetrics = async () => {
    const response = await fetch(apiUrl('/api/system/metrics'));
    if (!response.ok) throw new Error('Failed to fetch metrics');
    const metrics = await response.json() as ResourceMetrics;
    setStatus((current) => current ? { ...current, metrics } : current);
  };

  const bootstrap = async () => {
    setInitializing(true);
    setError(null);

    const runtime = await resolveDesktopRuntime();
    setApiBaseUrl(runtime.apiBaseUrl);

    if (!desktop) {
      setInitializing(false);
      try {
        await refreshStatus();
      } catch {
        // Keep web mode non-blocking.
      }
      return;
    }

    const start = Date.now();
    while (Date.now() - start < STARTUP_TIMEOUT_MS) {
      try {
        const response = await fetch(apiUrl('/api/health'));
        if (response.ok) {
          await refreshStatus();
          setInitializing(false);
          return;
        }
      } catch {
        // Sidecar still booting.
      }
      await new Promise((resolve) => window.setTimeout(resolve, RETRY_INTERVAL_MS));
    }

    setError('The local backend did not become ready in time.');
    setInitializing(false);
  };

  const saveSystemSettings = async (payload: Partial<RuntimeSettings> & { llm?: RuntimeSettings['llm'] }) => {
    const response = await fetch(apiUrl('/api/system/settings'), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail || 'Failed to save system settings');
    }
    await refreshStatus();
    const next = await fetchStatus();
    setStatus(next);
    return next;
  };

  useEffect(() => {
    bootstrap().catch((cause) => {
      setError(cause instanceof Error ? cause.message : 'Failed to initialize desktop runtime');
      setInitializing(false);
    });
  }, []);

  useEffect(() => {
    if (!status?.runtime.resource_monitor_enabled) return;
    const timer = window.setInterval(() => {
      refreshMetrics().catch(() => {});
    }, 5000);
    return () => window.clearInterval(timer);
  }, [status?.runtime.resource_monitor_enabled]);

  return (
    <DesktopRuntimeContext.Provider value={{ error, initializing, isDesktop: desktop, status, refreshStatus, refreshMetrics, retryStartup: bootstrap, saveSystemSettings }}>
      {children}
    </DesktopRuntimeContext.Provider>
  );
}

export function useDesktopRuntime() {
  const context = useContext(DesktopRuntimeContext);
  if (!context) throw new Error('useDesktopRuntime must be used within DesktopRuntimeProvider');
  return context;
}
