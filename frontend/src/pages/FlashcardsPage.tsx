/**
 * FlashcardsPage — Phase 3.4
 * Full flashcard management: browse by note, AI generation,
 * SM-2 spaced-repetition review session, and Anki export.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  Brain, Download, ChevronLeft,
  Check, X, RotateCcw, Sparkles, Edit2, Trash2, Eye,
  Loader2, Star, BookOpen,
} from 'lucide-react';
import { apiUrl } from '../lib/api';

interface Flashcard {
  id: string;
  note_id: string;
  question: string;
  answer: string;
  ease_factor: number;
  interval: number;
  repetitions: number;
  next_review_at: string;
  last_reviewed_at: string | null;
  created_at: string;
}

interface Stats { total: number; due: number; }

type View = 'browse' | 'review';

// ── SM-2 quality labels ────────────────────────────────────────────────────
const QUALITY_OPTS = [
  { q: 0, label: 'Blackout',  emoji: '💀', color: '#ef4444' },
  { q: 1, label: 'Very Hard', emoji: '😓', color: '#f97316' },
  { q: 2, label: 'Hard',      emoji: '😣', color: '#eab308' },
  { q: 3, label: 'Good',      emoji: '😊', color: '#22c55e' },
  { q: 4, label: 'Easy',      emoji: '😄', color: '#3b82f6' },
  { q: 5, label: 'Perfect',   emoji: '🌟', color: '#8b5cf6' },
];

export default function FlashcardsPage() {
  const [view, setView] = useState<View>('browse');
  const [dueCards, setDueCards] = useState<Flashcard[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genNoteId, setGenNoteId] = useState('');
  const [genCount, setGenCount] = useState(5);
  const [notes, setNotes] = useState<{ id: string; title: string }[]>([]);

  // Review state
  const [reviewIdx, setReviewIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [reviewDone, setReviewDone] = useState(false);
  const [rating, setRating] = useState<number | null>(null);

  // Edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editQ, setEditQ] = useState('');
  const [editA, setEditA] = useState('');

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [statsRes, dueRes] = await Promise.all([
        fetch(apiUrl('/api/flashcards/stats')).then((r) => r.json()),
        fetch(apiUrl('/api/flashcards/due')).then((r) => r.json()),
      ]);
      setStats(statsRes);
      setDueCards(Array.isArray(dueRes) ? dueRes : []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  const loadNotes = useCallback(async () => {
    try {
      const res = await fetch(apiUrl('/api/notes?limit=100'));
      const data = await res.json();
      const items = Array.isArray(data) ? data : (data.items || []);
      setNotes(items.map((n: any) => ({ id: n.id, title: n.title })));
    } catch { /* silent */ }
  }, []);

  useEffect(() => { loadAll(); loadNotes(); }, []);

  // ── Generate ────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!genNoteId) return;
    setGenerating(true);
    try {
      const model = localStorage.getItem('activeModel') || 'qwen2.5:0.5b';
      const res = await fetch(apiUrl('/api/flashcards/generate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note_id: genNoteId, model, count: genCount }),
      });
      if (!res.ok) throw new Error(await res.text());
      await loadAll();
    } catch (e: any) {
      alert(`Generation failed: ${e.message}`);
    } finally {
      setGenerating(false);
    }
  };

  // ── Review session ───────────────────────────────────────────────────────
  const startReview = () => {
    setView('review');
    setReviewIdx(0);
    setRevealed(false);
    setReviewDone(false);
    setRating(null);
  };

  const submitRating = async (quality: number) => {
    const card = dueCards[reviewIdx];
    if (!card) return;
    setRating(quality);
    try {
      await fetch(apiUrl(`/api/flashcards/${card.id}/review`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quality }),
      });
    } catch { /* non-blocking */ }
    setTimeout(() => {
      const next = reviewIdx + 1;
      if (next >= dueCards.length) {
        setReviewDone(true);
      } else {
        setReviewIdx(next);
        setRevealed(false);
        setRating(null);
      }
    }, 400);
  };

  // ── Edit / Delete ────────────────────────────────────────────────────────
  const startEdit = (card: Flashcard) => {
    setEditId(card.id); setEditQ(card.question); setEditA(card.answer);
  };

  const saveEdit = async () => {
    if (!editId) return;
    await fetch(apiUrl(`/api/flashcards/${editId}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: editQ, answer: editA }),
    });
    setEditId(null);
    loadAll();
  };

  const deleteCard = async (id: string) => {
    if (!confirm('Delete this flashcard?')) return;
    await fetch(apiUrl(`/api/flashcards/${id}`), { method: 'DELETE' });
    setDueCards((p) => p.filter((c) => c.id !== id));
    loadAll();
  };

  const exportAnki = () => {
    window.open(apiUrl('/api/flashcards/export/anki'), '_blank');
  };

  // ──────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, gap: 12, color: 'var(--on-surface-dim)' }}>
        <Loader2 size={20} style={{ animation: 'spin 1s linear infinite', color: 'var(--primary)' }} />
        Loading flashcards…
      </div>
    );
  }

  // ── REVIEW MODE ─────────────────────────────────────────────────────────
  if (view === 'review') {
    if (reviewDone || dueCards.length === 0) {
      return (
        <div style={{ maxWidth: 520, margin: '60px auto', textAlign: 'center', padding: '0 24px' }}>
          <div style={{ fontSize: '4rem', marginBottom: 16 }}>🎉</div>
          <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 8 }}>Session complete!</h2>
          <p style={{ color: 'var(--on-surface-variant)', marginBottom: 28, fontSize: '0.9375rem' }}>
            You reviewed {Math.min(reviewIdx + 1, dueCards.length)} card{dueCards.length !== 1 ? 's' : ''}. Great work.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="btn" onClick={() => { setView('browse'); loadAll(); }}>
              <BookOpen size={14} /> Back to library
            </button>
            {dueCards.length > 0 && (
              <button className="btn-ghost" onClick={startReview}>
                <RotateCcw size={14} /> Review again
              </button>
            )}
          </div>
        </div>
      );
    }

    const card = dueCards[reviewIdx];
    const progress = ((reviewIdx) / dueCards.length) * 100;

    return (
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '24px 24px 80px' }}>
        {/* Progress */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <button className="btn-ghost" onClick={() => setView('browse')} style={{ fontSize: '0.75rem' }}>
            <ChevronLeft size={14} /> Exit
          </button>
          <div style={{ flex: 1, height: 4, borderRadius: 99, background: 'var(--surface-container-high)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'var(--primary)', transition: 'width 300ms' }} />
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--on-surface-dim)', fontFamily: 'var(--font-mono)' }}>
            {reviewIdx + 1} / {dueCards.length}
          </span>
        </div>

        {/* Card */}
        <div style={{
          borderRadius: 'var(--radius-2xl)', border: '1px solid var(--outline)',
          background: 'var(--surface-container)',
          overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
          minHeight: 320,
        }}>
          {/* Question */}
          <div style={{ padding: '32px 32px 24px', borderBottom: '1px solid var(--outline-variant)' }}>
            <div style={{
              fontSize: '0.625rem', fontFamily: 'var(--font-display)', fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.1em',
              color: 'var(--primary)', marginBottom: 12,
            }}>Question</div>
            <p style={{ fontSize: '1.125rem', lineHeight: 1.6, fontFamily: 'var(--font-display)', color: 'var(--on-surface)' }}>
              {card.question}
            </p>
          </div>

          {/* Answer area */}
          <div style={{ padding: '24px 32px' }}>
            {!revealed ? (
              <button
                onClick={() => setRevealed(true)}
                style={{
                  width: '100%', padding: '16px', borderRadius: 'var(--radius-lg)',
                  border: '2px dashed var(--outline-variant)',
                  background: 'var(--surface-container-lowest)',
                  color: 'var(--on-surface-dim)', fontSize: '0.875rem',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'all 160ms',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--outline-variant)'; e.currentTarget.style.color = 'var(--on-surface-dim)'; }}
              >
                <Eye size={16} /> Reveal answer
              </button>
            ) : (
              <>
                <div style={{
                  fontSize: '0.625rem', fontFamily: 'var(--font-display)', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.1em',
                  color: 'var(--secondary)', marginBottom: 12,
                }}>Answer</div>
                <p style={{ fontSize: '1rem', lineHeight: 1.65, color: 'var(--on-surface)', whiteSpace: 'pre-wrap', marginBottom: 24 }}>
                  {card.answer}
                </p>

                {/* Rating buttons */}
                <div style={{ fontSize: '0.75rem', color: 'var(--on-surface-dim)', marginBottom: 10, fontFamily: 'var(--font-display)', fontWeight: 600 }}>
                  How well did you know this?
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  {QUALITY_OPTS.map((opt) => (
                    <button
                      key={opt.q}
                      onClick={() => submitRating(opt.q)}
                      style={{
                        padding: '10px 4px', borderRadius: 'var(--radius-md)',
                        border: `1.5px solid ${rating === opt.q ? opt.color : 'var(--outline-variant)'}`,
                        background: rating === opt.q ? `${opt.color}22` : 'var(--surface-container-lowest)',
                        cursor: 'pointer', transition: 'all 150ms',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                        opacity: rating !== null && rating !== opt.q ? 0.4 : 1,
                      }}
                    >
                      <span style={{ fontSize: '1.25rem' }}>{opt.emoji}</span>
                      <span style={{ fontSize: '0.625rem', color: opt.color, fontFamily: 'var(--font-display)', fontWeight: 700 }}>
                        {opt.label}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── BROWSE MODE ─────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 24 }}>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 700, marginBottom: 4 }}>
            Flashcards
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)' }}>
            AI-generated cards with SM-2 spaced repetition.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-ghost" onClick={exportAnki} style={{ fontSize: '0.75rem', gap: 6 }}>
            <Download size={14} /> Export Anki
          </button>
          {dueCards.length > 0 && (
            <button className="btn" onClick={startReview} style={{ gap: 6 }}>
              <Brain size={14} />
              Review {dueCards.length} due
              {stats && stats.due > 0 && (
                <span style={{
                  background: 'var(--error)', color: '#fff',
                  borderRadius: 'var(--radius-full)', padding: '0 5px', fontSize: '0.625rem', fontWeight: 700,
                }}>
                  {stats.due}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Stats strip */}
      {stats && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24,
        }}>
          {[
            { label: 'Total cards', value: stats.total, icon: <BookOpen size={16} /> },
            { label: 'Due for review', value: stats.due, icon: <RotateCcw size={16} />, warn: stats.due > 0 },
            { label: 'Mastered', value: Math.max(0, stats.total - stats.due), icon: <Star size={16} /> },
          ].map((s) => (
            <div key={s.label} style={{
              padding: '14px 16px', borderRadius: 'var(--radius-lg)',
              background: 'var(--surface-container)',
              border: `1px solid ${s.warn ? 'var(--error)' : 'var(--outline-variant)'}`,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <span style={{ color: s.warn ? 'var(--error)' : 'var(--primary)' }}>{s.icon}</span>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1.25rem', color: 'var(--on-surface)' }}>
                  {s.value}
                </div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--on-surface-dim)' }}>{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Generate panel */}
      <div style={{
        padding: '18px 20px', borderRadius: 'var(--radius-xl)',
        background: 'var(--surface-container)',
        border: '1px solid var(--outline-variant)',
        marginBottom: 24,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
          <Sparkles size={16} style={{ color: 'var(--primary)' }} />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.9375rem' }}>
            Generate from a note
          </span>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div style={{ flex: 2, minWidth: 180 }}>
            <label style={{ fontSize: '0.6875rem', color: 'var(--on-surface-dim)', display: 'block', marginBottom: 5 }}>Select note</label>
            <select
              className="input"
              value={genNoteId}
              onChange={(e) => setGenNoteId(e.target.value)}
              style={{ width: '100%', fontSize: '0.8125rem', padding: '8px 10px' }}
            >
              <option value="">— Choose a note —</option>
              {notes.map((n) => (
                <option key={n.id} value={n.id}>{n.title}</option>
              ))}
            </select>
          </div>
          <div style={{ width: 90 }}>
            <label style={{ fontSize: '0.6875rem', color: 'var(--on-surface-dim)', display: 'block', marginBottom: 5 }}>Count</label>
            <input
              type="number" min={1} max={20}
              className="input"
              value={genCount}
              onChange={(e) => setGenCount(Number(e.target.value))}
              style={{ width: '100%', fontSize: '0.8125rem', padding: '8px 10px' }}
            />
          </div>
          <button
            className="btn"
            onClick={handleGenerate}
            disabled={!genNoteId || generating}
            style={{ gap: 6, paddingBottom: 9 }}
          >
            {generating
              ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Generating…</>
              : <><Sparkles size={14} /> Generate {genCount} cards</>
            }
          </button>
        </div>
      </div>

      {/* Due cards list */}
      {dueCards.length === 0 && !loading && (
        <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--on-surface-dim)' }}>
          <Brain size={48} style={{ margin: '0 auto 16px', display: 'block', opacity: 0.25 }} />
          <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: 8 }}>No flashcards yet</h3>
          <p style={{ fontSize: '0.875rem' }}>Generate flashcards from a note above to get started.</p>
        </div>
      )}

      {dueCards.length > 0 && (
        <div>
          <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-display)', fontWeight: 700, color: 'var(--on-surface-dim)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
            Due cards ({dueCards.length})
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {dueCards.map((card) => (
              <div key={card.id} style={{
                borderRadius: 'var(--radius-lg)', border: '1px solid var(--outline-variant)',
                background: 'var(--surface-container)',
                overflow: 'hidden',
                transition: 'border-color 160ms',
              }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--outline-variant)')}
              >
                {editId === card.id ? (
                  <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <textarea
                      value={editQ}
                      onChange={(e) => setEditQ(e.target.value)}
                      placeholder="Question"
                      style={{
                        resize: 'none', border: '1px solid var(--outline)', borderRadius: 'var(--radius-sm)',
                        background: 'var(--surface-container-lowest)', color: 'var(--on-surface)',
                        fontSize: '0.8125rem', padding: 8, fontFamily: 'var(--font-body)', minHeight: 60, outline: 'none',
                      }}
                    />
                    <textarea
                      value={editA}
                      onChange={(e) => setEditA(e.target.value)}
                      placeholder="Answer"
                      style={{
                        resize: 'none', border: '1px solid var(--outline)', borderRadius: 'var(--radius-sm)',
                        background: 'var(--surface-container-lowest)', color: 'var(--on-surface)',
                        fontSize: '0.8125rem', padding: 8, fontFamily: 'var(--font-body)', minHeight: 60, outline: 'none',
                      }}
                    />
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn" style={{ flex: 1, fontSize: '0.75rem' }} onClick={saveEdit}><Check size={13} /> Save</button>
                      <button className="btn-ghost" style={{ fontSize: '0.75rem' }} onClick={() => setEditId(null)}><X size={13} /></button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ padding: '12px 14px 8px', borderBottom: '1px solid var(--outline-variant)' }}>
                      <div style={{ fontSize: '0.5625rem', fontFamily: 'var(--font-display)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--primary)', marginBottom: 6 }}>Q</div>
                      <p style={{ fontSize: '0.875rem', color: 'var(--on-surface)', lineHeight: 1.5, fontFamily: 'var(--font-display)' }}>{card.question}</p>
                    </div>
                    <div style={{ padding: '8px 14px 12px' }}>
                      <div style={{ fontSize: '0.5625rem', fontFamily: 'var(--font-display)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--secondary)', marginBottom: 6 }}>A</div>
                      <p style={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)', lineHeight: 1.5 }}>{card.answer}</p>
                    </div>
                    <div style={{
                      padding: '8px 10px',
                      borderTop: '1px solid var(--outline-variant)',
                      display: 'flex', gap: 6, justifyContent: 'flex-end',
                    }}>
                      <span style={{ flex: 1, fontSize: '0.5625rem', color: 'var(--on-surface-dim)', display: 'flex', alignItems: 'center', gap: 4 }}>
                        EF: {card.ease_factor.toFixed(1)} · {card.repetitions}×
                      </span>
                      <button onClick={() => startEdit(card)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--on-surface-dim)', padding: 4 }} title="Edit">
                        <Edit2 size={13} />
                      </button>
                      <button onClick={() => deleteCard(card.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)', padding: 4 }} title="Delete">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
