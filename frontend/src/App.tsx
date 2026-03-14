import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { BookOpen, RefreshCw, PenTool, LayoutTemplate, Network, HelpCircle, Layers, CheckSquare, Trash2, Settings as SettingsIcon, Sun, Moon, Menu, X } from 'lucide-react';
import { DownloadProvider, useDownload } from './context/DownloadContext';
import './index.css';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const NoteList = lazy(() => import('./pages/NoteList'));
const NoteEditor = lazy(() => import('./pages/NoteEditor'));
const NoteDetail = lazy(() => import('./pages/NoteDetail'));
const KnowledgeGraph = lazy(() => import('./pages/KnowledgeGraph'));
const AskBrain = lazy(() => import('./pages/AskBrain'));
const Collections = lazy(() => import('./pages/Collections'));
const Tasks = lazy(() => import('./pages/Tasks'));
const Settings = lazy(() => import('./pages/Settings'));
const Trash = lazy(() => import('./pages/Trash'));
const Templates = lazy(() => import('./pages/Templates'));
const Review = lazy(() => import('./pages/Review'));

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: BookOpen },
  { path: '/notes', label: 'Notes', icon: PenTool },
  { path: '/review', label: 'Review', icon: RefreshCw },
  { path: '/notes/new', label: 'New Note', icon: PenTool },
  { path: '/templates', label: 'Templates', icon: LayoutTemplate },
  { path: '/graph', label: 'Graph', icon: Network },
  { path: '/ask', label: 'Ask Brain', icon: HelpCircle },
  { path: '/collections', label: 'Collections', icon: Layers },
  { path: '/tasks', label: 'Tasks', icon: CheckSquare },
  { path: '/trash', label: 'Trash', icon: Trash2 },
  { path: '/settings', label: 'Settings', icon: SettingsIcon },
];

function PageWrapper({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={`flex-1 min-h-0 ${className || ''}`}>
      {children}
    </div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();

  const routeLoadingFallback = (
    <div className="flex-1 min-h-0 rounded-2xl border border-border bg-bg-highlight/40 p-6 text-sm text-text-muted">
      Loading page...
    </div>
  );

  return (
    <Suspense fallback={routeLoadingFallback}>
      <Routes location={location}>
        <Route path="/" element={<PageWrapper><Dashboard /></PageWrapper>} />
        <Route path="/notes" element={<PageWrapper><NoteList /></PageWrapper>} />
        <Route path="/notes/new" element={<PageWrapper><NoteEditor /></PageWrapper>} />
        <Route path="/notes/:id" element={<PageWrapper><NoteDetail /></PageWrapper>} />
        <Route path="/review" element={<PageWrapper><Review /></PageWrapper>} />
        <Route path="/templates" element={<PageWrapper><Templates /></PageWrapper>} />
        <Route path="/graph" element={<PageWrapper><KnowledgeGraph /></PageWrapper>} />
        <Route path="/ask" element={<PageWrapper className="h-full"><AskBrain /></PageWrapper>} />
        <Route path="/collections" element={<PageWrapper><Collections /></PageWrapper>} />
        <Route path="/tasks" element={<PageWrapper><Tasks /></PageWrapper>} />
        <Route path="/trash" element={<PageWrapper><Trash /></PageWrapper>} />
        <Route path="/settings" element={<PageWrapper><Settings /></PageWrapper>} />
      </Routes>
    </Suspense>
  );
}

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pulling, pullResult, pullProgress } = useDownload();
  const currentNav = useMemo(
    () => NAV_ITEMS.find((item) => item.path === location.pathname),
    [location.pathname]
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-color-mode', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'k') { e.preventDefault(); navigate('/notes'); }
      if (e.ctrlKey && e.key === 'n') { e.preventDefault(); navigate('/notes/new'); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  return (
    <div className="flex h-screen overflow-hidden bg-bg-base text-text-main font-sans selection:bg-accent/30 selection:text-text-main">
      <button
        className="lg:hidden absolute top-4 left-4 z-50 p-2 rounded-full bg-surface shadow-md border border-border"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <aside 
        className={`fixed inset-y-0 left-0 z-40 w-56 border-r border-border bg-surface/80 backdrop-blur-xl transform transition-transform duration-300 ease-out lg:static lg:translate-x-0 flex flex-col ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="p-6">
          <h2 className="text-2xl font-serif font-medium tracking-tight flex items-center gap-3">
            <span className="text-accent">✧</span> Second Brain
          </h2>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-2 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-accent/10 text-accent font-medium'
                    : 'text-text-muted hover:text-text-main hover:bg-white/5'
                }`}
              >
                <Icon size={18} className={isActive ? 'text-accent' : 'text-text-muted'} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          {pulling && (
            <div className="mb-4 p-4 bg-bg-highlight rounded-xl border border-border text-sm">
              <div className="font-medium text-accent mb-2">Downloading Model...</div>
              <div className="w-full bg-bg-base rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full bg-accent transition-[width] duration-200 ease-linear"
                  style={{ width: `${pullProgress}%` }}
                />
              </div>
              <div className="mt-2 text-text-muted text-xs truncate">{pullResult}</div>
            </div>
          )}
          <button
            onClick={toggleTheme}
            className="flex items-center justify-between w-full px-4 py-3 rounded-xl bg-bg-base border border-border hover:border-accent/40 text-text-muted hover:text-text-main transition-colors"
          >
            <span className="text-sm font-medium">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </aside>

      <main className="flex-1 relative overflow-y-auto">
        <div className={`mx-auto min-h-full flex flex-col ${
          location.pathname === '/ask' 
            ? 'w-full p-4 lg:p-6 space-y-2' 
            : 'max-w-6xl p-6 lg:p-8 pb-24 space-y-8'
        }`}>
          <header className={`z-10 bg-bg-base bg-opacity-90 backdrop-blur-xl border-b border-border flex items-center justify-between gap-4 ${
            location.pathname === '/ask' ? 'pb-2 mb-2 shrink-0' : 'pb-4 mb-4'
          }`}>
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-[0.68rem] uppercase tracking-[0.18em] text-text-muted">
                <span className="inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
                <span>Second Brain</span>
              </div>
              <h1 className="text-xl lg:text-2xl font-serif">
                {currentNav?.label ?? 'Overview'}
              </h1>
            </div>
            <div className="hidden md:flex items-center gap-3 text-xs text-text-muted">
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg border border-border bg-bg-base">
                <span className="text-[0.7rem] font-mono">Ctrl</span>
                <span className="text-[0.7rem] font-mono">K</span>
              </div>
              <span>Open notes</span>
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg border border-border bg-bg-base">
                <span className="text-[0.7rem] font-mono">Ctrl</span>
                <span className="text-[0.7rem] font-mono">N</span>
              </div>
              <span>New note</span>
            </div>
          </header>
          <AnimatedRoutes />
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <DownloadProvider>
      <Router>
        <AppContent />
      </Router>
    </DownloadProvider>
  );
}

export default App;
