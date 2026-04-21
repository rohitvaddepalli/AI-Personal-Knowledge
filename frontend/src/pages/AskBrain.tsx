import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Send, Sparkles, ExternalLink, MessageSquare, Trash2, Edit3,
  Plus, Search, BookOpen, Zap, AlertCircle, CheckCircle, Info,
} from 'lucide-react';
import { apiUrl } from '../lib/api';

// ── Retrieval mode config ──────────────────────────────────────────────────
const MODES = [
  {
    id: 'auto',
    label: 'Auto',
    icon: <Sparkles size={12} />,
    desc: 'Hybrid search across all your notes',
  },
  {
    id: 'search_only',
    label: 'Search Only',
    icon: <Search size={12} />,
    desc: 'Returns matching notes without generating an answer',
  },
  {
    id: 'strict_cited',
    label: 'Strict Cited',
    icon: <BookOpen size={12} />,
    desc: 'Answer only from retrieved notes — refuses if grounding is weak',
  },
];

// ── Inline confirmation dialog ─────────────────────────────────────────────
function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
}: {
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onCancel}
    >
      <div
        className="animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface-container)', borderRadius: 'var(--radius-xl)',
          padding: 28, maxWidth: 400, width: '90%',
          border: '1px solid var(--outline)',
        }}
      >
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <AlertCircle size={20} style={{ color: 'var(--error)', flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: '0.875rem', lineHeight: 1.6, color: 'var(--on-surface)' }}>{message}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button
            className="btn"
            style={{ background: 'var(--error)', color: '#fff' }}
            onClick={onConfirm}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Inline rename dialog ───────────────────────────────────────────────────
function RenameDialog({
  defaultValue,
  onConfirm,
  onCancel,
}: {
  defaultValue: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onCancel}
    >
      <div
        className="animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface-container)', borderRadius: 'var(--radius-xl)',
          padding: 28, maxWidth: 400, width: '90%',
          border: '1px solid var(--outline)',
        }}
      >
        <p style={{ fontSize: '0.875rem', marginBottom: 14, fontFamily: 'var(--font-display)', fontWeight: 600 }}>
          Rename chat
        </p>
        <input
          className="input"
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onConfirm(value); if (e.key === 'Escape') onCancel(); }}
          style={{ width: '100%', marginBottom: 16, borderRadius: 'var(--radius-md)' }}
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn" onClick={() => onConfirm(value)} disabled={!value.trim()}>Rename</button>
        </div>
      </div>
    </div>
  );
}

// ── Mini toast notification ────────────────────────────────────────────────
function Toast({ message, type = 'info' }: { message: string; type?: 'info' | 'error' | 'success' }) {
  const colors = {
    info: 'var(--primary)',
    error: 'var(--error)',
    success: 'var(--secondary)',
  };
  const icons = {
    info: <Info size={14} />,
    error: <AlertCircle size={14} />,
    success: <CheckCircle size={14} />,
  };
  return (
    <div
      className="animate-fade-in"
      style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 300,
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '12px 18px', borderRadius: 'var(--radius-lg)',
        background: 'var(--surface-container-high)',
        border: `1px solid ${colors[type]}`,
        color: 'var(--on-surface)', fontSize: '0.8125rem',
        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        maxWidth: 360,
      }}
    >
      <span style={{ color: colors[type] }}>{icons[type]}</span>
      {message}
    </div>
  );
}

// ── Confidence badge ───────────────────────────────────────────────────────
function ConfidenceBadge({ value }: { value: number | null | undefined }) {
  if (value == null) return null;
  const pct = Math.round(value * 100);
  const color = pct >= 70 ? 'var(--secondary)' : pct >= 40 ? 'var(--tertiary)' : 'var(--on-surface-dim)';
  const label = pct >= 70 ? 'High confidence' : pct >= 40 ? 'Moderate confidence' : 'Low confidence';
  return (
    <span
      title={label}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '2px 8px', borderRadius: 'var(--radius-full)',
        background: 'var(--surface-container-highest)',
        color, fontSize: '0.625rem', fontFamily: 'var(--font-mono)',
        fontWeight: 600, letterSpacing: '0.04em',
      }}
    >
      <Zap size={9} />
      {pct}%
    </span>
  );
}

