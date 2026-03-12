import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import MDEditor from '@uiw/react-md-editor';

interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  review_count: number;
  next_review_at: string;
  last_reviewed_at: string;
}

export default function Review() {
  const [dueNotes, setDueNotes] = useState<Note[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [stats, setStats] = useState({ total: 0, reviewed: 0 });

  useEffect(() => {
    fetchDueNotes();
  }, []);

  const fetchDueNotes = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/review/due');
      const data = await res.json();
      setDueNotes(data);
      setStats(prev => ({ ...prev, total: data.length }));
    } catch (e) {
      console.error(e);
    }
  };

  const reviewNote = async (quality: number) => {
    if (currentIndex >= dueNotes.length) return;
    
    const note = dueNotes[currentIndex];
    try {
      await fetch(`http://localhost:8000/api/review/${note.id}?quality=${quality}`, {
        method: 'POST'
      });
      setStats(prev => ({ ...prev, reviewed: prev.reviewed + 1 }));
      setShowAnswer(false);
      setCurrentIndex(prev => prev + 1);
    } catch (e) {
      console.error(e);
    }
  };

  const currentNote = dueNotes[currentIndex];

  if (dueNotes.length === 0) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <h2>🎉 All Caught Up!</h2>
        <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>
          No notes are due for review. Great job keeping up with your knowledge!
        </p>
        <Link to="/notes" className="btn" style={{ marginTop: '2rem', textDecoration: 'none' }}>
          Browse Notes
        </Link>
      </div>
    );
  }

  if (currentIndex >= dueNotes.length) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <h2>🎉 Session Complete!</h2>
        <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>
          You reviewed {stats.reviewed} notes. Come back tomorrow for more!
        </p>
        <button className="btn" onClick={() => { setCurrentIndex(0); fetchDueNotes(); }} style={{ marginTop: '2rem' }}>
          Start Over
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1>🔄 Review</h1>
        <span style={{ color: 'var(--text-muted)' }}>
          {currentIndex + 1} / {dueNotes.length}
        </span>
      </div>

      <div className="card" style={{ minHeight: '400px' }}>
        <div style={{ marginBottom: '1rem' }}>
          <h2>{currentNote.title}</h2>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
            {currentNote.tags?.map(tag => (
              <span key={tag} style={{ backgroundColor: 'var(--accent-color)', padding: '0.2rem 0.5rem', borderRadius: '1rem', fontSize: '0.8rem' }}>
                #{tag}
              </span>
            ))}
          </div>
          {currentNote.review_count > 0 && (
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
              Reviewed {currentNote.review_count} times · Last: {currentNote.last_reviewed_at ? new Date(currentNote.last_reviewed_at).toLocaleDateString() : 'Never'}
            </div>
          )}
        </div>

        {!showAnswer ? (
          <div style={{ textAlign: 'center', padding: '3rem 1rem' }}>
            <p style={{ color: 'var(--text-muted)', marginBottom: '2rem' }}>
              Think about what you remember from this note...
            </p>
            <button className="btn" onClick={() => setShowAnswer(true)} style={{ fontSize: '1.2rem', padding: '1rem 2rem' }}>
              Show Note
            </button>
          </div>
        ) : (
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
            <MDEditor.Markdown source={currentNote.content} style={{ backgroundColor: 'transparent', color: 'var(--text-main)' }} />
            
            <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
              <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                How well did you remember this?
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                <button className="btn" onClick={() => reviewNote(1)} style={{ backgroundColor: '#ff4444' }}>
                  😵 Again
                </button>
                <button className="btn" onClick={() => reviewNote(3)} style={{ backgroundColor: '#ffaa00' }}>
                  🤔 Hard
                </button>
                <button className="btn" onClick={() => reviewNote(4)}>
                  🙂 Good
                </button>
                <button className="btn" onClick={() => reviewNote(5)} style={{ backgroundColor: '#00aa00' }}>
                  🎯 Easy
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ textAlign: 'center', marginTop: '1rem' }}>
        <Link to={`/notes/${currentNote.id}`} style={{ color: 'var(--accent-color)', textDecoration: 'none' }}>
          Open in Editor →
        </Link>
      </div>
    </div>
  );
}
