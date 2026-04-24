/**
 * WritingAssistant — Phase 3.3
 * Floating toolbar that appears on text selection in the NoteEditor/NoteDetail.
 * Actions: Continue writing | Rewrite | Explain | Translate | Custom
 * Shows inline diff with Accept / Reject.
 */
import { useState, useEffect, useRef } from 'react';
import {
  Sparkles, RotateCcw, BookOpen, Languages, Pencil,
  Check, X, Loader2,
} from 'lucide-react';
import { apiUrl } from '../lib/api';

export interface AssistAction {
  key: 'continue' | 'rewrite' | 'explain' | 'translate' | 'custom';
  label: string;
  icon: React.ReactNode;
  shortcut?: string;
}

const ACTIONS: AssistAction[] = [
  { key: 'continue',  label: 'Continue writing', icon: <Sparkles size={13} />,  shortcut: 'Alt+C' },
  { key: 'rewrite',   label: 'Rewrite',           icon: <RotateCcw size={13} />, shortcut: 'Alt+R' },
  { key: 'explain',   label: 'Explain',            icon: <BookOpen size={13} /> },
  { key: 'translate', label: 'Translate',          icon: <Languages size={13} /> },
  { key: 'custom',    label: 'Custom…',            icon: <Pencil size={13} /> },
];

const LANGUAGES = ['Spanish', 'French', 'German', 'Japanese', 'Chinese', 'Hindi', 'Arabic', 'Portuguese'];

interface Props {
  noteId: string;
  selection: string;
  context?: string;
  model?: string;
  /** called when user accepts — replace selection with result */
  onAccept: (result: string, action: string) => void;
  onClose: () => void;
}

