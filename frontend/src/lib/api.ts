let apiBaseUrl = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8000';

export function isDesktopRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function getApiBaseUrl(): string {
  return apiBaseUrl;
}

export function setApiBaseUrl(url: string): void {
  apiBaseUrl = url.replace(/\/+$/, '');
}

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  if (normalizedPath.startsWith('http://') || normalizedPath.startsWith('https://')) {
    return normalizedPath;
  }
  return `${apiBaseUrl}${normalizedPath}`;
}

export async function resolveDesktopRuntime(): Promise<{ apiBaseUrl: string; isDesktop: boolean }> {
  const desktop = isDesktopRuntime();
  return {
    apiBaseUrl: getApiBaseUrl(),
    isDesktop: desktop,
  };
}

export function installApiFetchShim(): void {
  if (typeof window === 'undefined') return;
  const originalFetch = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string' && input.startsWith('/api')) {
      input = apiUrl(input);
    }
    return originalFetch(input, init);
  };
}

