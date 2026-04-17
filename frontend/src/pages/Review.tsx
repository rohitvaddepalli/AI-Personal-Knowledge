import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MarkdownPreview } from '../components/Markdown';
import { RotateCcw, ArrowRight, Zap, BookOpen } from 'lucide-react';
import { apiUrl } from '../lib/api';

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

  useEffect(() => { fetchDueNotes(); }, []);

  const fetchDueNotes = async () => {
    try {
      const res = await fetch(apiUrl('/api/review/due'));
      const data = await res.json();
      setDueNotes(data);
      setStats(prev => ({ ...prev, total: data.length }));
    } catch (e) { console.error(e); }
  };

  const reviewNote = async (quality: number) => {
    if (currentIndex >= dueNotes.length) return;
    const note = dueNotes[currentIndex];
    try {
      const res = await fetch(apiUrl(`/api/review/${note.id}?quality=${quality}`), { method: 'POST' });
      if (!res.ok) throw new Error(`Review failed: ${res.status}`);
      setStats(prev => ({ ...prev, reviewed: prev.reviewed + 1 }));
      setShowAnswer(false);
      setCurrentIndex(prev => prev + 1);
    } catch (e) { console.error(e); }
  };

  const currentNote = dueNotes[currentIndex];

  // Empty state
  if (dueNotes.length === 0) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100%', textAlign: 'center', color: 'var(--on-surface-dim)',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 'var(--radius-xl)',
          background: 'var(--secondary-dim)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', marginBottom: 20,
        }}>
          <Zap size={28} style={{ color: 'var(--secondary)' }} />
        </div>
        <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 8 }}>All Caught Up!</h2>
        <p style={{ fontSize: '0.875rem', maxWidth: 360, marginBottom: 24 }}>
          No notes are due for review. Your knowledge is well-reinforced.
        </p>
        <Link to="/notes" className="btn" style={{ textDecoration: 'none' }}>
          Browse Notes
        </Link>
      </div>
    );
  }

  // Session complete
  if (currentIndex >= dueNotes.length) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100%', textAlign: 'center', color: 'var(--on-surface-dim)',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: 'var(--radius-xl)',
          background: 'var(--primary-dim)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', marginBottom: 20,
        }}>
          <BookOpen size={28} style={{ color: 'var(--primary)' }} />
        </div>
        <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 8 }}>Session Complete!</h2>
        <p style={{ fontSize: '0.875rem', maxWidth: 360, marginBottom: 24 }}>
          You reviewed {stats.reviewed} notes. Come back tomorrow for more reinforcement.
        </p>
        <button className="btn" onClick={() => { setCurrentIndex(0); setStats(prev => ({ ...prev, reviewed: 0 })); fetchDueNotes(); }}>
          <RotateCcw size={14} /> Start Over
        </button>
      </div>
    );
  }

  const qualityButtons = [
    { quality: 1, label: 'Again', desc: 'Forgot', bg: 'var(--error-container)', color: 'var(--error)' },
    { quality: 3, label: 'Hard', desc: 'Struggled', bg: 'var(--tertiary-container)', color: 'var(--tertiary)' },
    { quality: 4, label: 'Good', desc: 'Recalled', bg: 'var(--primary-dim)', color: 'var(--primary)' },
    { quality: 5, label: 'Easy', desc: 'Instant', bg: 'var(--secondary-dim)', color: 'var(--secondary)' },
  ];

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20,
      }}>
        <h1 style={{ fontFamily: 'var(--font-display)' }}>Flashcards</h1>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          fontSize: '0.8125rem', color: 'var(--on-surface-dim)',
          fontFamily: 'var(--font-mono)',
        }}>
          <span>{currentIndex + 1} / {dueNotes.length}</span>
          {/* Progress bar */}
          <div style={{
            width: 100, height: 4, borderRadius: 99,
            background: 'var(--surface-container-low)', overflow: 'hidden',
          }}>
            <div style={{
              width: `${((currentIndex) / dueNotes.length) * 100}%`,
              height: '100%',
              background: 'linear-gradient(90deg, var(--primary), var(--primary-container))',
              transition: 'width 300ms cubic-bezier(0.16, 1, 0.3, 1)',
            }} />
          </div>
        </div>
      </div>

      {/* Card */}
      <div style={{
        borderRadius: 'var(--radius-xl)',
        background: 'var(--surface-container)',
        padding: 32, minHeight: 400,
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Title */}
        <h2 style={{
          fontFamily: 'var(--font-display)', fontSize: '1.5rem',
          fontWeight: 700, marginBottom: 12,
        }}>
          {currentNote.title}
        </h2>

        {/* Tags + review info */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
          {currentNote.tags?.map(tag => (
            <span key={tag} className="tag">{tag}</span>
          ))}
          {currentNote.review_count > 0 && (
            <span style={{
              fontSize: '0.6875rem', color: 'var(--on-surface-dim)',
              fontFamily: 'var(--font-mono)', marginLeft: 'auto',
            }}>
              Reviewed {currentNote.review_count}× · Last: {currentNote.last_reviewed_at ? new Date(currentNote.last_reviewed_at).toLocaleDateString() : 'Never'}
            </span>
          )}
        </div>

        {!showAnswer ? (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '48px 16px',
          }}>
            <p style={{
              color: 'var(--on-surface-dim)', marginBottom: 24,
              fontSize: '0.9375rem', fontStyle: 'italic',
            }}>
              Think about what you remember from this note...
            </p>
            <button className="btn" onClick={() => setShowAnswer(true)} style={{
              fontSize: '1rem', padding: '14px 32px',
            }}>
              Reveal Content
            </button>
          </div>
        ) : (
          <div style={{ flex: 1 }}>
            {/* Divider */}
            <div style={{
              height: 1, background: 'var(--outline)',
              margin: '0 0 20px',
            }} />

            {/* Content */}
            <div style={{ fontSize: '0.9375rem', lineHeight: 1.75 }}>
              <MarkdownPreview
                source={currentNote.content}
                skipHtml={true}
                fallbackClassName="whitespace-pre-wrap"
                style={{ backgroundColor: 'transparent', color: 'var(--on-surface)' }}
              />
            </div>

            {/* Rating buttons */}
            <div style={{
              marginTop: 32, paddingTop: 20,
              borderTop: '1px solid var(--outline-variant)',
              textAlign: 'center',
            }}>
              <p style={{
                fontSize: '0.8125rem', color: 'var(--on-surface-dim)', marginBottom: 16,
                fontFamily: 'var(--font-display)',
              }}>
                How well did you remember this?
              </p>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                {qualityButtons.map(btn => (
                  <button
                    key={btn.quality}
                    onClick={() => reviewNote(btn.quality)}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center',
                      gap: 4, padding: '12px 20px',
                      borderRadius: 'var(--radius-md)',
                      background: btn.bg, border: 'none',
                      cursor: 'pointer', transition: 'all 200ms',
                      minWidth: 80,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
                    onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
                  >
                    <span style={{
                      fontFamily: 'var(--font-display)', fontWeight: 700,
                      fontSize: '0.875rem', color: btn.color,
                    }}>
                      {btn.label}
                    </span>
                    <span style={{ fontSize: '0.625rem', color: 'var(--on-surface-dim)' }}>
                      {btn.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Open in editor */}
      <div style={{ textAlign: 'center', marginTop: 16 }}>
        <Link
          to={`/notes/${currentNote.id}`}
          style={{
            color: 'var(--primary)', textDecoration: 'none',
            fontSize: '0.8125rem', fontFamily: 'var(--font-display)',
            display: 'inline-flex', alignItems: 'center', gap: 4,
          }}
        >
          Open in Editor <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
