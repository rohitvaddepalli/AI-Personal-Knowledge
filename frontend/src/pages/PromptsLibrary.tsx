import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Copy, Play, Star, StarOff, Search, X } from 'lucide-react';

interface Prompt {
  id: string;
  name: string;
  description: string;
  content: string;
  category: string;
  isFavorite: boolean;
  createdAt: string;
  usageCount: number;
}

const STORAGE_KEY = 'sb_prompts_library';
const DEFAULT_PROMPTS: Prompt[] = [
  {
    id: 'default-1',
    name: 'Summarize in 5 bullets',
    description: 'Condense any text into 5 key bullet points',
    content: 'Please summarize the following text into exactly 5 concise bullet points, preserving the most important information:\n\n{{text}}',
    category: 'Summarization',
    isFavorite: true,
    createdAt: new Date().toISOString(),
    usageCount: 0,
  },
  {
    id: 'default-2',
    name: 'Explain like I\'m 5',
    description: 'Simplify complex concepts for beginners',
    content: 'Explain the following concept as if you\'re talking to a 5-year-old. Use simple words, analogies, and short sentences:\n\n{{text}}',
    category: 'Education',
    isFavorite: false,
    createdAt: new Date().toISOString(),
    usageCount: 0,
  },
  {
    id: 'default-3',
    name: 'Generate Action Items',
    description: 'Extract actionable tasks from meeting notes or content',
    content: 'Extract all action items, tasks, and next steps from the following text. Format them as a numbered list with owner (if mentioned) and deadline (if mentioned):\n\n{{text}}',
    category: 'Productivity',
    isFavorite: false,
    createdAt: new Date().toISOString(),
    usageCount: 0,
  },
  {
    id: 'default-4',
    name: 'Socratic Questions',
    description: 'Generate thought-provoking questions about a topic',
    content: 'Generate 7 Socratic questions about the following topic to deepen understanding and critical thinking:\n\n{{text}}',
    category: 'Learning',
    isFavorite: false,
    createdAt: new Date().toISOString(),
    usageCount: 0,
  },
  {
    id: 'default-5',
    name: 'Note → Tweet Thread',
    description: 'Transform a note into an engaging Twitter/X thread',
    content: 'Transform the following note into a compelling 5-tweet thread. Each tweet should be under 280 characters, start with a hook, and end with a clear takeaway:\n\n{{text}}',
    category: 'Content',
    isFavorite: false,
    createdAt: new Date().toISOString(),
    usageCount: 0,
  },
];

const CATEGORIES = ['All', 'Summarization', 'Education', 'Productivity', 'Learning', 'Content', 'Writing', 'Analysis', 'Custom'];

function loadPrompts(): Prompt[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_PROMPTS;
}

function savePrompts(prompts: Prompt[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prompts));
}

