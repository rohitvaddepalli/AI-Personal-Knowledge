import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BlockEditor } from '../components/BlockEditor';

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
    // Check for template data from Templates page
    const templateTitle = sessionStorage.getItem('templateTitle');
    const templateContent = sessionStorage.getItem('templateContent');
    if (templateTitle !== null) {
      setTitle(templateTitle);
      sessionStorage.removeItem('templateTitle');
    }
    if (templateContent !== null) {
      setContent(templateContent);
      sessionStorage.removeItem('templateContent');
    }

    // Fetch templates from API
    fetch('http://localhost:8000/api/templates')
      .then(res => res.json())
      .then(setTemplates)
      .catch(console.error);
  }, []);

  const handleAutoTag = async () => {
    if (!title && !content) return;
    setIsTagging(true);
    try {
      const res = await fetch('http://localhost:8000/api/notes/suggest-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          content,
          model: localStorage.getItem('activeModel') || 'qwen2.5:0.5b'
        }),
      });
      if (res.ok) {
        const suggestedTags = await res.json();
        if (suggestedTags && suggestedTags.length > 0) {
          const newTags = tags ? `${tags}, ${suggestedTags.join(', ')}` : suggestedTags.join(', ');
          setTags(newTags);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsTagging(false);
    }
  };

  const handleApplyTemplate = async () => {
    if (!selectedTemplateId) return;
    try {
      const res = await fetch(`http://localhost:8000/api/templates/${selectedTemplateId}/apply`);
      if (res.ok) {
        const data = await res.json();
        if (!title) {
          setTitle(data.title || '');
        }
        if (!content) {
          setContent(data.content || '');
        } else {
          setContent(prev => `${prev.trim()}\n\n${data.content || ''}`);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSave = async () => {
    const payload = {
      title,
      content,
      tags: tags.split(',').map(t => t.trim()).filter(t => t),
    };

    try {
      const res = await fetch('http://localhost:8000/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        navigate('/notes');
      } else {
        console.error('Failed to save', await res.text());
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ display: isFocusMode ? 'none' : 'block' }}>Create Note</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="btn"
            onClick={() => setIsFocusMode(!isFocusMode)}
            style={{
              backgroundColor: isFocusMode ? 'var(--accent-color)' : 'var(--surface-color)',
              color: isFocusMode ? 'var(--bg-base)' : 'var(--text-main)',
              border: isFocusMode ? 'none' : '1px solid var(--border-color)'
            }}
          >
            {isFocusMode ? '⛶ Exit Focus' : '⛶ Focus Mode'}
          </button>
          <button onClick={handleSave} className="btn" disabled={!title.trim() || !content.trim()}>
            Save Note
          </button>
        </div>
      </div>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        position: isFocusMode ? 'fixed' : 'relative',
        top: isFocusMode ? 0 : 'auto',
        left: isFocusMode ? 0 : 'auto',
        right: isFocusMode ? 0 : 'auto',
        bottom: isFocusMode ? 0 : 'auto',
        zIndex: isFocusMode ? 1000 : 'auto',
        backgroundColor: 'var(--bg-color)',
        padding: isFocusMode ? '2rem' : 0,
      }}>
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <input
            className="input"
            type="text"
            placeholder="Note Title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            style={{ fontSize: '1.5rem', fontWeight: 'bold', flex: 1, backgroundColor: 'var(--bg-base)', color: 'var(--text-main)' }}
          />
          <select
            className="input"
            style={{ marginBottom: 0, width: '220px' }}
            value={selectedTemplateId}
            onChange={e => setSelectedTemplateId(e.target.value)}
          >
            <option value="">Template...</option>
            {templates.map(t => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button
            className="btn"
            onClick={handleApplyTemplate}
            disabled={!selectedTemplateId}
            style={{ whiteSpace: 'nowrap' }}
          >
            Apply
          </button>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <input
            className="input"
            type="text"
            placeholder="Tags (comma separated)"
            value={tags}
            onChange={e => setTags(e.target.value)}
            style={{ marginBottom: 0, flex: 1, backgroundColor: 'var(--bg-base)', color: 'var(--text-main)' }}
          />
          <button
            className="btn"
            onClick={handleAutoTag}
            disabled={isTagging || (!title && !content)}
            style={{ whiteSpace: 'nowrap' }}
          >
            {isTagging ? 'Tagging...' : 'Suggest Tags'}
          </button>
        </div>

        <div>
          <BlockEditor
            value={content}
            onChange={(val) => setContent(val)}
          />
          <div style={{ textAlign: 'right', color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
            {content.trim() ? content.trim().split(/\s+/).length : 0} words
          </div>
        </div>
      </div>
    </div>
  );
}
