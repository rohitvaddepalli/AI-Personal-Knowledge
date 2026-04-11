import { useRef, useState } from 'react';
import { Mic, MicOff, Square, Loader2, Copy, CheckCircle } from 'lucide-react';

interface VoiceMemoProps {
  /** Called when transcription is complete. Passes the transcribed text. */
  onTranscribed?: (text: string) => void;
  /** Whether to show as a compact inline button */
  compact?: boolean;
}

type RecordState = 'idle' | 'recording' | 'processing' | 'done' | 'error';

export function VoiceMemo({ onTranscribed, compact = false }: VoiceMemoProps) {
  const [state, setState] = useState<RecordState>('idle');
  const [transcription, setTranscription] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = handleStop;
      mediaRef.current = recorder;
      recorder.start(200); // collect chunks every 200ms
      setState('recording');
    } catch (e: any) {
      setError(`Microphone access denied: ${e.message}`);
      setState('error');
    }
  };

  const stopRecording = () => {
    if (mediaRef.current && mediaRef.current.state !== 'inactive') {
      mediaRef.current.stop();
      mediaRef.current.stream.getTracks().forEach(t => t.stop());
    }
  };

  const handleStop = async () => {
    setState('processing');
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
    const formData = new FormData();
    formData.append('file', blob, 'recording.webm');

    try {
      const res = await fetch('http://localhost:8000/api/voice/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text);
      }

      const data = await res.json();
      const text = data.text || '';
      setTranscription(text);
      setState('done');
      onTranscribed?.(text);
    } catch (e: any) {
      let msg = e.message || 'Unknown error';
      // Try to parse JSON error from FastAPI
      try {
        const parsed = JSON.parse(msg);
        msg = parsed.detail || msg;
      } catch {}
      setError(msg);
      setState('error');
    }
  };

  const copyTranscription = () => {
    if (!transcription) return;
    navigator.clipboard.writeText(transcription);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const reset = () => {
    setTranscription('');
    setError('');
    setState('idle');
  };

  if (compact) {
    return (
      <button
        onClick={state === 'recording' ? stopRecording : startRecording}
        disabled={state === 'processing'}
        title={state === 'recording' ? 'Stop recording' : 'Start voice recording'}
        style={{
          background: state === 'recording' ? '#ff444433' : 'var(--bg-highlight)',
          border: `1px solid ${state === 'recording' ? '#ff4444' : 'var(--border-color)'}`,
          borderRadius: '8px',
          padding: '0.4rem 0.6rem',
          cursor: state === 'processing' ? 'wait' : 'pointer',
          color: state === 'recording' ? '#ff4444' : 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.3rem',
          fontSize: '0.8rem',
          transition: 'all 0.2s',
        }}
      >
        {state === 'processing' ? <Loader2 size={14} className="animate-spin" /> : state === 'recording' ? <Square size={14} /> : <Mic size={14} />}
        {state === 'recording' ? 'Stop' : state === 'processing' ? '...' : 'Voice'}
      </button>
    );
  }

  return (
    <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '1.25rem', backgroundColor: 'var(--bg-highlight)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Mic size={18} style={{ color: 'var(--accent-color)' }} />
        <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Voice Memo</span>
        {state === 'done' && <CheckCircle size={16} style={{ color: 'var(--accent-color)', marginLeft: 'auto' }} />}
      </div>

      {/* Recording indicator */}
      {state === 'recording' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ff4444' }}>
          <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ff4444', animation: 'pulse 1s infinite' }} />
          <span style={{ fontSize: '0.85rem' }}>Recording...</span>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        {state === 'idle' || state === 'error' ? (
          <button
            className="btn"
            onClick={startRecording}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Mic size={16} /> Start Recording
          </button>
        ) : state === 'recording' ? (
          <button
            className="btn"
            onClick={stopRecording}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', backgroundColor: '#ff4444' }}
          >
            <MicOff size={16} /> Stop & Transcribe
          </button>
        ) : state === 'processing' ? (
          <button className="btn" disabled style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Transcribing...
          </button>
        ) : null}

        {(state === 'done' || state === 'error') && (
          <button
            onClick={reset}
            style={{ background: 'var(--bg-highlight)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.5rem 1rem', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.85rem' }}
          >
            New Recording
          </button>
        )}
      </div>

      {/* Error */}
      {state === 'error' && error && (
        <div style={{ backgroundColor: '#ff444422', border: '1px solid #ff4444', borderRadius: '8px', padding: '0.75rem', fontSize: '0.85rem', color: '#ff4444' }}>
          ⚠️ {error.includes('503') || error.includes('Whisper') ? (
            <>Whisper not available. Install <code>openai-whisper</code> (pip install openai-whisper) or pull the whisper model in Ollama.</>
          ) : error}
        </div>
      )}

      {/* Transcription result */}
      {state === 'done' && transcription && (
        <div style={{ backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Transcription</span>
            <button
              onClick={copyTranscription}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: copied ? 'var(--accent-color)' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.75rem' }}
            >
              <Copy size={12} /> {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{transcription}</p>
        </div>
      )}
    </div>
  );
}
