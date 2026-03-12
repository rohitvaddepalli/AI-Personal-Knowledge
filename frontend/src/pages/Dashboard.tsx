import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, Variants } from 'framer-motion';
import { Compass, PenTool, Search, Sparkles, X, Pin, ArrowRight } from 'lucide-react';

// Animation variants
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 }
  }
};

const childVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 280, damping: 24 }
  }
};

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
    <motion.div 
      variants={containerVariants} 
      initial="hidden" 
      animate="visible" 
      className="max-w-4xl mx-auto space-y-12"
    >
      <motion.header variants={childVariants} className="mb-10">
        <h1 className="text-4xl lg:text-5xl font-serif text-text-main mb-3">Welcome to your space.</h1>
        <p className="text-lg text-text-muted">A calm environment for capturing, connecting, and deep thinking.</p>
      </motion.header>

      {/* Action Grid */}
      <motion.div variants={childVariants} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Capture', icon: PenTool, path: '/notes/new', isBtn: false },
          { label: 'Surprise', icon: Compass, onClick: getRandomNote, isBtn: true },
          { label: 'Search', icon: Search, path: '/notes', isBtn: false },
          { label: 'Think', icon: Sparkles, onClick: generateDigest, isBtn: true },
        ].map((action, idx) => {
          const content = (
            <motion.div 
              whileHover={{ y: -4, scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex flex-col items-center justify-center p-6 bg-surface/50 border border-border rounded-2xl cursor-pointer hover:border-accent/40 hover:bg-surface transition-colors h-full"
            >
              <action.icon className="text-accent mb-3" size={28} strokeWidth={1.5} />
              <span className="text-sm font-medium text-text-main">{action.label}</span>
            </motion.div>
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
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Recent Notes */}
        <motion.section variants={childVariants} className="lg:col-span-7 space-y-6">
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
                <motion.div key={note.id} whileHover={{ x: 4 }} transition={{ type: 'spring', stiffness: 300, damping: 24 }}>
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
                </motion.div>
              ))
            )}
          </div>
        </motion.section>

        {/* Right Column: Insights */}
        <motion.section variants={childVariants} className="lg:col-span-5 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-serif flex items-center gap-2">
              Deep Insights
            </h2>
            {generating && (
              <div className="flex items-center gap-3 bg-surface/50 px-3 py-1.5 rounded-full border border-border">
                <div className="w-24 h-1.5 bg-bg-highlight rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-accent"
                    initial={{ x: '-100%' }}
                    animate={{ x: '100%' }}
                    transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                  />
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
                <motion.div 
                  key={ins.id} 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="relative p-6 pr-10 bg-gradient-to-br from-bg-base to-surface border border-border/60 rounded-2xl shadow-sm hover:shadow-md transition-shadow"
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
                </motion.div>
              ))
            )}
          </div>
        </motion.section>
      </div>
    </motion.div>
  );
}
