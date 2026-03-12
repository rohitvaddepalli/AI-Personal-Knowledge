import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  created_at: string;
  deleted_at: string;
}

export default function Trash() {
  const [trashedNotes, setTrashedNotes] = useState<Note[]>([]);

  useEffect(() => {
    fetchTrashedNotes();
  }, []);

  const fetchTrashedNotes = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/notes/trash/');
      const data = await res.json();
      setTrashedNotes(data);
    } catch (e) {
      console.error(e);
    }
  };

  const restoreNote = async (id: string) => {
    try {
      const res = await fetch(`http://localhost:8000/api/notes/${id}/restore`, { method: 'POST' });
      if (res.ok) {
        fetchTrashedNotes();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const permanentDelete = async (id: string) => {
    if (!confirm('⚠️ This will permanently delete the note. Are you sure?')) return;
    try {
      const res = await fetch(`http://localhost:8000/api/notes/${id}/permanent`, { method: 'DELETE' });
      if (res.ok) {
        fetchTrashedNotes();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const emptyTrash = async () => {
    if (!confirm(`⚠️ This will permanently delete all ${trashedNotes.length} notes in trash. Are you sure?`)) return;
    for (const note of trashedNotes) {
      await fetch(`http://localhost:8000/api/notes/${note.id}/permanent`, { method: 'DELETE' });
    }
    fetchTrashedNotes();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>🗑️ Trash</h1>
        {trashedNotes.length > 0 && (
          <button className="btn" onClick={emptyTrash} style={{ backgroundColor: '#ff4444' }}>
            Empty Trash
          </button>
        )}
      </div>
      
      {trashedNotes.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '1.2rem' }}>Trash is empty</p>
          <p style={{ color: 'var(--text-muted)' }}>Deleted notes will appear here for 30 days before auto-removal</p>
          <Link to="/notes" className="btn" style={{ marginTop: '1rem', textDecoration: 'none' }}>
            Back to Notes
          </Link>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
          {trashedNotes.map(note => (
            <div key={note.id} className="card" style={{ position: 'relative', opacity: 0.7 }}>
              <h3 style={{ marginBottom: '0.5rem', paddingRight: '1rem' }}>{note.title}</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                {note.content.substring(0, 100)}...
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                {note.tags?.map(tag => (
                  <span key={tag} style={{ backgroundColor: 'var(--accent-color)', padding: '0.2rem 0.5rem', borderRadius: '1rem', fontSize: '0.8rem', opacity: 0.6 }}>
                    #{tag}
                  </span>
                ))}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                Deleted: {new Date(note.deleted_at).toLocaleString()}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn" onClick={() => restoreNote(note.id)} style={{ flex: 1 }}>
                  ♻️ Restore
                </button>
                <button 
                  className="btn" 
                  onClick={() => permanentDelete(note.id)}
                  style={{ backgroundColor: '#ff4444', flex: 1 }}
                >
                  🗑️ Delete Forever
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
