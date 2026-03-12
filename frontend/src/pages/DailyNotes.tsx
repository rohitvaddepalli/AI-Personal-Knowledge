import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import MDEditor from '@uiw/react-md-editor';

interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  created_at: string;
}

export default function DailyNotes() {
  const [todayNote, setTodayNote] = useState<Note | null>(null);
  const [allDailyNotes, setAllDailyNotes] = useState<Note[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');

  useEffect(() => {
    fetchTodayNote();
    fetchAllDailyNotes();
  }, []);

  const fetchTodayNote = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/notes/daily/today');
      const data = await res.json();
      setTodayNote(data);
      setEditContent(data.content);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAllDailyNotes = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/notes/daily/');
      const data = await res.json();
      setAllDailyNotes(data);
    } catch (e) {
      console.error(e);
    }
  };

  const saveTodayNote = async () => {
    if (!todayNote) return;
    try {
      const res = await fetch(`http://localhost:8000/api/notes/${todayNote.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: editContent }),
      });
      if (res.ok) {
        setIsEditing(false);
        fetchTodayNote();
        fetchAllDailyNotes();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString();
  };

  return (
    <div style={{ display: 'flex', gap: '2rem', height: '100%' }}>
      {/* Sidebar with daily notes list */}
      <div style={{ flex: 1, maxWidth: '300px', borderRight: '1px solid var(--border-color)', paddingRight: '1rem', overflowY: 'auto' }}>
        <h2 style={{ marginBottom: '1rem' }}>📓 Daily Notes</h2>
        <button 
          className="btn" 
          onClick={fetchTodayNote}
          style={{ width: '100%', marginBottom: '1rem' }}
        >
          📝 Open Today's Note
        </button>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {allDailyNotes.map(note => (
            <Link
              key={note.id}
              to={`/notes/${note.id}`}
              style={{
                padding: '0.8rem',
                borderRadius: '6px',
                backgroundColor: todayNote?.id === note.id ? 'var(--bg-highlight)' : 'transparent',
                border: '1px solid var(--border-color)',
                textDecoration: 'none',
                color: 'inherit'
              }}
            >
              <div style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>
                {formatDate(note.created_at)}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                {note.content.substring(0, 50)}...
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Main content - Today's note */}
      <div style={{ flex: 3, overflowY: 'auto' }}>
        {todayNote ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h1>{todayNote.title}</h1>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {isEditing ? (
                  <>
                    <button className="btn" onClick={saveTodayNote}>Save</button>
                    <button className="btn" onClick={() => setIsEditing(false)} style={{ backgroundColor: 'var(--surface-color)' }}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <button className="btn" onClick={() => setIsEditing(true)}>Edit</button>
                )}
              </div>
            </div>
            
            {isEditing ? (
              <MDEditor
                value={editContent}
                onChange={val => setEditContent(val || '')}
                height={600}
              />
            ) : (
              <div style={{ backgroundColor: 'var(--bg-color)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <MDEditor.Markdown
                  source={todayNote.content}
                  style={{ backgroundColor: 'transparent', color: 'var(--text-main)' }}
                />
              </div>
            )}
          </div>
        ) : (
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <p style={{ color: 'var(--text-muted)' }}>Loading today's note...</p>
          </div>
        )}
      </div>
    </div>
  );
}
