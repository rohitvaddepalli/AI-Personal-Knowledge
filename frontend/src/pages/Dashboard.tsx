import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Compass, PenTool, Search, Sparkles, X, Pin, ArrowRight } from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const [insights, setInsights] = useState<any[]>([]);
  const [recentNotes, setRecentNotes] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchInsights();
    fetchRecentNotes();
  }, []);

  const fetchInsights = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/insights');
      const data = await res.json();
      setInsights(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchRecentNotes = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/notes?limit=5');
      const data = await res.json();
      setRecentNotes(data.slice(0, 5));
    } catch (e) {
      console.error(e);
    }
  };

  const generateDigest = async () => {
    setGenerating(true);
    try {
      await fetch('http://localhost:8000/api/insights/generate', { method: 'POST' });
      // Poll for completion or just wait a bit and fetch new insights
      // In a real implementation, the backend might return the new insights directly or we poll.
      // For now, we assume it's synchronous or near-synchronous enough after the POST returns.
      await fetchInsights();
      setTimeout(() => setGenerating(false), 2000); 
    } catch (e) {
      console.error(e);
      setGenerating(false);
    }
  };

  const dismissInsight = async (id: number) => {
    try {
      await fetch(`http://localhost:8000/api/insights/${id}`, { method: 'DELETE' });
      fetchInsights();
    } catch (e) {
      console.error(e);
    }
  };

  const getRandomNote = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/notes/random');
      if (res.ok) {
        const note = await res.json();
        navigate(`/notes/${note.id}`);
      } else {
        alert('No notes available yet!');
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12">
      <header className="mb-10">
        <h1 className="text-4xl lg:text-5xl font-serif text-text-main mb-3">Welcome to your space.</h1>
        <p className="text-lg text-text-muted">A calm environment for capturing, connecting, and deep thinking.</p>
      </header>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Capture', icon: PenTool, path: '/notes/new', isBtn: false },
          { label: 'Surprise', icon: Compass, onClick: getRandomNote, isBtn: true },
          { label: 'Search', icon: Search, path: '/notes', isBtn: false },
          { label: 'Think', icon: Sparkles, onClick: generateDigest, isBtn: true },
        ].map((action, idx) => {
          const content = (
            <div
              className="flex h-full flex-col items-center justify-center rounded-2xl border border-border bg-surface/50 p-6 transition-transform transition-colors duration-200 cursor-pointer hover:-translate-y-1 hover:border-accent/40 hover:bg-surface active:scale-[0.98]"
            >
              <action.icon className="text-accent mb-3" size={28} strokeWidth={1.5} />
              <span className="text-sm font-medium text-text-main">{action.label}</span>
            </div>
          );
          
          return action.isBtn ? (
            <button key={idx} onClick={action.onClick} className="w-full text-left focus:outline-none">
              {content}
            </button>
          ) : (
            <Link key={idx} to={action.path!} className="w-full relative">
              {content}
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <section className="lg:col-span-7 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-serif">Recent Notes</h2>
            <Link to="/notes" className="text-sm text-accent hover:text-accent-hover font-medium flex items-center gap-1 group">
              View all <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
          
          <div className="space-y-3">
            {recentNotes.length === 0 ? (
              <div className="p-8 text-center rounded-2xl border border-dashed border-border text-text-muted">
                <p>The canvas is empty. It's time to capture your first thought.</p>
              </div>
            ) : (
              recentNotes.map((note) => (
                <div key={note.id} className="transition-transform duration-200 hover:translate-x-1">
                  <Link 
                    to={`/notes/${note.id}`}
                    className="block p-5 bg-surface border border-transparent rounded-2xl hover:border-border hover:shadow-sm transition-all group"
                  >
                    <div className="font-medium text-lg text-text-main mb-1.5 flex items-center gap-2">
                      {note.is_pinned && <Pin size={14} className="text-accent-amber" />}
                      <span className="group-hover:text-accent transition-colors">
                        {note.title || 'Untitled Note'}
                      </span>
                    </div>
                    <div className="text-sm text-text-muted line-clamp-2">
                      {note.content}
                    </div>
                  </Link>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="lg:col-span-5 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-serif flex items-center gap-2">
              Deep Insights
            </h2>
            {generating && (
              <div className="flex items-center gap-3 bg-surface/50 px-3 py-1.5 rounded-full border border-border">
                <div className="w-24 h-1.5 bg-bg-highlight rounded-full overflow-hidden">
                  <div className="dashboard-progress-bar h-full w-full bg-accent" />
                </div>
                <span className="text-xs text-text-muted font-medium">Synthesizing...</span>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {insights.length === 0 ? (
              <div className="p-8 bg-bg-highlight border border-border rounded-2xl text-center">
                <Sparkles className="mx-auto text-text-muted mb-3 opacity-50" size={24} />
                <p className="text-sm text-text-muted mb-4">No recent insights generated.</p>
                <button 
                  onClick={generateDigest} 
                  disabled={generating}
                  className="px-4 py-2 bg-accent/10 border border-accent/20 text-accent rounded-xl text-sm font-medium hover:bg-accent/20 transition-colors"
                >
                  {generating ? 'Processing thoughts...' : 'Synthesize Ideas'}
                </button>
              </div>
            ) : (
              insights.map((ins) => (
                <div
                  key={ins.id} 
                  className="relative rounded-2xl border border-border/60 bg-gradient-to-br from-bg-base to-surface p-6 pr-10 shadow-sm transition-shadow hover:shadow-md"
                >
                  <button 
                    onClick={() => dismissInsight(ins.id)}
                    className="absolute top-4 right-4 text-text-muted hover:text-text-main transition-colors p-1"
                  >
                    <X size={16} />
                  </button>
                  <div className="text-xs font-semibold uppercase tracking-widest text-accent mb-3 opacity-80">
                    {ins.insight_type.replace(/_/g, ' ')}
                  </div>
                  <div className="text-sm leading-relaxed text-text-main whitespace-pre-wrap prose prose-invert prose-sm max-w-none">
                    {ins.content.replace(/(\*\*|##)/g, '')}
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
