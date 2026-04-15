import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { BookOpen, RefreshCw, PenTool, LayoutTemplate, Network, HelpCircle, Layers, CheckSquare, Trash2, Settings as SettingsIcon, Sun, Moon, Menu, X, LayoutGrid, Sparkles, Puzzle } from 'lucide-react';
import { useDesktopRuntime } from './context/DesktopRuntimeContext';
import { DownloadProvider, useDownload } from './context/DownloadContext';
import { Sidebar, NAV_ITEMS } from './components/Sidebar';
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
const DatabaseView = lazy(() => import('./pages/DatabaseView'));
const PromptsLibrary = lazy(() => import('./pages/PromptsLibrary'));
const PluginsPage = lazy(() => import('./pages/PluginsPage'));


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
        <Route path="/database" element={<PageWrapper><DatabaseView /></PageWrapper>} />
        <Route path="/prompts" element={<PageWrapper><PromptsLibrary /></PageWrapper>} />
        <Route path="/plugins" element={<PageWrapper><PluginsPage /></PageWrapper>} />
        <Route path="/trash" element={<PageWrapper><Trash /></PageWrapper>} />
        <Route path="/settings" element={<PageWrapper><Settings /></PageWrapper>} />
      </Routes>
    </Suspense>
  );
}

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { error, initializing, isDesktop, retryStartup } = useDesktopRuntime();
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

  if (isDesktop && initializing) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-base px-6 text-text-main">
        <div className="max-w-md rounded-3xl border border-border bg-surface p-8 text-center shadow-xl">
          <div className="mb-3 text-xs uppercase tracking-[0.24em] text-text-muted">Second Brain</div>
          <h1 className="mb-3 text-3xl font-serif">Preparing desktop services</h1>
          <p className="text-sm text-text-muted">
            Starting the local Python sidecar and warming up your knowledge base.
          </p>
        </div>
      </div>
    );
  }

  if (isDesktop && error) {
    return (
      <div className="flex h-screen items-center justify-center bg-bg-base px-6 text-text-main">
        <div className="max-w-md rounded-3xl border border-border bg-surface p-8 text-center shadow-xl">
          <h1 className="mb-3 text-3xl font-serif">Desktop startup failed</h1>
          <p className="mb-6 text-sm text-text-muted">{error}</p>
          <button className="btn" onClick={() => void retryStartup()}>
            Retry startup
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-bg-base text-text-main font-sans selection:bg-accent/30 selection:text-text-main">
      <button
        className="lg:hidden absolute top-4 left-4 z-50 p-2 rounded-full bg-surface shadow-md border border-border"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      <Sidebar 
        theme={theme}
        toggleTheme={toggleTheme}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        pulling={pulling}
        pullProgress={pullProgress}
        pullResult={pullResult}
      />

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