export default function WritingAssistant({ noteId, selection, context, model = 'qwen2.5:0.5b', onAccept, onClose }: Props) {
  const [activeAction, setActiveAction] = useState<AssistAction | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState('Spanish');
  const [customInstruction, setCustomInstruction] = useState('');
  const [showLangMenu, setShowLangMenu] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const runAction = async (action: AssistAction) => {
    if (!selection.trim()) return;
    setActiveAction(action);
    setResult(null);
    setError(null);

    if (action.key === 'translate' && !showLangMenu && result === null) {
      setShowLangMenu(true);
      return;
    }
    if (action.key === 'custom' && !customInstruction.trim()) return;

    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/notes/${noteId}/ai-assist`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: action.key,
          selection,
          context: context || '',
          model,
          language,
          custom_instruction: customInstruction,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setResult(data.result);
    } catch (e: any) {
      setError(e.message || 'Request failed');
    } finally {
      setLoading(false);
      setShowLangMenu(false);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      if (e.key === 'c' || e.key === 'C') { e.preventDefault(); runAction(ACTIONS[0]); }
      if (e.key === 'r' || e.key === 'R') { e.preventDefault(); runAction(ACTIONS[1]); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, noteId, model]);

  return (
    <div
      ref={containerRef}
      className="animate-slide-up"
      style={{
        background: 'var(--surface-container)',
        border: '1px solid var(--outline)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: '0 16px 48px rgba(0,0,0,0.35)',
        width: 380,
        overflow: 'hidden',
        fontFamily: 'var(--font-body)',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid var(--outline-variant)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <Sparkles size={14} style={{ color: 'var(--primary)' }} />
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.8125rem', flex: 1 }}>
          AI Writing Assistant
        </span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--on-surface-dim)', padding: 2 }}>
          <X size={14} />
        </button>
      </div>

      {/* Selection preview */}
      <div style={{
        padding: '8px 14px',
        background: 'var(--surface-container-lowest)',
        borderBottom: '1px solid var(--outline-variant)',
        fontSize: '0.75rem',
        color: 'var(--on-surface-dim)',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        borderLeft: '3px solid var(--primary)',
      }}>
        "{selection.slice(0, 80)}{selection.length > 80 ? '…' : ''}"
      </div>

      {/* Action buttons */}
      {!result && (
        <div style={{ padding: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {ACTIONS.map((action) => (
            <button
              key={action.key}
              onClick={() => runAction(action)}
              disabled={loading}
              style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '6px 11px', borderRadius: 'var(--radius-full)',
                border: `1px solid ${activeAction?.key === action.key ? 'var(--primary)' : 'var(--outline-variant)'}`,
                background: activeAction?.key === action.key ? 'var(--primary-container)' : 'var(--surface-container-lowest)',
                color: activeAction?.key === action.key ? 'var(--primary)' : 'var(--on-surface)',
                fontSize: '0.75rem', cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 150ms', opacity: loading && activeAction?.key !== action.key ? 0.4 : 1,
              }}
            >
              {action.icon}
              {action.label}
              {action.shortcut && (
                <kbd style={{ fontSize: '0.5rem', opacity: 0.6, marginLeft: 2, padding: '1px 3px', border: '1px solid var(--outline-variant)', borderRadius: 3 }}>
                  {action.shortcut}
                </kbd>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Translate language picker */}
      {showLangMenu && !loading && (
        <div style={{ padding: '0 10px 10px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <span style={{ width: '100%', fontSize: '0.6875rem', color: 'var(--on-surface-dim)', marginBottom: 4 }}>Select target language:</span>
          {LANGUAGES.map((lang) => (
            <button
              key={lang}
              onClick={() => { setLanguage(lang); runAction(ACTIONS[3]); }}
              style={{
                padding: '5px 10px', borderRadius: 'var(--radius-full)',
                border: `1px solid ${language === lang ? 'var(--primary)' : 'var(--outline-variant)'}`,
                background: language === lang ? 'var(--primary-container)' : 'transparent',
                color: 'var(--on-surface)', fontSize: '0.75rem', cursor: 'pointer',
              }}
            >
              {lang}
            </button>
          ))}
        </div>
      )}

      {/* Custom instruction input */}
      {activeAction?.key === 'custom' && !result && !loading && (
        <div style={{ padding: '0 10px 10px', display: 'flex', gap: 6 }}>
          <input
            autoFocus
            value={customInstruction}
            onChange={(e) => setCustomInstruction(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') runAction(ACTIONS[4]); }}
            placeholder="e.g. Make it more formal…"
            style={{
              flex: 1, padding: '7px 11px', fontSize: '0.8125rem',
              border: '1px solid var(--outline)', borderRadius: 'var(--radius-md)',
              background: 'var(--surface-container-lowest)', color: 'var(--on-surface)', outline: 'none',
            }}
          />
          <button className="btn" style={{ padding: '7px 12px', fontSize: '0.75rem' }} onClick={() => runAction(ACTIONS[4])}>
            Go
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ padding: '14px', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--on-surface-dim)', fontSize: '0.8125rem' }}>
          <Loader2 size={16} style={{ animation: 'spin 1s linear infinite', color: 'var(--primary)' }} />
          {activeAction?.label}…
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ padding: '10px 14px', background: 'var(--error-container)', fontSize: '0.8125rem', color: 'var(--error)', display: 'flex', gap: 8 }}>
          <X size={14} style={{ flexShrink: 0, marginTop: 1 }} /> {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <>
          <div style={{
            padding: 14,
            background: 'var(--surface-container-lowest)',
            borderTop: '1px solid var(--outline-variant)',
            fontSize: '0.8125rem',
            color: 'var(--on-surface)',
            lineHeight: 1.65,
            maxHeight: 220,
            overflowY: 'auto',
            whiteSpace: 'pre-wrap',
          }}>
            {result}
          </div>
          <div style={{
            padding: '10px 14px',
            borderTop: '1px solid var(--outline-variant)',
            display: 'flex', gap: 8,
          }}>
            <button
              className="btn"
              onClick={() => { onAccept(result, activeAction?.key || ''); onClose(); }}
              style={{ flex: 1, gap: 6, justifyContent: 'center', fontSize: '0.8125rem' }}
            >
              <Check size={14} /> Accept
            </button>
            <button
              className="btn-ghost"
              onClick={() => { setResult(null); setActiveAction(null); setError(null); }}
              style={{ gap: 6, fontSize: '0.8125rem' }}
            >
              <RotateCcw size={14} /> Try again
            </button>
            <button
              className="btn-ghost"
              onClick={onClose}
              style={{ gap: 6, fontSize: '0.8125rem', color: 'var(--on-surface-dim)' }}
            >
              <X size={14} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
