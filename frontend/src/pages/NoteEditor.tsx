import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BlockEditor } from '../components/BlockEditor';
import { VoiceMemo } from '../components/VoiceMemo';
import { Save, Maximize2, Minimize2, Sparkles, Tag, Mic } from 'lucide-react';

interface Template {
  id: number;
  name: string;
  icon: string;
  title_template: string;
  content_template: string;
}

export default function NoteEditor() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [isTagging, setIsTagging] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const templateTitle = sessionStorage.getItem('templateTitle');
    const templateContent = sessionStorage.getItem('templateContent');
    if (templateTitle !== null) { setTitle(templateTitle); sessionStorage.removeItem('templateTitle'); }
    if (templateContent !== null) { setContent(templateContent); sessionStorage.removeItem('templateContent'); }
    fetch('http://localhost:8000/api/templates').then(res => res.json()).then(setTemplates).catch(console.error);
  }, []);

  const handleAutoTag = async () => {
    if (!title && !content) return;
    setIsTagging(true);
    try {
      const res = await fetch('http://localhost:8000/api/notes/suggest-tags', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, model: localStorage.getItem('activeModel') || 'qwen2.5:0.5b' }),
      });
      if (res.ok) {
        const suggestedTags = await res.json();
        if (suggestedTags && suggestedTags.length > 0) {
          setTags(tags ? `${tags}, ${suggestedTags.join(', ')}` : suggestedTags.join(', '));
        }
      }
    } catch (e) { console.error(e); }
    finally { setIsTagging(false); }
  };

  const handleApplyTemplate = async () => {
    if (!selectedTemplateId) return;
    try {
      const res = await fetch(`http://localhost:8000/api/templates/${selectedTemplateId}/apply`);
      if (res.ok) {
        const data = await res.json();
        if (!title) setTitle(data.title || '');
        if (!content) setContent(data.content || '');
        else setContent(prev => `${prev.trim()}\n\n${data.content || ''}`);
      }
    } catch (e) { console.error(e); }
  };

  const handleSave = async () => {
    const payload = { title, content, tags: tags.split(',').map(t => t.trim()).filter(t => t) };
    try {
      const res = await fetch('http://localhost:8000/api/notes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) navigate('/notes');
      else console.error('Save failed', await res.text());
    } catch (err) { console.error(err); }
  };

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;

  return (
    <div style={{
      position: isFocusMode ? 'fixed' : 'relative',
      inset: isFocusMode ? 0 : 'auto',
      zIndex: isFocusMode ? 1000 : 'auto',
      background: isFocusMode ? 'var(--surface)' : 'transparent',
      padding: isFocusMode ? 32 : 0,
      display: 'flex', flexDirection: 'column', height: '100%',
    }}>
      {/* Top Bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 20, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!isFocusMode && (
            <>
              <span style={{ fontSize: '0.75rem', color: 'var(--on-surface-dim)' }}>■</span>
              <span style={{ fontSize: '0.8125rem', color: 'var(--on-surface-dim)' }}>Vault</span>
              <span style={{ fontSize: '0.8125rem', color: 'var(--on-surface-dim)', opacity: 0.4 }}>›</span>
              <span style={{ fontSize: '0.8125rem', color: 'var(--on-surface)' }}>New Note</span>
            </>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn-ghost"
            onClick={() => setIsFocusMode(!isFocusMode)}
          >
            {isFocusMode ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            {isFocusMode ? 'Exit Focus' : 'Focus'}
          </button>
          <button
            className="btn"
            onClick={handleSave}
            disabled={!title.trim() || !content.trim()}
          >
            <Save size={14} /> Save Note
          </button>
        </div>
      </div>

      {/* Editor Content */}
      <div style={{ flex: 1, overflowY: 'auto', maxWidth: 720 }}>
        {/* Title */}
        <input
          type="text"
          placeholder="Note Title"
          value={title}
          onChange={e => setTitle(e.target.value)}
          style={{
            width: '100%', border: 'none', outline: 'none',
            background: 'transparent', color: 'var(--on-surface)',
            fontFamily: 'var(--font-display)', fontSize: '2rem',
            fontWeight: 700, letterSpacing: '-0.03em',
            marginBottom: 20,
          }}
        />

        {/* Template + Tag row */}
        <div style={{
          display: 'flex', gap: 8, alignItems: 'center',
          marginBottom: 16, flexWrap: 'wrap',
        }}>
          <select
            className="input"
            value={selectedTemplateId}
            onChange={e => setSelectedTemplateId(e.target.value)}
            style={{
              width: 180, fontSize: '0.75rem', padding: '6px 10px',
              borderRadius: 'var(--radius-full)',
            }}
          >
            <option value="">Template...</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <button className="btn-ghost" onClick={handleApplyTemplate} disabled={!selectedTemplateId} style={{ fontSize: '0.75rem' }}>
            Apply
          </button>

          <div style={{ width: 1, height: 20, background: 'var(--outline)', margin: '0 4px' }} />

          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, flex: 1,
            background: 'var(--surface-container-lowest)',
            borderRadius: 'var(--radius-full)', padding: '6px 12px',
          }}>
            <Tag size={13} style={{ color: 'var(--on-surface-dim)', flexShrink: 0 }} />
            <input
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="Tags (comma separated)"
              style={{
                background: 'transparent', border: 'none', outline: 'none',
                color: 'var(--on-surface)', fontSize: '0.75rem',
                fontFamily: 'var(--font-body)', width: '100%',
              }}
            />
          </div>

          <button
            className="btn-ghost"
            onClick={handleAutoTag}
            disabled={isTagging || (!title && !content)}
            style={{ fontSize: '0.75rem' }}
          >
            <Sparkles size={13} style={{ color: 'var(--secondary)' }} />
            {isTagging ? 'Tagging...' : 'AI Tags'}
          </button>

          <VoiceMemo compact onTranscribed={text => setContent(prev => prev ? `${prev}\n\n${text}` : text)} />
        </div>

        {/* Block Editor */}
        <div style={{
          background: 'var(--surface-container-lowest)',
          borderRadius: 'var(--radius-lg)',
          padding: 20, minHeight: 400,
        }}>
          <BlockEditor value={content} onChange={val => setContent(val)} />
        </div>

        {/* Word count */}
        <div style={{
          textAlign: 'right', marginTop: 8,
          fontSize: '0.6875rem', color: 'var(--on-surface-dim)',
          fontFamily: 'var(--font-mono)',
        }}>
          {wordCount} words
        </div>
      </div>
    </div>
  );
}