// ── FileText mini icon ─────────────────────────────────────────────────────
function FileText({ size = 16, style: s }: { size?: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      style={s}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function AskBrain() {
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [activeModel, setActiveModel] = useState(
    () => localStorage.getItem('activeModel') || 'qwen2.5:0.5b'
  );
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [allNotes, setAllNotes] = useState<any[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [latestSources, setLatestSources] = useState<any[]>([]);
  const [retrievalMode, setRetrievalMode] = useState<'auto' | 'search_only' | 'strict_cited'>('auto');

  // Dialog state
  const [confirmDelete, setConfirmDelete] = useState<{ id: number; title: string } | null>(null);
  const [renameTarget, setRenameTarget] = useState<{ id: number; title: string } | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'info' | 'error' | 'success' } | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const showToast = (msg: string, type: 'info' | 'error' | 'success' = 'info') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchSessions = () => {
    fetch(apiUrl('/api/chat/sessions'))
      .then((res) => { if (!res.ok) throw new Error(`Sessions fetch failed: ${res.status}`); return res.json(); })
      .then((data) => { if (Array.isArray(data)) setSessions(data); })
      .catch(console.error);
  };

  useEffect(() => {
    fetchSessions();
    fetch(apiUrl('/api/ask/models'))
      .then((res) => res.json())
      .then((data) => { if (Array.isArray(data)) setAvailableModels(data); })
      .catch(console.error);
    fetch(apiUrl('/api/notes'))
      .then((res) => res.json())
      .then(setAllNotes)
      .catch(console.error);
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [history]);

  useEffect(() => {
    if (!mentionOpen && textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [mentionOpen, question]);

  const deleteSession = (id: number, title: string) => {
    setConfirmDelete({ id, title });
  };

  const confirmDeleteSession = async () => {
    if (!confirmDelete) return;
    const { id } = confirmDelete;
    setConfirmDelete(null);
    try {
      await fetch(apiUrl(`/api/chat/sessions/${id}`), { method: 'DELETE' });
      if (sessionId === id) { setHistory([]); setSessionId(null); setLatestSources([]); }
      fetchSessions();
      showToast('Chat deleted.', 'success');
    } catch (e) {
      console.error(e);
      showToast('Failed to delete chat.', 'error');
    }
  };

  const renameSession = (id: number, title: string) => {
    setRenameTarget({ id, title });
  };

  const confirmRenameSession = async (newTitle: string) => {
    if (!renameTarget || !newTitle.trim()) return;
    const { id } = renameTarget;
    setRenameTarget(null);
    try {
      await fetch(apiUrl(`/api/chat/sessions/${id}`), {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      fetchSessions();
    } catch (e) {
      console.error(e);
      showToast('Failed to rename chat.', 'error');
    }
  };

  const loadSession = async (id: number) => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/chat/sessions/${id}`));
      if (!res.ok) throw new Error(`Failed to load session: ${res.status} ${res.statusText}`);
      const data = await res.json();
      setHistory(
        data.messages.map((m: any) => ({
          type: m.role === 'user' ? 'user' : 'ai',
          content: m.content,
        }))
      );
      setSessionId(id);
      setLatestSources([]);
    } catch (e: any) {
      console.error(e);
      showToast(`Failed to load session: ${e.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAsk = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setHistory((prev) => [...prev, { type: 'user', content: question }]);
    const currentQuestion = question;
    setQuestion('');
    setMentionOpen(false);

    try {
      const res = await fetch(apiUrl('/api/ask'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: currentQuestion,
          session_id: sessionId,
          profile_context: localStorage.getItem('profileBio') || undefined,
          model: activeModel,
          mode: retrievalMode,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || `API error: ${res.status} ${res.statusText}`);
      }
      const data = await res.json();
      setHistory((prev) => [
        ...prev,
        {
          type: 'ai',
          content: data.answer,
          sources: data.sources,
          confidence: data.confidence,
          retrieval_explanation: data.retrieval_explanation,
        },
      ]);
      if (data.session_id) setSessionId(data.session_id);
      if (data.sources) setLatestSources(data.sources);
      fetchSessions();
    } catch (e: any) {
      setHistory((prev) => [
        ...prev,
        { type: 'ai', content: `Error: ${e.message}`, sources: [] },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setQuestion(val);
    const lastWord = val.split(/\s+/).pop() || '';
    if (lastWord.startsWith('@')) {
      setMentionOpen(true);
      setMentionFilter(lastWord.slice(1).toLowerCase());
    } else {
      setMentionOpen(false);
    }
  };

  const selectNote = (title: string) => {
    const words = question.split(/\s+/);
    words.pop();
    setQuestion([...words, `@${title} `].join(' '));
    setMentionOpen(false);
  };

  const filteredNotes = allNotes.filter((n) =>
    n.title.toLowerCase().includes(mentionFilter)
  );

  const selectedModeInfo = MODES.find((m) => m.id === retrievalMode)!;

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', padding: '24px 28px' }}>

      {/* Dialogs */}
      {confirmDelete && (
        <ConfirmDialog
          message={`Delete "${confirmDelete.title}"? This cannot be undone.`}
          onConfirm={confirmDeleteSession}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
      {renameTarget && (
        <RenameDialog
          defaultValue={renameTarget.title || `Chat #${renameTarget.id}`}
          onConfirm={confirmRenameSession}
          onCancel={() => setRenameTarget(null)}
        />
      )}
      {toast && <Toast message={toast.msg} type={toast.type} />}

      {/* ═══ Sessions Sidebar ═══ */}
      <div style={{
        width: 200, minWidth: 200, display: 'flex', flexDirection: 'column',
        background: 'var(--surface-container-lowest)', borderRadius: 'var(--radius-lg)',
        padding: 12, marginRight: 20, overflow: 'hidden',
      }}>
        <button
          className="btn"
          onClick={() => { setHistory([]); setSessionId(null); setLatestSources([]); }}
          style={{ marginBottom: 12, width: '100%', fontSize: '0.75rem', padding: '8px 12px' }}
        >
          <Plus size={14} /> New Chat
        </button>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {sessions.length === 0 && (
            <p style={{ fontSize: '0.6875rem', color: 'var(--on-surface-dim)', textAlign: 'center', padding: '16px 8px' }}>
              No chats yet
            </p>
          )}
          {sessions.map((s) => (
            <div
              key={s.id}
              role="button"
              tabIndex={0}
              aria-current={sessionId === s.id ? 'true' : undefined}
              onClick={() => loadSession(s.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); loadSession(s.id); } }}
              style={{
                padding: '8px 10px', borderRadius: 'var(--radius-md)',
                cursor: 'pointer', fontSize: '0.75rem',
                background: sessionId === s.id ? 'var(--primary-dim)' : 'transparent',
                color: sessionId === s.id ? 'var(--primary)' : 'var(--on-surface-variant)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                transition: 'all 200ms',
              }}
              onFocus={(e) => { e.currentTarget.style.boxShadow = '0 0 0 2px var(--primary)'; }}
              onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
              onMouseEnter={(e) => { if (sessionId !== s.id) e.currentTarget.style.background = 'var(--surface-variant)'; }}
              onMouseLeave={(e) => { if (sessionId !== s.id) e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                <MessageSquare size={12} style={{ flexShrink: 0 }} />
                {s.title || `Chat #${s.id}`}
              </span>
              <div style={{ display: 'flex', gap: 2, marginLeft: 4, flexShrink: 0 }}>
                <button
                  onClick={(e) => { e.stopPropagation(); renameSession(s.id, s.title); }}
                  style={{ background: 'transparent', border: 'none', color: 'var(--on-surface-dim)', cursor: 'pointer', padding: 2 }}
                  title="Rename"
                >
                  <Edit3 size={10} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteSession(s.id, s.title || `Chat #${s.id}`); }}
                  style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: 2 }}
                  title="Delete"
                >
                  <Trash2 size={10} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ═══ Chat Area ═══ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16,
          paddingBottom: 12, borderBottom: '1px solid var(--outline-variant)',
        }}>
          <h2 style={{ fontFamily: 'var(--font-display)', flex: 1 }}>Ask Brain</h2>

          {/* Retrieval mode selector */}
          <div style={{ display: 'flex', gap: 4 }}>
            {MODES.map((m) => (
              <button
                key={m.id}
                title={m.desc}
                onClick={() => setRetrievalMode(m.id as any)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '5px 10px', borderRadius: 'var(--radius-full)',
                  border: 'none', cursor: 'pointer', fontSize: '0.6875rem',
                  fontFamily: 'var(--font-display)', fontWeight: 500,
                  transition: 'all 180ms',
                  background: retrievalMode === m.id ? 'var(--primary)' : 'var(--surface-container)',
                  color: retrievalMode === m.id ? 'var(--on-primary)' : 'var(--on-surface-variant)',
                }}
              >
                {m.icon} {m.label}
              </button>
            ))}
          </div>

          {/* Model picker */}
          <select
            className="input"
            value={activeModel}
            onChange={(e) => { setActiveModel(e.target.value); localStorage.setItem('activeModel', e.target.value); }}
            style={{ width: 160, fontSize: '0.75rem', padding: '6px 10px', borderRadius: 'var(--radius-full)' }}
          >
            {availableModels.length === 0 && <option value={activeModel}>{activeModel}</option>}
            {availableModels.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        {/* Mode description strip */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 12px', marginBottom: 12,
          borderRadius: 'var(--radius-md)', fontSize: '0.6875rem',
          background: 'var(--surface-container-lowest)',
          color: 'var(--on-surface-dim)',
        }}>
          <span style={{ color: 'var(--primary)' }}>{selectedModeInfo.icon}</span>
          <strong style={{ color: 'var(--on-surface-variant)', fontFamily: 'var(--font-display)' }}>{selectedModeInfo.label}</strong>
          <span>—</span>
          <span>{selectedModeInfo.desc}</span>
          {retrievalMode !== 'auto' && (
            <span>
              · Type <code style={{ fontFamily: 'var(--font-mono)', background: 'var(--surface-container)', padding: '1px 4px', borderRadius: 4 }}>@note</code> to scope to a specific note.
            </span>
          )}
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0, paddingRight: 8 }}>
          {history.length === 0 && (
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              justifyContent: 'center', alignItems: 'center',
              color: 'var(--on-surface-dim)', textAlign: 'center',
            }}>
              <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 8 }}>Ask your Second Brain</h2>
              <p style={{ maxWidth: 400, fontSize: '0.875rem' }}>
                Ask questions about your notes. Your AI companion synthesizes answers from your own knowledge.
              </p>
              <p style={{ fontSize: '0.8125rem', marginTop: 12, color: 'var(--primary)' }}>
                Type <strong>@</strong> to reference a specific note.
              </p>
            </div>
          )}

          {history.map((msg, idx) => (
            <div key={idx} style={{
              display: 'flex', gap: 12,
              flexDirection: msg.type === 'user' ? 'row-reverse' : 'row',
              maxWidth: '88%',
              alignSelf: msg.type === 'user' ? 'flex-end' : 'flex-start',
            }}>
              {/* Avatar */}
              {msg.type === 'ai' && (
                <div style={{
                  width: 28, height: 28, borderRadius: 'var(--radius-md)', flexShrink: 0,
                  background: 'linear-gradient(135deg, var(--primary-container), var(--primary))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Sparkles size={13} style={{ color: 'var(--on-primary)' }} />
                </div>
              )}

              <div style={{
                padding: '12px 16px',
                borderRadius: msg.type === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                background: msg.type === 'user'
                  ? 'linear-gradient(135deg, var(--surface-container-high), var(--surface-container-highest))'
                  : 'var(--surface-container)',
                color: 'var(--on-surface)',
                fontSize: '0.875rem', lineHeight: 1.65,
                minWidth: 0,
              }}>
                {/* AI header: model badge + confidence */}
                {msg.type === 'ai' && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    marginBottom: 8, fontSize: '0.6875rem', flexWrap: 'wrap',
                  }}>
                    <span style={{
                      padding: '1px 6px', borderRadius: 'var(--radius-sm)',
                      background: 'var(--surface-container-highest)',
                      color: 'var(--on-surface-dim)', fontFamily: 'var(--font-display)',
                      fontWeight: 600, fontSize: '0.5625rem', textTransform: 'uppercase',
                      letterSpacing: '0.08em',
                    }}>
                      Second Brain AI
                    </span>
                    <ConfidenceBadge value={msg.confidence} />
                    {msg.retrieval_explanation && (
                      <span
                        title={msg.retrieval_explanation}
                        style={{
                          color: 'var(--on-surface-dim)', cursor: 'help',
                          display: 'flex', alignItems: 'center', gap: 3,
                        }}
                      >
                        <Info size={10} />
                        <span style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {msg.retrieval_explanation}
                        </span>
                      </span>
                    )}
                  </div>
                )}

                <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>

                {/* Citation chips */}
                {msg.sources && msg.sources.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.625rem', color: 'var(--on-surface-dim)', alignSelf: 'center', fontFamily: 'var(--font-display)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Sources:
                    </span>
                    {msg.sources.map((s: any, i: number) => (
                      <Link
                        key={i}
                        to={`/notes/${s.id}`}
                        title={s.snippet || s.title}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          padding: '3px 8px', borderRadius: 'var(--radius-full)',
                          background: 'var(--surface-container-low)',
                          color: 'var(--primary)', fontSize: '0.6875rem',
                          textDecoration: 'none', transition: 'all 160ms',
                          border: '1px solid var(--outline-variant)',
                          fontFamily: 'var(--font-display)', fontWeight: 500,
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--primary-dim)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface-container-low)'; }}
                      >
                        <ExternalLink size={9} />
                        [{i + 1}] {s.title}
                        {s.similarity != null && (
                          <span style={{ fontSize: '0.5625rem', color: 'var(--on-surface-dim)', fontFamily: 'var(--font-mono)' }}>
                            {Math.round(s.similarity * 100)}%
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                )}

                {/* Fallback suggestion when confidence is very low */}
                {msg.type === 'ai' && msg.confidence != null && msg.confidence < 0.15 && !msg.sources?.length && (
                  <div style={{
                    marginTop: 12, padding: '8px 12px', borderRadius: 'var(--radius-md)',
                    background: 'var(--tertiary-container)',
                    fontSize: '0.75rem', color: 'var(--on-surface-variant)',
                    borderLeft: '2px solid var(--tertiary)',
                  }}>
                    <strong>Tip:</strong> No notes matched this query. Try importing the source, or ask with <strong>@note-title</strong> to scope to a specific note.
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{
                width: 28, height: 28, borderRadius: 'var(--radius-md)', flexShrink: 0,
                background: 'linear-gradient(135deg, var(--primary-container), var(--primary))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Sparkles size={13} style={{ color: 'var(--on-primary)' }} />
              </div>
              <div style={{
                padding: '12px 16px', borderRadius: '16px 16px 16px 4px',
                background: 'var(--surface-container)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: 'var(--primary)', animation: 'pulse 1s infinite',
                }} />
                <span style={{ fontSize: '0.8125rem', color: 'var(--on-surface-dim)' }}>Thinking...</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {/* Input Area */}
        <div style={{ position: 'relative', marginTop: 16, flexShrink: 0 }}>
          {/* @mention popover */}
          {mentionOpen && (
            <div className="glass-panel" style={{
              position: 'absolute', bottom: '100%', left: 0, width: 300,
              maxHeight: 200, overflowY: 'auto', padding: 8, marginBottom: 8,
              zIndex: 100,
            }}>
              {filteredNotes.length === 0 && (
                <p style={{ fontSize: '0.75rem', color: 'var(--on-surface-dim)', padding: 8 }}>No notes found</p>
              )}
              {filteredNotes.map((n) => (
                <button
                  key={n.id}
                  onClick={() => selectNote(n.title)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectNote(n.title); } }}
                  aria-label={`Reference note: ${n.title}`}
                  style={{
                    padding: '6px 8px', cursor: 'pointer', borderRadius: 'var(--radius-sm)',
                    fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: 6,
                    transition: 'background 200ms', background: 'transparent',
                    border: 'none', color: 'inherit', width: '100%', textAlign: 'left',
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--surface-variant)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <FileText size={12} style={{ color: 'var(--on-surface-dim)', flexShrink: 0 }} />
                  {n.title}
                </button>
              ))}
            </div>
          )}

          <div style={{
            display: 'flex', alignItems: 'flex-end', gap: 12,
            background: 'var(--surface-container-lowest)',
            borderRadius: 'var(--radius-lg)', padding: '12px 16px',
          }}>
            <textarea
              ref={textareaRef}
              value={question}
              onChange={handleInputChange}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAsk(); } }}
              placeholder={
                retrievalMode === 'search_only'
                  ? 'Search your notes...'
                  : retrievalMode === 'strict_cited'
                  ? 'Ask — I\'ll only answer from your notes...'
                  : 'Ask anything, or type @ to target a note...'
              }
              rows={1}
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                color: 'var(--on-surface)', fontSize: '0.875rem',
                fontFamily: 'var(--font-body)', resize: 'none',
                minHeight: 24, maxHeight: 120, lineHeight: 1.5,
              }}
            />
            <button
              className="btn"
              onClick={handleAsk}
              disabled={loading || !question.trim()}
              style={{ width: 36, height: 36, padding: 0, borderRadius: 'var(--radius-full)' }}
            >
              <Send size={16} />
            </button>
          </div>

          <div style={{
            textAlign: 'center', marginTop: 8,
            fontSize: '0.5625rem', letterSpacing: '0.2em',
            textTransform: 'uppercase', color: 'var(--on-surface-dim)',
            fontFamily: 'var(--font-display)',
          }}>
            Second Brain AI · {selectedModeInfo.label} mode
          </div>
        </div>
      </div>

      {/* ═══ Grounding Sources Panel (Right) ═══ */}
      {latestSources.length > 0 && (
        <div style={{
          width: 280, minWidth: 280, marginLeft: 20,
          background: 'var(--surface-container-lowest)',
          borderRadius: 'var(--radius-lg)', padding: 16,
          overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ color: 'var(--secondary)' }}>◎</span>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.875rem' }}>
                Grounding Sources
              </span>
            </div>
            <span className="label-xs" style={{ color: 'var(--secondary)' }}>
              {latestSources.length} found
            </span>
          </div>

          {latestSources.map((source: any, idx: number) => (
            <div key={idx} style={{
              padding: 12, borderRadius: 'var(--radius-md)',
              background: 'var(--surface-container)',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
              }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 18, height: 18, borderRadius: 'var(--radius-sm)',
                  background: 'var(--secondary-dim)',
                  color: 'var(--secondary)', fontSize: '0.625rem',
                  fontFamily: 'var(--font-mono)', fontWeight: 700,
                }}>[{idx + 1}]</span>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.8125rem' }}>
                  {source.title}
                </span>
              </div>

              {source.snippet && (
                <div style={{
                  padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--surface-container-low)',
                  borderLeft: '2px solid var(--primary)',
                  fontSize: '0.75rem', color: 'var(--on-surface-variant)',
                  lineHeight: 1.5, fontStyle: 'italic',
                }}>
                  "{source.snippet}"
                </div>
              )}

              <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', marginTop: 8,
                fontSize: '0.625rem', color: 'var(--on-surface-dim)',
                fontFamily: 'var(--font-mono)',
              }}>
                {source.similarity != null && <span>Relevance: {Math.round(source.similarity * 100)}%</span>}
                <Link to={`/notes/${source.id}`} style={{ color: 'var(--primary)', marginLeft: 'auto' }}>
                  <ExternalLink size={11} />
                </Link>
              </div>
            </div>
          ))}

          {/* Neural link synthesis */}
          <div style={{
            padding: 16, borderRadius: 'var(--radius-md)',
            background: 'var(--secondary-container)',
            marginTop: 'auto',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Sparkles size={14} style={{ color: 'var(--secondary)' }} />
              <span className="label-sm" style={{ color: 'var(--secondary)' }}>Synthesis Insight</span>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)', lineHeight: 1.5, marginBottom: 12 }}>
              AI identified semantic overlap between these sources. Would you like to create a bidirectional link?
            </p>
            <button className="btn-secondary" style={{ width: '100%', fontSize: '0.75rem' }}>
              Execute Neural Link
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
