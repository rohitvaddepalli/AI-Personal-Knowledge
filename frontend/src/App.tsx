import { BrowserRouter as Router, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { Suspense, lazy, useEffect, useState } from 'react';
import {
  BookOpen, PenTool, RefreshCw, LayoutTemplate, Network,
  HelpCircle, Layers, CheckSquare, Trash2,
  Settings as SettingsIcon, Plus, Menu, X,
  Database, BookMarked, Puzzle, Brain,
  Inbox, ChevronDown, ChevronUp, Command, GraduationCap, Upload,
} from 'lucide-react';
import { useDesktopRuntime } from './context/DesktopRuntimeContext';
import { DownloadProvider, useDownload } from './context/DownloadContext';
import CommandPalette from './components/CommandPalette';
import OnboardingModal from './components/OnboardingModal';
import FileUploadModal from './components/FileUploadModal';
import ResourceMonitorWidget from './components/ResourceMonitorWidget';
import './index.css';

const Dashboard    = lazy(() => import('./pages/Dashboard'));
const NoteList     = lazy(() => import('./pages/NoteList'));
const NoteEditor   = lazy(() => import('./pages/NoteEditor'));
const NoteDetail   = lazy(() => import('./pages/NoteDetail'));
const KnowledgeGraph = lazy(() => import('./pages/KnowledgeGraph'));
const AskBrain     = lazy(() => import('./pages/AskBrain'));
const Collections  = lazy(() => import('./pages/Collections'));
const Tasks        = lazy(() => import('./pages/Tasks'));
const Settings     = lazy(() => import('./pages/Settings'));
const Trash        = lazy(() => import('./pages/Trash'));
const Templates    = lazy(() => import('./pages/Templates'));
const Review       = lazy(() => import('./pages/Review'));
const DatabaseView = lazy(() => import('./pages/DatabaseView'));
const PromptsLibrary = lazy(() => import('./pages/PromptsLibrary'));
const PluginsPage  = lazy(() => import('./pages/PluginsPage'));
const InboxPage    = lazy(() => import('./pages/InboxPage'));
const FlashcardsPage = lazy(() => import('./pages/FlashcardsPage'));

// ── Navigation structure ───────────────────────────────────────────────────
// "core" = always visible in beginner mode
// "advanced" = shown under expandable section
const CORE_ITEMS = [
  { path: '/',         label: 'Dashboard',  icon: BookOpen },
  { path: '/inbox',    label: 'Inbox',      icon: Inbox,   badge: 'inbox' },
  { path: '/notes',    label: 'Notes',      icon: PenTool },
  { path: '/ask',      label: 'Ask Brain',  icon: HelpCircle },
  { path: '/review',   label: 'Review',     icon: RefreshCw },
];

const ADVANCED_ITEMS = [
  { path: '/graph',       label: 'Graph',       icon: Network },
  { path: '/collections', label: 'Collections', icon: Layers },
  { path: '/tasks',       label: 'Tasks',       icon: CheckSquare },
  { path: '/flashcards',  label: 'Flashcards',  icon: GraduationCap },
  { path: '/templates',   label: 'Templates',   icon: LayoutTemplate },
  { path: '/database',    label: 'Database',    icon: Database },
  { path: '/prompts',     label: 'Prompts',     icon: BookMarked },
  { path: '/plugins',     label: 'Plugins',     icon: Puzzle },
  { path: '/trash',       label: 'Trash',       icon: Trash2 },
  { path: '/settings',    label: 'Settings',    icon: SettingsIcon },
];

function PageWrapper({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex-1 min-h-0 ${className || ''}`}>{children}</div>;
}

const routeLoadingFallback = (
  <div className="flex-1 min-h-0 flex items-center justify-center" style={{ color: 'var(--on-surface-dim)' }}>
    <div className="flex items-center gap-3">
      <div style={{
        width: 20, height: 20, borderRadius: '50%',
        border: '2px solid var(--primary-dim)', borderTopColor: 'var(--primary)',
        animation: 'spin 0.8s linear infinite',
      }} />
      <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.875rem' }}>Loading...</span>
    </div>
  </div>
);

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <Suspense fallback={routeLoadingFallback}>
      <Routes location={location}>
        <Route path="/"           element={<PageWrapper><Dashboard /></PageWrapper>} />
        <Route path="/inbox"      element={<PageWrapper><InboxPage /></PageWrapper>} />
        <Route path="/notes"      element={<PageWrapper><NoteList /></PageWrapper>} />
        <Route path="/notes/new"  element={<PageWrapper><NoteEditor /></PageWrapper>} />
        <Route path="/notes/:id"  element={<PageWrapper><NoteDetail /></PageWrapper>} />
        <Route path="/review"     element={<PageWrapper><Review /></PageWrapper>} />
        <Route path="/templates"  element={<PageWrapper><Templates /></PageWrapper>} />
        <Route path="/graph"      element={<PageWrapper className="h-full"><KnowledgeGraph /></PageWrapper>} />
        <Route path="/ask"        element={<PageWrapper className="h-full"><AskBrain /></PageWrapper>} />
        <Route path="/collections" element={<PageWrapper><Collections /></PageWrapper>} />
        <Route path="/tasks"      element={<PageWrapper><Tasks /></PageWrapper>} />
        <Route path="/database"   element={<PageWrapper><DatabaseView /></PageWrapper>} />
        <Route path="/prompts"    element={<PageWrapper><PromptsLibrary /></PageWrapper>} />
        <Route path="/plugins"    element={<PageWrapper><PluginsPage /></PageWrapper>} />
        <Route path="/flashcards" element={<PageWrapper><FlashcardsPage /></PageWrapper>} />
        <Route path="/trash"      element={<PageWrapper><Trash /></PageWrapper>} />
        <Route path="/settings"   element={<PageWrapper><Settings /></PageWrapper>} />
      </Routes>
    </Suspense>
  );
}

// ── Sidebar nav item ───────────────────────────────────────────────────────
function NavItem({
  path, label, icon: Icon, active, onClick, inboxCount,
}: {
  path: string; label: string; icon: any; active: boolean; onClick: () => void; inboxCount?: number;
}) {
  return (
    <Link
      to={path}
      onClick={onClick}
      className={`nv-nav-item ${active ? 'active' : ''}`}
      style={{ flexDirection: 'row', gap: 10, padding: '8px 12px', position: 'relative' }}
    >
      <Icon size={18} strokeWidth={active ? 2 : 1.5} />
      <span style={{ flex: 1 }}>{label}</span>
      {inboxCount != null && inboxCount > 0 && (
        <span style={{
          padding: '1px 6px', borderRadius: 'var(--radius-full)',
          background: 'var(--primary)', color: 'var(--on-primary)',
          fontSize: '0.5rem', fontWeight: 700,
        }}>
          {inboxCount > 99 ? '99+' : inboxCount}
        </span>
      )}
    </Link>
  );
}

// ── App Content ────────────────────────────────────────────────────────────
function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { error, initializing, isDesktop, retryStartup } = useDesktopRuntime();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [inboxCount, setInboxCount] = useState(0);
  const { pulling, pullResult, pullProgress } = useDownload();

  // First-run onboarding check
  useEffect(() => {
    const done = localStorage.getItem('onboardingDone');
    if (!done) {
      // Small delay so the app finishes loading first
      setTimeout(() => setShowOnboarding(true), 800);
    }
  }, []);

  // Inbox badge count
  useEffect(() => {
    fetch('/api/inbox')
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setInboxCount(d.length); })
      .catch(() => {});
  }, [location.pathname]); // Refresh count on navigation

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const meta = e.ctrlKey || e.metaKey;
      if (meta && e.key === 'k') { e.preventDefault(); setCmdOpen(true); }
      if (meta && e.key === 'n') { e.preventDefault(); navigate('/notes/new'); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigate]);

  // Auto-expand Advanced if current route is advanced
  useEffect(() => {
    const isAdvanced = ADVANCED_ITEMS.some((i) => location.pathname.startsWith(i.path));
    if (isAdvanced) setAdvancedOpen(true);
  }, [location.pathname]);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    if (path === '/notes/new') return location.pathname === '/notes/new';
    if (path === '/notes') return location.pathname === '/notes' || (location.pathname.startsWith('/notes/') && location.pathname !== '/notes/new');
    return location.pathname.startsWith(path);
  };

  const isFluidPage = ['/ask', '/graph'].includes(location.pathname);

  // ── Loading / error screens ─────────────────────────────────────────────
  if (isDesktop && initializing) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: 'var(--surface)' }}>
        <div style={{ maxWidth: 400, borderRadius: 'var(--radius-xl)', background: 'var(--surface-container)', padding: 40, textAlign: 'center', border: '1px solid var(--outline)' }}>
          <div className="label-xs" style={{ marginBottom: 12 }}>Second Brain</div>
          <h2 style={{ marginBottom: 8 }}>Preparing your sanctuary</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)' }}>Starting local services and warming up your knowledge base.</p>
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
        <div style={{ maxWidth: 400, borderRadius: 'var(--radius-xl)', background: 'var(--surface-container)', padding: 40, textAlign: 'center', border: '1px solid var(--outline)' }}>
          <h2 style={{ marginBottom: 8 }}>Startup failed</h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--on-surface-variant)', marginBottom: 24 }}>{error}</p>
          <button className="btn" onClick={() => void retryStartup()}>Retry startup</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--surface)', color: 'var(--on-surface)' }}>
      {/* Overlays */}
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
      {showOnboarding && <OnboardingModal onDone={() => setShowOnboarding(false)} />}
      {showUpload && <FileUploadModal onClose={() => setShowUpload(false)} />}
      <ResourceMonitorWidget />

      {/* Mobile toggle */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50"
        onClick={() => setMobileOpen(!mobileOpen)}
        style={{ padding: 10, borderRadius: 'var(--radius-md)', background: 'var(--surface-container)', border: '1px solid var(--outline)', color: 'var(--on-surface)', cursor: 'pointer' }}
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

        {/* Command palette trigger */}
        <button
          onClick={() => setCmdOpen(true)}
          style={{
            margin: '8px 12px 4px', width: 'calc(100% - 24px)',
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '7px 12px', borderRadius: 'var(--radius-md)',
            background: 'var(--surface-container-lowest)',
            border: '1px solid var(--outline-variant)',
            color: 'var(--on-surface-dim)', cursor: 'pointer',
            fontSize: '0.75rem', fontFamily: 'var(--font-body)',
            transition: 'all 160ms',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-container)'; e.currentTarget.style.color = 'var(--on-surface)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface-container-lowest)'; e.currentTarget.style.color = 'var(--on-surface-dim)'; }}
        >
          <Command size={12} />
          <span style={{ flex: 1, textAlign: 'left' }}>⌘K</span>
          <kbd style={{ fontSize: '0.5rem', padding: '1px 4px', borderRadius: 3, border: '1px solid var(--outline-variant)', fontFamily: 'var(--font-mono)' }}>K</kbd>
        </button>

        {/* Core navigation */}
        <nav className="nv-nav" style={{ overflowY: 'auto', flex: 1 }}>
          {CORE_ITEMS.map((item) => (
            <NavItem
              key={item.path}
              {...item}
              active={isActive(item.path)}
              onClick={() => setMobileOpen(false)}
              inboxCount={item.badge === 'inbox' ? inboxCount : undefined}
            />
          ))}

          {/* Advanced section */}
          <div style={{ margin: '8px 0 0' }}>
            <button
              onClick={() => setAdvancedOpen(!advancedOpen)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 12px',
                background: 'transparent', border: 'none', cursor: 'pointer',
                color: 'var(--on-surface-dim)', fontSize: '0.6875rem',
                fontFamily: 'var(--font-display)', fontWeight: 700,
                textTransform: 'uppercase', letterSpacing: '0.08em',
                transition: 'color 160ms',
              }}
            >
              <span style={{ flex: 1, textAlign: 'left' }}>Advanced</span>
              {advancedOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </button>

            {advancedOpen && ADVANCED_ITEMS.map((item) => (
              <NavItem
                key={item.path}
                {...item}
                active={isActive(item.path)}
                onClick={() => setMobileOpen(false)}
              />
            ))}
          </div>
        </nav>

        {/* Bottom Actions */}
        <div className="nv-sidebar-bottom">
          {pulling && (
            <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--surface-container)', fontSize: '0.75rem' }}>
              <div style={{ color: 'var(--primary)', fontWeight: 600, marginBottom: 6 }}>Downloading Model...</div>
              <div style={{ height: 3, borderRadius: 99, background: 'var(--surface-container-low)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pullProgress}%`, background: 'linear-gradient(90deg, var(--primary), var(--primary-container))', transition: 'width 200ms linear' }} />
              </div>
              <div style={{ marginTop: 4, color: 'var(--on-surface-dim)', fontSize: '0.625rem' }}>{pullResult}</div>
            </div>
          )}
          <button
            className="btn-ghost"
            onClick={() => setShowUpload(true)}
            style={{ margin: '0 12px 6px', width: 'calc(100% - 24px)', fontSize: '0.75rem', gap: 6, justifyContent: 'center' }}
          >
            <Upload size={13} /> Import File
          </button>
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
        <div
          className={`flex-1 flex flex-col ${isFluidPage ? 'overflow-hidden' : 'overflow-y-auto'}`}
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
