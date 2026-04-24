import { createContext, useContext, useState, ReactNode } from 'react';
import { apiUrl } from '../lib/api';

interface DownloadContextType {
  pulling: boolean;
  pullResult: string;
  pullProgress: number;
  pullModel: (modelName: string) => Promise<void>;
}

export const DownloadContext = createContext<DownloadContextType | undefined>(undefined);

export function DownloadProvider({ children }: { children: ReactNode }) {
  const [pulling, setPulling] = useState(false);
  const [pullResult, setPullResult] = useState('');
  const [pullProgress, setPullProgress] = useState(0);

  const pullModel = async (modelName: string) => {
    if (!modelName) return;
    setPulling(true);
    setPullResult('Starting download...');
    setPullProgress(0);

    try {
      const res = await fetch(apiUrl('/api/ask/pull-model'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelName })
      });

      if (!res.ok) {
        setPullResult('Error initiating download.');
        setPulling(false);
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("No reader available");
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunkStr = decoder.decode(value, { stream: true });
        const lines = chunkStr.split('\n').filter(l => l.trim());
        
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            
            if (data.status === 'error') {
                setPullResult(`Error: ${data.message}`);
                setPulling(false);
                return;
            }
            
            if (data.total && data.completed) {
              const perc = Math.round((data.completed / data.total) * 100);
              setPullProgress(perc);
              setPullResult(`Downloading... ${perc}%`);
            } else if (data.status) {
              setPullResult(data.status);
            }
          } catch (err) {
            // Ignore incomplete JSON chunks, relying on stream line splits usually fixes this
          }
        }
      }

      setPullProgress(100);
      setPullResult(`Successfully pulled/verified model: ${modelName}`);
    } catch (e: any) {
      setPullResult(`Error: ${e.message}`);
    } finally {
      setPulling(false);
    }
  };

  return (
    <DownloadContext.Provider value={{ pulling, pullResult, pullProgress, pullModel }}>
      {children}
    </DownloadContext.Provider>
  );
}

export function useDownload() {
  const context = useContext(DownloadContext);
  if (!context) throw new Error("useDownload must be used within a DownloadProvider");
  return context;
}
