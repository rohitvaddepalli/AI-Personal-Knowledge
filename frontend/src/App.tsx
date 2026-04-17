import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { Suspense, lazy, useEffect, useState } from 'react';
import {
  BookOpen, PenTool, RefreshCw, LayoutTemplate, Network,
  HelpCircle, Layers, CheckSquare, Trash2,
  Settings as SettingsIcon, Plus, Search, Bell, Menu, X,
  Database, BookMarked, Puzzle, Brain
} from 'lucide-react';
import { useDesktopRuntime } from './context/DesktopRuntimeContext';
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
const DatabaseView = lazy(() => import('./pages/DatabaseView'));
const PromptsLibrary = lazy(() => import('./pages/PromptsLibrary'));
const PluginsPage = lazy(() => import('./pages/PluginsPage'));

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: BookOpen },
  { path: '/notes', label: 'Notes', icon: PenTool },
  { path: '/notes/new', label: 'New Note', icon: PenTool },
  { path: '/review', label: 'Review', icon: RefreshCw },
  { path: '/templates', label: 'Templates', icon: LayoutTemplate },
  { path: '/graph', label: 'Graph', icon: Network },
  { path: '/ask', label: 'Ask Brain', icon: HelpCircle },
  { path: '/collections', label: 'Collections', icon: Layers },
  { path: '/tasks', label: 'Tasks', icon: CheckSquare },
  { path: '/database', label: 'Database', icon: Database },
  { path: '/prompts', label: 'Prompts', icon: BookMarked },
  { path: '/plugins', label: 'Plugins', icon: Puzzle },
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
    <div className="flex-1 min-h-0 flex items-center justify-center" style={{ color: 'var(--on-surface-dim)' }}>
      <div className="flex items-center gap-3">
        <div style={{
          width: 20, height: 20, borderRadius: '50%',
          border: '2px solid var(--primary-dim)',
          borderTopColor: 'var(--primary)',
          animation: 'spin 0.8s linear infinite'
        }} />
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.875rem' }}>Loading...</span>
      </div>
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pulling, pullResult, pullProgress } = useDownload();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'k') { e.preventDefault(); navigate('/notes'); }
      if (e.ctrlKey && e.key === 'n') { e.preventDefault(); navigate('/notes/new'); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  if (isDesktop && initializing) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: 'var(--surface)' }}>
        <div style={{
          maxWidth: 400, borderRadius: 'var(--radius-xl)',
          background: 'var(--surface-container)', padding: 40,
          textAlign: 'center', border: '1px solid var(--outline)'
        }}>
          <div className="label-xs" style={{ marginBottom: 12 }}>Second Brain</div>
          <h2 style={{ marginBottom: 8 }}>Preparing your sanctuary</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)' }}>
            Starting local services and warming up your knowledge base.
          </p>
          <div style={{ marginTop: 24, height: 3, borderRadius: 99, background: 'var(--surface-container-low)', overflow: 'hidden' }}>
            <div className="dashboard-progress-bar" style={{ height: '100%', width: '100%', background: 'linear-gradient(90deg, var(--primary), var(--primary-container))' }} />
          </div>
        </div>
      </div>
    );
  }

  if (isDesktop && error) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: 'var(--surface)' }}>
        <div style={{
          maxWidth: 400, borderRadius: 'var(--radius-xl)',
          background: 'var(--surface-container)', padding: 40,
          textAlign: 'center', border: '1px solid var(--outline)'
        }}>
          <h2 style={{ marginBottom: 8 }}>Startup failed</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)', marginBottom: 24 }}>{error}</p>
          <button className="btn" onClick={() => void retryStartup()}>
            Retry startup
          </button>
        </div>
      </div>
    );
  }

  const isFluidPage = ['/ask', '/graph'].includes(location.pathname);
  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    if (path === '/notes/new') return location.pathname === '/notes/new';
    if (path === '/notes') return location.pathname === '/notes' || (location.pathname.startsWith('/notes/') && location.pathname !== '/notes/new');
    return location.pathname.startsWith(path);
  };

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--surface)', color: 'var(--on-surface)' }}>
      {/* Mobile menu toggle */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50"
        onClick={() => setMobileOpen(!mobileOpen)}
        style={{
          padding: 10, borderRadius: 'var(--radius-md)',
          background: 'var(--surface-container)', border: '1px solid var(--outline)',
          color: 'var(--on-surface)', cursor: 'pointer'
        }}
      >
        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* ═══ Sidebar ═══ */}
      <aside className={`nv-sidebar ${mobileOpen ? 'open' : ''}`} style={{ width: 200, minWidth: 200 }}>
        {/* Brand */}
        <div className="nv-sidebar-brand">
          <div className="nv-sidebar-brand-icon">
            <Brain size={16} strokeWidth={2.5} style={{ color: 'var(--on-primary)' }} />
          </div>
          <h2>Second Brain</h2>
          <span className="nv-subtitle">AI Knowledge System</span>
        </div>

        {/* Navigation */}
        <nav className="nv-nav" style={{ overflowY: 'auto' }}>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={`nv-nav-item ${active ? 'active' : ''}`}
                style={{ flexDirection: 'row', gap: 10, padding: '8px 12px' }}
              >
                <Icon size={18} strokeWidth={active ? 2 : 1.5} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Bottom Actions */}
        <div className="nv-sidebar-bottom">
          {pulling && (
            <div style={{
              padding: '10px 12px', borderRadius: 'var(--radius-md)',
              background: 'var(--surface-container)', fontSize: '0.75rem'
            }}>
              <div style={{ color: 'var(--primary)', fontWeight: 600, marginBottom: 6 }}>Downloading Model...</div>
              <div style={{ height: 3, borderRadius: 99, background: 'var(--surface-container-low)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pullProgress}%`, background: 'linear-gradient(90deg, var(--primary), var(--primary-container))', transition: 'width 200ms linear' }} />
              </div>
              <div style={{ marginTop: 4, color: 'var(--on-surface-dim)', fontSize: '0.625rem' }}>{pullResult}</div>
            </div>
          )}

          <button
            className="nv-quick-capture"
            onClick={() => { navigate('/notes/new'); setMobileOpen(false); }}
          >
            <Plus size={14} strokeWidth={2.5} />
            Quick Capture
          </button>
        </div>
      </aside>

      {/* ═══ Main Content ═══ */}
      <main className={`flex-1 relative flex flex-col ${isFluidPage ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        {/* Top Bar */}
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 24px', gap: 16, flexShrink: 0,
          background: 'var(--surface)',
          borderBottom: '1px solid var(--outline-variant)',
          zIndex: 10,
        }}>
          {/* Search Bar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--surface-container-lowest)',
            borderRadius: 'var(--radius-full)',
            padding: '8px 16px', flex: 1, maxWidth: 400,
          }}>
            <Search size={16} style={{ color: 'var(--on-surface-dim)', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search your knowledge..."
              onFocus={() => navigate('/notes')}
              style={{
                background: 'transparent', border: 'none', outline: 'none',
                color: 'var(--on-surface)', fontSize: '0.8125rem',
                fontFamily: 'var(--font-body)', width: '100%',
              }}
            />
          </div>

          {/* Right actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--on-surface-dim)', padding: 6, borderRadius: 'var(--radius-md)',
              transition: 'color 200ms',
            }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--on-surface)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--on-surface-dim)')}
            >
              <Bell size={18} />
            </button>
            <div style={{
              width: 32, height: 32, borderRadius: 'var(--radius-full)',
              background: 'linear-gradient(135deg, var(--primary-container), var(--secondary))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.75rem', fontWeight: 700, color: '#fff', cursor: 'pointer',
            }}>
              U
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className={`flex-1 flex flex-col ${isFluidPage ? 'overflow-hidden' : 'overflow-y-auto'}`}
          style={{ padding: isFluidPage ? '0' : '24px 28px 80px 28px' }}
        >
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
