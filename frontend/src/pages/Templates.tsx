import { useEffect, useState } from 'react';

interface Template {
  id: number;
  name: string;
  description: string;
  icon: string;
  title_template: string;
  content_template: string;
  is_builtin: number;
  created_at: string;
}

export default function Templates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    description: '',
    icon: '📝',
    title_template: '',
    content_template: ''
  });

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/templates');
      const data = await res.json();
      setTemplates(data);
    } catch (e) {
      console.error(e);
    }
  };

  const createTemplate = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTemplate)
      });
      if (res.ok) {
        setShowCreate(false);
        setNewTemplate({ name: '', description: '', icon: '📝', title_template: '', content_template: '' });
        fetchTemplates();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const deleteTemplate = async (id: number, isBuiltin: number) => {
    if (isBuiltin) {
      alert('Cannot delete built-in templates');
      return;
    }
    if (!confirm('Delete this template?')) return;
    try {
      await fetch(`http://localhost:8000/api/templates/${id}`, { method: 'DELETE' });
      fetchTemplates();
    } catch (e) {
      console.error(e);
    }
  };

  const useTemplate = async (template: Template) => {
    try {
      const res = await fetch(`http://localhost:8000/api/templates/${template.id}/apply`);
      if (res.ok) {
        const data = await res.json();
        // Store in sessionStorage and navigate to new note
        sessionStorage.setItem('templateTitle', data.title);
        sessionStorage.setItem('templateContent', data.content);
        window.location.href = '/notes/new';
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>📝 Templates</h1>
        <button className="btn" onClick={() => setShowCreate(true)}>
          + New Template
        </button>
      </div>

      {showCreate && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <h3>Create New Template</h3>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <input
              className="input"
              placeholder="Template Name"
              value={newTemplate.name}
              onChange={e => setNewTemplate({...newTemplate, name: e.target.value})}
              style={{ flex: 2, marginBottom: 0 }}
            />
            <input
              className="input"
              placeholder="Icon (emoji)"
              value={newTemplate.icon}
              onChange={e => setNewTemplate({...newTemplate, icon: e.target.value})}
              style={{ flex: 1, marginBottom: 0 }}
            />
          </div>
          <input
            className="input"
            placeholder="Description"
            value={newTemplate.description}
            onChange={e => setNewTemplate({...newTemplate, description: e.target.value})}
            style={{ marginBottom: 0 }}
          />
          <input
            className="input"
            placeholder="Title Template (use {{date}}, {{time}}, {{datetime}})"
            value={newTemplate.title_template}
            onChange={e => setNewTemplate({...newTemplate, title_template: e.target.value})}
            style={{ marginBottom: 0 }}
          />
          <textarea
            className="input"
            placeholder="Content Template (Markdown supported. Use {{date}}, {{time}}, {{datetime}})"
            value={newTemplate.content_template}
            onChange={e => setNewTemplate({...newTemplate, content_template: e.target.value})}
            rows={8}
            style={{ marginBottom: 0, fontFamily: 'monospace' }}
          />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn" onClick={createTemplate} disabled={!newTemplate.name || !newTemplate.content_template}>
              Create Template
            </button>
            <button className="btn" onClick={() => setShowCreate(false)} style={{ backgroundColor: 'var(--surface-color)' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
        {templates.map(tmpl => (
          <div key={tmpl.id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '2rem' }}>{tmpl.icon}</span>
              <div>
                <h3 style={{ margin: 0 }}>{tmpl.name}</h3>
                {tmpl.is_builtin ? (
                  <span style={{ fontSize: '0.75rem', color: 'var(--accent-color)' }}>Built-in</span>
                ) : (
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Custom</span>
                )}
              </div>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem', flex: 1 }}>
              {tmpl.description || 'No description'}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn" onClick={() => useTemplate(tmpl)} style={{ flex: 1 }}>
                Use Template
              </button>
              {!tmpl.is_builtin && (
                <button 
                  className="btn" 
                  onClick={() => deleteTemplate(tmpl.id, tmpl.is_builtin)}
                  style={{ backgroundColor: '#ff4444' }}
                >
                  🗑
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
