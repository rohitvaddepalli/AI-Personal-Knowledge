import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';

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
        .then(data => {
            if (Array.isArray(data)) setAvailableModels(data);
        })
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
        if (sessionId === id) {
            setHistory([]);
            setSessionId(null);
        }
        fetchSessions();
    } catch (e) {
        console.error(e);
    }
  };

  const renameSession = async (id: number, currentTitle: string) => {
    const newTitle = prompt('Rename chat to:', currentTitle || `Chat #${id}`);
    if (!newTitle) return;
    try {
        await fetch(`http://localhost:8000/api/chat/sessions/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title: newTitle })
        });
        fetchSessions();
    } catch (e) {
        console.error(e);
    }
  };

  const loadSession = async (id: number) => {
      setLoading(true);
      try {
          const res = await fetch(`http://localhost:8000/api/chat/sessions/${id}`);
          const data = await res.json();
          setHistory(data.messages.map((m: any) => ({ 
              type: m.role === 'user' ? 'user' : 'ai', 
              content: m.content 
          })));
          setSessionId(id);
      } finally {
          setLoading(false);
      }
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
            question: currentQuestion,
            session_id: sessionId,
            profile_context: localStorage.getItem('profileBio') || undefined,
            model: activeModel
        })
      });
      const data = await res.json();
      setHistory(prev => [...prev, { type: 'ai', content: data.answer, sources: data.sources }]);
      if (data.session_id) setSessionId(data.session_id);
      
      // Refresh sessions list
      fetch('http://localhost:8000/api/chat/sessions')
         .then(res => res.json())
         .then(setSessions);
    } catch (e: any) {
      setHistory(prev => [...prev, { type: 'ai', content: `Error: ${e.message}`, sources: [] }]);
    } finally {
      setLoading(false);
    }
  };

  const chatEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  useEffect(() => {
    if (!mentionOpen && textareaRef.current) {
        textareaRef.current.focus();
        // Move cursor to end
        const len = textareaRef.current.value.length;
        textareaRef.current.setSelectionRange(len, len);
    }
  }, [mentionOpen, question]);

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setQuestion(val);
    
    // Simple check for @ at the end
    const lastWord = val.split(/\s+/).pop() || '';
    if (lastWord.startsWith('@')) {
      setMentionOpen(true);
      setMentionFilter(lastWord.slice(1).toLowerCase());
    } else {
      setMentionOpen(false);
    }
  };

  const selectNote = (title: string) => {
    // Replace the last word (which is the partial mention) with the full title
    const words = question.split(/\s+/);
    words.pop(); 
    const newQuestion = [...words, `@${title} `].join(' ');
    setQuestion(newQuestion);
    setMentionOpen(false);
  };

  const filteredNotes = allNotes.filter(n => n.title.toLowerCase().includes(mentionFilter));

  return (
    <div style={{ display: 'flex', gap: '2rem', height: '100%' }}>
      {/* Sessions Sidebar */}
      <div style={{ width: '280px', borderRight: '1px solid var(--border-color)', paddingRight: '1.5rem', display: 'flex', flexDirection: 'column', height: '100%', flexShrink: 0 }}>
          <h3 className="mb-4">Recent Chats</h3>
          <button className="btn" onClick={() => { setHistory([]); setSessionId(null); }} style={{ marginBottom: '1rem', width: '100%' }}>+ New Chat</button>
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {sessions.map(s => (
                  <div 
                    key={s.id} 
                    onClick={() => loadSession(s.id)}
                    className="card" 
                    style={{ 
                        cursor: 'pointer', 
                        padding: '0.8rem', 
                        fontSize: '0.9rem', 
                        backgroundColor: sessionId === s.id ? 'var(--bg-highlight)' : 'transparent',
                        position: 'relative',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                    }}
                  >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                        {s.title || `Chat #${s.id}`}
                      </span>
                      <div style={{ display: 'flex', gap: '0.3rem', marginLeft: '0.5rem' }}>
                          <button 
                            onClick={(e) => { e.stopPropagation(); renameSession(s.id, s.title); }}
                            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2 }}
                            title="Rename"
                          >
                            ✏️
                          </button>
                          <button 
                            onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                            style={{ background: 'transparent', border: 'none', color: '#ff4444', cursor: 'pointer', padding: 2 }}
                            title="Delete"
                          >
                            🗑
                          </button>
                      </div>
                  </div>
              ))}
          </div>
      </div>

      {/* Chat Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: 0, paddingRight: '0.5rem' }}>
          {history.length === 0 && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)', textAlign: 'center' }}>
              <h2 className="font-serif mb-2">Ask your Second Brain</h2>
              <p className="max-w-md">Ask questions about your notes, connections, and ideas. Your AI companion will synthesize an answer from your own knowledge.</p>
              <p style={{ fontSize: '0.9rem', marginTop: '1rem' }} className="text-accent/80 font-medium">Type @ to reference a specific note.</p>
            </div>
          )}
          {history.map((msg, idx) => (
            <div key={idx} style={{ alignSelf: msg.type === 'user' ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
              <div className="card" style={{ 
                  padding: '1rem', 
                  borderRadius: msg.type === 'user' ? '1rem 1rem 0 1rem' : '1rem 1rem 1rem 0',
                  backgroundColor: msg.type === 'user' ? 'var(--accent-color)' : 'var(--surface-color)',
                  color: msg.type === 'user' ? 'white' : 'var(--text-main)',
                  border: msg.type === 'user' ? 'none' : '1px solid var(--border-color)'
              }}>
                <div style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                {msg.sources && msg.sources.length > 0 && (
                    <div style={{ marginTop: '0.8rem', paddingTop: '0.8rem', borderTop: '1px solid rgba(128,128,128,0.3)', fontSize: '0.85rem' }}>
                        <strong>Sources:</strong>
                        <ul style={{ paddingLeft: '1.2rem', marginTop: '0.3rem' }}>
                            {msg.sources.map((s: any, i: number) => (
                                <li key={i}>
                                    <Link to={`/notes/${s.id}`} style={{ color: 'inherit', textDecoration: 'underline' }}>{s.title}</Link>
                                    <span style={{ opacity: 0.7 }}> (sim: {s.similarity.toFixed(2)})</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ alignSelf: 'flex-start' }}>
              <div className="card" style={{ padding: '0.8rem 1.2rem', borderRadius: '1rem 1rem 1rem 0.2rem', backgroundColor: 'var(--surface-color)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ width: '8px', height: '8px', backgroundColor: 'var(--accent-color)', borderRadius: '50%', animation: 'pulse 1s infinite' }}></span>
                  Thinking...
                </span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', position: 'relative', flexShrink: 0 }}>
          {mentionOpen && (
            <div className="card" style={{ 
              position: 'absolute', 
              bottom: '100%', 
              left: '0', 
              width: '300px', 
              maxHeight: '200px', 
              overflowY: 'auto', 
              zIndex: 100,
              padding: '0.5rem',
              backgroundColor: 'var(--surface-color)',
              color: 'var(--text-main)',
              boxShadow: '0 -4px 12px rgba(0,0,0,0.5)',
              marginBottom: '0.5rem'
            }}>
              {filteredNotes.length === 0 && <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No notes found</p>}
              {filteredNotes.map(n => (
                <div 
                  key={n.id} 
                  onClick={() => selectNote(n.title)}
                  style={{ 
                    padding: '0.5rem', 
                    cursor: 'pointer', 
                    borderRadius: '4px',
                    fontSize: '0.9rem'
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-highlight)'}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  📄 {n.title}
                </div>
              ))}
            </div>
          )}
          
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', width: '100%' }}>
             <select 
                className="input" 
                value={activeModel} 
                onChange={e => {
                    setActiveModel(e.target.value);
                    localStorage.setItem('activeModel', e.target.value);
                }}
                style={{ marginBottom: 0, width: '150px', backgroundColor: 'var(--surface-color)' }}
            >
                {availableModels.length === 0 && <option value={activeModel}>{activeModel}</option>}
                {availableModels.map(m => (
                    <option key={m} value={m}>{m}</option>
                ))}
            </select>
            <div style={{ flex: 1, position: 'relative' }}>
                <textarea 
                  ref={textareaRef}
                  className="input" 
                  value={question} 
                  onChange={handleInputChange} 
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAsk();
                    }
                  }}
                  placeholder="What do I know about... (Use @ to reference notes)" 
                  style={{ 
                    marginBottom: 0, 
                    width: '100%', 
                    minHeight: '100px', 
                    resize: 'none', 
                    padding: '1rem',
                    backgroundColor: 'var(--bg-base)',
                    color: 'var(--text-main)',
                    fontSize: '1rem'
                  }}
                />
            </div>
            <button 
              className="btn" 
              onClick={handleAsk} 
              disabled={loading || !question.trim()}
              style={{ height: '60px', alignSelf: 'flex-end', padding: '0 1.5rem' }}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
