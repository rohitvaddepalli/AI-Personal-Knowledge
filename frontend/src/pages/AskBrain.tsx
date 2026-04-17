import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Send, Paperclip, Sparkles, ExternalLink, MessageSquare, Trash2, Edit3, Plus } from 'lucide-react';

export default function AskBrain() {
  const [question, setQuestion] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [activeModel, setActiveModel] = useState(() => localStorage.getItem('activeModel') || 'qwen2.5:0.5b');
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [allNotes, setAllNotes] = useState<any[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionFilter, setMentionFilter] = useState('');
  const [latestSources, setLatestSources] = useState<any[]>([]);

  const fetchSessions = () => {
    fetch('http://localhost:8000/api/chat/sessions')
      .then(res => res.json())
      .then(data => setSessions(data))
      .catch(console.error);
  };

  useEffect(() => {
    fetchSessions();
    fetch('http://localhost:8000/api/ask/models')
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setAvailableModels(data); })
      .catch(console.error);
    fetch('http://localhost:8000/api/notes')
      .then(res => res.json())
      .then(setAllNotes)
      .catch(console.error);
  }, []);

  const deleteSession = async (id: number) => {
    if (!confirm('Delete this chat history?')) return;
    try {
      await fetch(`http://localhost:8000/api/chat/sessions/${id}`, { method: 'DELETE' });
      if (sessionId === id) { setHistory([]); setSessionId(null); setLatestSources([]); }
      fetchSessions();
    } catch (e) { console.error(e); }
  };

  const renameSession = async (id: number, currentTitle: string) => {
    const newTitle = prompt('Rename chat to:', currentTitle || `Chat #${id}`);
    if (!newTitle) return;
    try {
      await fetch(`http://localhost:8000/api/chat/sessions/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle })
      });
      fetchSessions();
    } catch (e) { console.error(e); }
  };

  const loadSession = async (id: number) => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:8000/api/chat/sessions/${id}`);
      const data = await res.json();
      setHistory(data.messages.map((m: any) => ({
        type: m.role === 'user' ? 'user' : 'ai', content: m.content
      })));
      setSessionId(id);
      setLatestSources([]);
    } finally { setLoading(false); }
  };

  const handleAsk = async () => {
    if (!question.trim()) return;
    setLoading(true);
    setHistory(prev => [...prev, { type: 'user', content: question }]);
    const currentQuestion = question;
    setQuestion('');
    setMentionOpen(false);

    try {
      const res = await fetch('http://localhost:8000/api/ask', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: currentQuestion, session_id: sessionId,
          profile_context: localStorage.getItem('profileBio') || undefined,
          model: activeModel
        })
      });
      const data = await res.json();
      setHistory(prev => [...prev, { type: 'ai', content: data.answer, sources: data.sources }]);
      if (data.session_id) setSessionId(data.session_id);
      if (data.sources) setLatestSources(data.sources);
      fetch('http://localhost:8000/api/chat/sessions').then(r => r.json()).then(setSessions);
    } catch (e: any) {
      setHistory(prev => [...prev, { type: 'ai', content: `Error: ${e.message}`, sources: [] }]);
    } finally { setLoading(false); }
  };

  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [history]);

  useEffect(() => {
    if (!mentionOpen && textareaRef.current) {
      textareaRef.current.focus();
      const len = textareaRef.current.value.length;
      textareaRef.current.setSelectionRange(len, len);
    }
  }, [mentionOpen, question]);

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

  const filteredNotes = allNotes.filter(n => n.title.toLowerCase().includes(mentionFilter));

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', padding: '24px 28px' }}>
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
          {sessions.map(s => (
            <div
              key={s.id}
              onClick={() => loadSession(s.id)}
              style={{
                padding: '8px 10px', borderRadius: 'var(--radius-md)',
                cursor: 'pointer', fontSize: '0.75rem',
                background: sessionId === s.id ? 'var(--primary-dim)' : 'transparent',
                color: sessionId === s.id ? 'var(--primary)' : 'var(--on-surface-variant)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                transition: 'all 200ms',
              }}
              onMouseEnter={e => { if (sessionId !== s.id) e.currentTarget.style.background = 'var(--surface-variant)'; }}
              onMouseLeave={e => { if (sessionId !== s.id) e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                <MessageSquare size={12} style={{ flexShrink: 0 }} />
                {s.title || `Chat #${s.id}`}
              </span>
              <div style={{ display: 'flex', gap: 2, marginLeft: 4, flexShrink: 0 }}>
                <button
                  onClick={e => { e.stopPropagation(); renameSession(s.id, s.title); }}
                  style={{ background: 'transparent', border: 'none', color: 'var(--on-surface-dim)', cursor: 'pointer', padding: 2 }}
                ><Edit3 size={10} /></button>
                <button
                  onClick={e => { e.stopPropagation(); deleteSession(s.id); }}
                  style={{ background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: 2 }}
                ><Trash2 size={10} /></button>
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
          <h2 style={{ fontFamily: 'var(--font-display)', flex: 1 }}>AI Chat</h2>
          <select
            className="input"
            value={activeModel}
            onChange={e => { setActiveModel(e.target.value); localStorage.setItem('activeModel', e.target.value); }}
            style={{ width: 160, fontSize: '0.75rem', padding: '6px 10px', borderRadius: 'var(--radius-full)' }}
          >
            {availableModels.length === 0 && <option value={activeModel}>{activeModel}</option>}
            {availableModels.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
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
                Type @ to reference a specific note.
              </p>
            </div>
          )}

          {history.map((msg, idx) => (
            <div key={idx} style={{
              display: 'flex', gap: 12,
              flexDirection: msg.type === 'user' ? 'row-reverse' : 'row',
              maxWidth: '85%',
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
              }}>
                {/* AI header badge */}
                {msg.type === 'ai' && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    marginBottom: 8, fontSize: '0.6875rem',
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
                    <span style={{ color: 'var(--on-surface-dim)' }}>Thinking complete</span>
                  </div>
                )}
                <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>

                {/* Source References inline */}
                {msg.sources && msg.sources.length > 0 && (
                  <div style={{
                    display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap',
                  }}>
                    {msg.sources.map((s: any, i: number) => (
                      <Link
                        key={i}
                        to={`/notes/${s.id}`}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          padding: '4px 8px', borderRadius: 'var(--radius-sm)',
                          background: 'var(--surface-container-low)',
                          color: 'var(--on-surface-dim)', fontSize: '0.6875rem',
                          textDecoration: 'none', transition: 'color 200ms',
                        }}
                      >
                        <ExternalLink size={10} />
                        {s.title}
                      </Link>
                    ))}
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
          {mentionOpen && (
            <div className="glass-panel" style={{
              position: 'absolute', bottom: '100%', left: 0, width: 300,
              maxHeight: 200, overflowY: 'auto', padding: 8, marginBottom: 8,
              zIndex: 100,
            }}>
              {filteredNotes.length === 0 && (
                <p style={{ fontSize: '0.75rem', color: 'var(--on-surface-dim)', padding: 8 }}>No notes found</p>
              )}
              {filteredNotes.map(n => (
                <div
                  key={n.id}
                  onClick={() => selectNote(n.title)}
                  style={{
                    padding: '6px 8px', cursor: 'pointer', borderRadius: 'var(--radius-sm)',
                    fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: 6,
                    transition: 'background 200ms',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-variant)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <FileText size={12} style={{ color: 'var(--on-surface-dim)', flexShrink: 0 }} />
                  {n.title}
                </div>
              ))}
            </div>
          )}

          <div style={{
            display: 'flex', alignItems: 'flex-end', gap: 12,
            background: 'var(--surface-container-lowest)',
            borderRadius: 'var(--radius-lg)', padding: '12px 16px',
          }}>
            <button style={{
              background: 'transparent', border: 'none',
              color: 'var(--on-surface-dim)', cursor: 'pointer', padding: 4,
            }}>
              <Paperclip size={18} />
            </button>
            <textarea
              ref={textareaRef}
              value={question}
              onChange={handleInputChange}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAsk(); } }}
              placeholder="Deepen your thoughts..."
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
              style={{
                width: 36, height: 36, padding: 0,
                borderRadius: 'var(--radius-full)',
              }}
            >
              <Send size={16} />
            </button>
          </div>

          {/* Footer */}
          <div style={{
            textAlign: 'center', marginTop: 8,
            fontSize: '0.5625rem', letterSpacing: '0.2em',
            textTransform: 'uppercase', color: 'var(--on-surface-dim)',
            fontFamily: 'var(--font-display)',
          }}>
            Second Brain AI
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
              {latestSources.length} ENTITIES FOUND
            </span>
          </div>

          {latestSources.map((source: any, idx: number) => (
            <div key={idx} style={{
              padding: 12, borderRadius: 'var(--radius-md)',
              background: 'var(--surface-container)',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                marginBottom: 8,
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: 'var(--secondary)',
                }} />
                <span style={{
                  fontFamily: 'var(--font-display)', fontWeight: 600,
                  fontSize: '0.8125rem',
                }}>
                  {source.title}
                </span>
              </div>

              <div style={{
                padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                background: 'var(--surface-container-low)',
                borderLeft: '2px solid var(--primary)',
                fontSize: '0.75rem', color: 'var(--on-surface-variant)',
                lineHeight: 1.5, fontStyle: 'italic',
              }}>
                "{source.content?.substring(0, 150) || 'Related content found...'}"
              </div>

              <div style={{
                display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', marginTop: 8,
                fontSize: '0.625rem', color: 'var(--on-surface-dim)',
                fontFamily: 'var(--font-mono)',
              }}>
                <span>Similarity: {source.similarity?.toFixed(2) || 'N/A'}</span>
                <Link to={`/notes/${source.id}`} style={{ color: 'var(--on-surface-dim)' }}>
                  <ExternalLink size={11} />
                </Link>
              </div>
            </div>
          ))}

          {/* Synthesis Insight Card */}
          <div style={{
            padding: 16, borderRadius: 'var(--radius-md)',
            background: 'var(--secondary-container)',
            marginTop: 'auto',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
            }}>
              <Sparkles size={14} style={{ color: 'var(--secondary)' }} />
              <span className="label-sm" style={{ color: 'var(--secondary)' }}>
                Synthesis Insight
              </span>
            </div>
            <p style={{
              fontSize: '0.8125rem', color: 'var(--on-surface-variant)', lineHeight: 1.5, marginBottom: 12,
            }}>
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

// Mini FileText icon for mention list (avoid unused import warning)
function FileText(props: any) {
  return (
    <svg width={props.size || 16} height={props.size || 16} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      style={props.style}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}
