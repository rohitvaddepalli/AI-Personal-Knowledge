import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

interface Connection {
    id: number;
    source_note_id: string;
    target_note_id: string;
    relationship_type: string;
    strength: number;
    ai_explanation: string;
}

export default function ConnectionsSidebar({ noteId }: { noteId: string }) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [notes, setNotes] = useState<{ [key: string]: any }>({});

  useEffect(() => {
    fetch(`http://localhost:8000/api/connections/note/${noteId}`)
      .then(res => res.json())
      .then(async data => {
          setConnections(data);
          // fetch titles for display
          let noteNodes: { [key: string]: any } = {};
          for (let conn of data) {
              let targetId = conn.source_note_id === noteId ? conn.target_note_id : conn.source_note_id;
              if (!noteNodes[targetId]) {
                  try {
                      let res = await fetch(`http://localhost:8000/api/notes/${targetId}`);
                      if (res.ok) {
                          let n = await res.json();
                          noteNodes[targetId] = n;
                      }
                  } catch (e) {}
              }
          }
          setNotes(noteNodes);
      });
  }, [noteId]);

  return (
    <div className="card" style={{ height: '100%', overflowY: 'auto' }}>
      <h3>Connections</h3>
      {connections.length === 0 && <p style={{ color: 'var(--text-muted)' }}>No connections found.</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
        {connections.map(c => {
          const target = c.source_note_id === noteId ? c.target_note_id : c.source_note_id;
          const targetNote = notes[target];
          return (
            <div key={c.id} style={{ padding: '0.75rem', backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: '0.5rem' }}>
              <Link to={`/notes/${target}`} style={{ color: 'var(--text-main)', textDecoration: 'none', fontWeight: 'bold' }}>
                {targetNote ? targetNote.title : "Loading..."}
              </Link>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <span style={{ backgroundColor: 'var(--accent-color)', color: 'white', padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                    {c.relationship_type || 'similar'}
                  </span>
                  <span>Strength: {(c.strength * 100).toFixed(0)}%</span>
              </div>
              {c.ai_explanation && (
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem', fontStyle: 'italic' }}>"{c.ai_explanation}"</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
