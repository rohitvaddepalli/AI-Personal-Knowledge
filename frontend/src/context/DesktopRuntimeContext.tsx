import { ReactNode, createContext, useContext, useEffect, useState } from 'react';
import { apiUrl, getApiBaseUrl, isDesktopRuntime, resolveDesktopRuntime, setApiBaseUrl } from '../lib/api';

interface DesktopStatus {
  apiBaseUrl: string;
  appDataDir: string;
  ollamaBaseUrl: string;
  ollamaReachable: boolean;
  sidecarMode: boolean;
}

interface DesktopRuntimeContextValue {
  error: string | null;
  initializing: boolean;
  isDesktop: boolean;
  status: DesktopStatus | null;
  refreshStatus: () => Promise<void>;
  retryStartup: () => Promise<void>;
  saveSystemSettings: (payload: { ollamaBaseUrl: string }) => Promise<DesktopStatus>;
}

const DesktopRuntimeContext = createContext<DesktopRuntimeContextValue | undefined>(undefined);

const STARTUP_TIMEOUT_MS = 20_000;
const RETRY_INTERVAL_MS = 750;

async function fetchStatus() {
  const response = await fetch(apiUrl('/api/system/status'));
  if (!response.ok) {
    throw new Error('Failed to fetch desktop status');
  }

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
        // Keep web mode non-blocking if the backend is offline.
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
        // Sidecar is still booting.
      }

      await new Promise((resolve) => window.setTimeout(resolve, RETRY_INTERVAL_MS));
    }

    setError('The local backend did not become ready in time.');
    setInitializing(false);
  };

  const saveSystemSettings = async ({ ollamaBaseUrl }: { ollamaBaseUrl: string }) => {
    const response = await fetch(apiUrl('/api/system/settings'), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ollama_base_url: ollamaBaseUrl }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(detail || 'Failed to save system settings');
    }

    const nextPartial = await response.json() as Pick<DesktopStatus, 'ollamaBaseUrl' | 'ollamaReachable'>;
    const nextStatus = {
      apiBaseUrl: status?.apiBaseUrl || getApiBaseUrl(),
      appDataDir: status?.appDataDir || '',
      sidecarMode: status?.sidecarMode || desktop,
      ...nextPartial,
    };
    setStatus(nextStatus);
    return nextStatus;
  };

  useEffect(() => {
    bootstrap().catch((cause) => {
      setError(cause instanceof Error ? cause.message : 'Failed to initialize desktop runtime');
      setInitializing(false);
    });
  }, []);

  return (
    <DesktopRuntimeContext.Provider
      value={{
        error,
        initializing,
        isDesktop: desktop,
        status,
        refreshStatus,
        retryStartup: bootstrap,
        saveSystemSettings,
      }}
    >
      {children}
    </DesktopRuntimeContext.Provider>
  );
}

export function useDesktopRuntime() {
  const context = useContext(DesktopRuntimeContext);
  if (!context) {
    throw new Error('useDesktopRuntime must be used within DesktopRuntimeProvider');
  }

  return context;
}