function PromptCard({
  prompt,
  onDelete,
  onToggleFavorite,
  onCopy,
  onRun,
}: {
  prompt: Prompt;
  onDelete: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onCopy: (content: string) => void;
  onRun: (prompt: Prompt) => void;
}) {
  return (
    <div
      className="card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        padding: '1.25rem',
        borderLeft: `3px solid ${prompt.isFavorite ? 'var(--accent-color)' : 'var(--border-color)'}`,
        transition: 'all 0.2s',
        position: 'relative',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderLeftColor = 'var(--accent-color)')}
      onMouseLeave={e => (e.currentTarget.style.borderLeftColor = prompt.isFavorite ? 'var(--accent-color)' : 'var(--border-color)')}
    >
      {/* Category badge */}
      <span style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', fontSize: '0.65rem', padding: '0.2rem 0.5rem', borderRadius: '8px', backgroundColor: 'var(--bg-highlight)', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}>
        {prompt.category}
      </span>

      <div>
        <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem', paddingRight: '4rem' }}>{prompt.name}</h3>
        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>{prompt.description}</p>
      </div>

      {/* Preview */}
      <div style={{
        fontSize: '0.8rem',
        color: 'var(--text-muted)',
        backgroundColor: 'var(--bg-highlight)',
        padding: '0.6rem 0.8rem',
        borderRadius: '8px',
        fontFamily: 'monospace',
        maxHeight: '80px',
        overflow: 'hidden',
        whiteSpace: 'pre-wrap',
        border: '1px solid var(--border-color)',
      }}>
        {prompt.content.substring(0, 150)}{prompt.content.length > 150 ? '...' : ''}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <button
          className="btn"
          onClick={() => onRun(prompt)}
          style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem', padding: '0.4rem 0.8rem', flex: 1 }}
        >
          <Play size={14} /> Use Prompt
        </button>
        <button
          onClick={() => onCopy(prompt.content)}
          title="Copy prompt text"
          style={{ background: 'var(--bg-highlight)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.4rem 0.6rem', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
        >
          <Copy size={14} />
        </button>
        <button
          onClick={() => onToggleFavorite(prompt.id)}
          title={prompt.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          style={{ background: 'var(--bg-highlight)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.4rem 0.6rem', cursor: 'pointer', color: prompt.isFavorite ? 'var(--accent-amber)' : 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
        >
          {prompt.isFavorite ? <Star size={14} fill="currentColor" /> : <StarOff size={14} />}
        </button>
        {!prompt.id.startsWith('default-') && (
          <button
            onClick={() => onDelete(prompt.id)}
            title="Delete prompt"
            style={{ background: 'transparent', border: '1px solid #ff444433', borderRadius: '8px', padding: '0.4rem 0.6rem', cursor: 'pointer', color: '#ff4444', display: 'flex', alignItems: 'center' }}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {prompt.usageCount > 0 && (
        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textAlign: 'right' }}>Used {prompt.usageCount}×</div>
      )}
    </div>
  );
}

function RunModal({
  prompt,
  onClose,
}: {
  prompt: Prompt;
  onClose: () => void;
}) {
  const [input, setInput] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const model = localStorage.getItem('activeModel') || 'qwen2.5:0.5b';
  const filled = prompt.content.replace(/\{\{text\}\}/g, input);

  const runPrompt = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setResult('');
    try {
      const res = await fetch('http://localhost:8000/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: filled, model }),
      });
      const data = await res.json();
      setResult(data.answer || data.result || '');
    } catch (e: any) {
      setResult(`Error: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
      <div style={{ backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>🪄 {prompt.name}</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
        </div>

        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>{prompt.description}</p>

        <div>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>Your text (replaces {'{{text}}'})</label>
          <textarea
            className="input"
            rows={6}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Paste or type your content here..."
            style={{ resize: 'vertical', fontFamily: 'inherit' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn" onClick={runPrompt} disabled={loading || !input.trim()} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <Play size={14} /> {loading ? 'Running...' : 'Run with AI'}
          </button>
          <button
            onClick={() => { navigator.clipboard.writeText(filled); }}
            style={{ background: 'var(--bg-highlight)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.5rem 1rem', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
          >
            <Copy size={14} /> Copy Filled Prompt
          </button>
        </div>

        {result && (
          <div style={{ backgroundColor: 'var(--bg-highlight)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '1rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>AI Result</div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-main)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{result}</div>
            <button
              onClick={() => navigator.clipboard.writeText(result)}
              style={{ marginTop: '0.75rem', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '0.3rem 0.6rem', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
            >
              <Copy size={12} /> Copy Result
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function AddPromptModal({ onSave, onClose }: { onSave: (p: Partial<Prompt>) => void; onClose: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('Custom');

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
      <div style={{ backgroundColor: 'var(--surface-color)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '1.5rem', width: '100%', maxWidth: '560px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Add New Prompt</h2>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
        </div>

        <input className="input" placeholder="Prompt name*" value={name} onChange={e => setName(e.target.value)} />
        <input className="input" placeholder="Short description" value={description} onChange={e => setDescription(e.target.value)} />
        <select className="input" value={category} onChange={e => setCategory(e.target.value)} style={{ marginBottom: 0 }}>
          {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <div>
          <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>Prompt template (use {'{{text}}'} as placeholder)</label>
          <textarea
            className="input"
            rows={6}
            value={content}
            onChange={e => setContent(e.target.value)}
            placeholder={'Example: Summarize the following:\n\n{{text}}'}
            style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '0.85rem' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ background: 'var(--bg-highlight)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.5rem 1rem', cursor: 'pointer', color: 'var(--text-muted)' }}>Cancel</button>
          <button className="btn" onClick={() => { if (name && content) onSave({ name, description, content, category }); }} disabled={!name || !content}>
            Save Prompt
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PromptsLibrary() {
  const [prompts, setPrompts] = useState<Prompt[]>(loadPrompts);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [showFavorites, setShowFavorites] = useState(false);
  const [runningPrompt, setRunningPrompt] = useState<Prompt | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => { savePrompts(prompts); }, [prompts]);

  const filtered = prompts.filter(p => {
    if (showFavorites && !p.isFavorite) return false;
    if (category !== 'All' && p.category !== category) return false;
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.description.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const addPrompt = useCallback((partial: Partial<Prompt>) => {
    const newPrompt: Prompt = {
      id: Date.now().toString(),
      name: partial.name!,
      description: partial.description || '',
      content: partial.content!,
      category: partial.category || 'Custom',
      isFavorite: false,
      createdAt: new Date().toISOString(),
      usageCount: 0,
    };
    setPrompts(prev => [newPrompt, ...prev]);
    setShowAdd(false);
  }, []);

  const deletePrompt = useCallback((id: string) => {
    if (confirm('Delete this prompt?')) setPrompts(prev => prev.filter(p => p.id !== id));
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setPrompts(prev => prev.map(p => p.id === id ? { ...p, isFavorite: !p.isFavorite } : p));
  }, []);

  const copyPrompt = useCallback((content: string) => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, []);

  const runPrompt = useCallback((prompt: Prompt) => {
    setPrompts(prev => prev.map(p => p.id === prompt.id ? { ...p, usageCount: p.usageCount + 1 } : p));
    setRunningPrompt(prompt);
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>Prompts Library</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>Reusable AI prompt templates for your knowledge work</p>
        </div>
        <button className="btn" onClick={() => setShowAdd(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Plus size={16} /> New Prompt
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '200px' }}>
          <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            className="input"
            style={{ marginBottom: 0, paddingLeft: '2.2rem' }}
            placeholder="Search prompts..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select className="input" value={category} onChange={e => setCategory(e.target.value)} style={{ marginBottom: 0, width: '150px' }}>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button
          onClick={() => setShowFavorites(f => !f)}
          style={{
            background: showFavorites ? 'var(--accent-amber)22' : 'var(--bg-highlight)',
            border: `1px solid ${showFavorites ? 'var(--accent-amber)' : 'var(--border-color)'}`,
            borderRadius: '8px', padding: '0.5rem 1rem', cursor: 'pointer',
            color: showFavorites ? 'var(--accent-amber)' : 'var(--text-muted)',
            display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.85rem'
          }}
        >
          <Star size={14} fill={showFavorites ? 'currentColor' : 'none'} /> Favorites
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: '0.3rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
        <span>{filtered.length} prompt{filtered.length !== 1 ? 's' : ''} shown</span>
        {copied && <span style={{ color: 'var(--accent-color)', marginLeft: '0.5rem' }}>✓ Copied!</span>}
      </div>

      {/* Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
        {filtered.map(prompt => (
          <PromptCard
            key={prompt.id}
            prompt={prompt}
            onDelete={deletePrompt}
            onToggleFavorite={toggleFavorite}
            onCopy={copyPrompt}
            onRun={runPrompt}
          />
        ))}
        {filtered.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
            No prompts found. Try a different filter or <button onClick={() => setShowAdd(true)} style={{ background: 'none', border: 'none', color: 'var(--accent-color)', cursor: 'pointer', textDecoration: 'underline' }}>add one</button>.
          </div>
        )}
      </div>

      {/* Modals */}
      {runningPrompt && <RunModal prompt={runningPrompt} onClose={() => setRunningPrompt(null)} />}
      {showAdd && <AddPromptModal onSave={addPrompt} onClose={() => setShowAdd(false)} />}
    </div>
  );
}
