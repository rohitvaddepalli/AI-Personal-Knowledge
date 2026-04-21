import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, BookOpen, Brush, Code2, GraduationCap, ArrowRight, CheckCircle } from 'lucide-react';
import { apiUrl } from '../lib/api';

interface Goal {
  id: string;
  label: string;
  desc: string;
  icon: React.ReactNode;
  color: string;
}

const GOALS: Goal[] = [
  {
    id: 'student',
    label: 'Student / Learner',
    desc: 'Study smarter with spaced repetition, flashcards, and Feynman technique guides.',
    icon: <GraduationCap size={24} />,
    color: 'var(--primary)',
  },
  {
    id: 'researcher',
    label: 'Researcher',
    desc: 'Build a Zettelkasten-style connected thought network. Link papers, ideas, and insights.',
    icon: <BookOpen size={24} />,
    color: 'var(--secondary)',
  },
  {
    id: 'creator',
    label: 'Creator / Writer',
    desc: 'Capture ideas, develop content, and use AI to find connections between topics.',
    icon: <Brush size={24} />,
    color: 'var(--tertiary)',
  },
  {
    id: 'developer',
    label: 'Developer',
    desc: 'Build a personal engineering wiki. Track bug fixes, architecture decisions, and snippets.',
    icon: <Code2 size={24} />,
    color: 'hsl(270 60% 60%)',
  },
];

interface OnboardingModalProps {
  onDone: () => void;
}

export default function OnboardingModal({ onDone }: OnboardingModalProps) {
  const [step, setStep] = useState<'goal' | 'seeding' | 'done'>('goal');
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleStart = async () => {
    if (!selectedGoal) return;
    setStep('seeding');

    try {
      await fetch(apiUrl('/api/inbox/seed'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: selectedGoal }),
      });
    } catch (e) {
      console.error('Seed failed (non-critical):', e);
    }

    localStorage.setItem('onboardingDone', '1');
    localStorage.setItem('userGoal', selectedGoal);
    setStep('done');
  };

  const handleFinish = () => {
    onDone();
    navigate('/ask');
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 500,
      background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }}>
      <div className="animate-slide-up" style={{
        width: '100%', maxWidth: 560,
        background: 'var(--surface-container)',
        borderRadius: 'var(--radius-2xl)',
        border: '1px solid var(--outline)',
        overflow: 'hidden',
        boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
      }}>
        {/* Header glow */}
        <div style={{
          padding: '28px 32px 20px',
          background: 'linear-gradient(135deg, var(--primary-container) 0%, var(--surface-container) 100%)',
          borderBottom: '1px solid var(--outline-variant)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <Sparkles size={24} style={{ color: 'var(--primary)' }} />
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem' }}>
              Welcome to Second Brain
            </h1>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)', lineHeight: 1.6 }}>
            Your AI-powered personal knowledge system. Let's personalize it for you.
          </p>
        </div>

        {/* Steps */}
        <div style={{ padding: '28px 32px' }}>
          {step === 'goal' && (
            <>
              <p style={{
                fontSize: '0.8125rem', fontFamily: 'var(--font-display)',
                fontWeight: 600, marginBottom: 16, color: 'var(--on-surface)',
              }}>
                What's your primary use case?
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
                {GOALS.map((goal) => (
                  <button
                    key={goal.id}
                    onClick={() => setSelectedGoal(goal.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '14px 16px', borderRadius: 'var(--radius-lg)',
                      border: `1.5px solid ${selectedGoal === goal.id ? goal.color : 'var(--outline-variant)'}`,
                      background: selectedGoal === goal.id ? 'var(--surface-container-high)' : 'var(--surface-container-lowest)',
                      cursor: 'pointer', textAlign: 'left', transition: 'all 180ms',
                      boxShadow: selectedGoal === goal.id ? `0 0 0 2px ${goal.color}33` : 'none',
                    }}
                  >
                    <div style={{
                      width: 42, height: 42, borderRadius: 'var(--radius-md)', flexShrink: 0,
                      background: `${goal.color}22`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: goal.color,
                    }}>
                      {goal.icon}
                    </div>
                    <div>
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.9375rem', color: 'var(--on-surface)', marginBottom: 2 }}>
                        {goal.label}
                      </div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--on-surface-variant)', lineHeight: 1.45 }}>
                        {goal.desc}
                      </div>
                    </div>
                    {selectedGoal === goal.id && (
                      <CheckCircle size={18} style={{ color: goal.color, marginLeft: 'auto', flexShrink: 0 }} />
                    )}
                  </button>
                ))}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  className="btn"
                  onClick={handleStart}
                  disabled={!selectedGoal}
                  style={{ gap: 8 }}
                >
                  Set up my Second Brain <ArrowRight size={16} />
                </button>
              </div>
            </>
          )}

          {step === 'seeding' && (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%', margin: '0 auto 16px',
                border: '3px solid var(--primary-dim)', borderTopColor: 'var(--primary)',
                animation: 'spin 0.8s linear infinite',
              }} />
              <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 8 }}>Preparing your workspace...</h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--on-surface-dim)' }}>
                Creating sample notes and configuring your knowledge base.
              </p>
            </div>
          )}

          {step === 'done' && (
            <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
              <CheckCircle size={48} style={{ color: 'var(--secondary)', margin: '0 auto 16px', display: 'block' }} />
              <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 8 }}>You're all set!</h2>
              <p style={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)', marginBottom: 24, lineHeight: 1.6 }}>
                We've added a few starter notes to your knowledge base to help you explore features.
                Try asking your Second Brain a question to see it in action!
              </p>

              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24,
              }}>
                {[
                  { icon: '📝', label: 'Capture Notes', hint: 'Use the Import button or New Note' },
                  { icon: '🔗', label: 'Connect Ideas', hint: 'Use [[wikilinks]] in your notes' },
                  { icon: '🧠', label: 'Ask Your Brain', hint: 'Ctrl+K → Ask or click Ask Brain' },
                  { icon: '🔁', label: 'Review Daily', hint: 'Spaced repetition in Review' },
                ].map((item) => (
                  <div key={item.label} style={{
                    padding: '12px 14px', borderRadius: 'var(--radius-md)',
                    background: 'var(--surface-container-lowest)',
                    border: '1px solid var(--outline-variant)', textAlign: 'left',
                  }}>
                    <div style={{ fontSize: '1.25rem', marginBottom: 4 }}>{item.icon}</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.8125rem', color: 'var(--on-surface)', marginBottom: 2 }}>
                      {item.label}
                    </div>
                    <div style={{ fontSize: '0.6875rem', color: 'var(--on-surface-dim)' }}>
                      {item.hint}
                    </div>
                  </div>
                ))}
              </div>

              <button className="btn" onClick={handleFinish} style={{ gap: 8 }}>
                <Sparkles size={16} /> Start exploring <ArrowRight size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
