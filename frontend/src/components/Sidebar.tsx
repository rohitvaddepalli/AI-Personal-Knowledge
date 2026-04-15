import { Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { 
  BookOpen, PenTool, RefreshCw, LayoutTemplate, Network, HelpCircle, 
  LayoutGrid, Sparkles, Layers, CheckSquare, Puzzle, Trash2, 
  Settings as SettingsIcon, Sun, Moon, ChevronRight, ChevronDown, FileText
} from 'lucide-react';
import axios from 'axios';

export const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: BookOpen },
  { path: '/notes', label: 'Notes', icon: PenTool },
  { path: '/review', label: 'Review', icon: RefreshCw },
  { path: '/notes/new', label: 'New Note', icon: PenTool },
  { path: '/templates', label: 'Templates', icon: LayoutTemplate },
  { path: '/graph', label: 'Graph', icon: Network },
  { path: '/ask', label: 'Ask Brain', icon: HelpCircle },
  { path: '/database', label: 'Database', icon: LayoutGrid },
  { path: '/prompts', label: 'Prompts', icon: Sparkles },
  { path: '/collections', label: 'Collections', icon: Layers },
  { path: '/tasks', label: 'Tasks', icon: CheckSquare },
  { path: '/plugins', label: 'Plugins', icon: Puzzle },
  { path: '/trash', label: 'Trash', icon: Trash2 },
  { path: '/settings', label: 'Settings', icon: SettingsIcon },
];

interface TreeNode {
  id: string;
  title: string;
  children: TreeNode[];
}

interface SidebarProps {
  theme: string;
  toggleTheme: () => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  pulling?: boolean;
  pullProgress?: number;
  pullResult?: string | null;
}

const TreeViewItem = ({ node, level = 0, onSelect }: { node: TreeNode; level?: number; onSelect: () => void }) => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const isActive = location.pathname === `/notes/${node.id}`;
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="space-y-0.5">
      <div 
        className={`flex items-center gap-1 group rounded-lg transition-colors cursor-pointer ${
          isActive ? 'bg-accent/10 text-accent' : 'text-text-muted hover:text-text-main hover:bg-white/5'
        }`}
        style={{ paddingLeft: `${level * 0.75 + 0.5}rem` }}
      >
        <button 
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsOpen(!isOpen); }}
          className={`p-1 rounded hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity ${hasChildren ? 'opacity-100' : 'pointer-events-none'}`}
        >
          {hasChildren ? (
            isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />
          ) : (
            <div className="w-3" />
          )}
        </button>
        <Link 
          to={`/notes/${node.id}`} 
          onClick={onSelect}
          className="flex-1 flex items-center gap-2 py-1.5 pr-2 truncate text-sm"
        >
          <FileText size={14} className={isActive ? 'text-accent' : 'text-text-muted/60'} />
          <span className="truncate">{node.title || 'Untitled Note'}</span>
        </Link>
      </div>
      {isOpen && hasChildren && (
        <div className="space-y-0.5">
          {node.children.map(child => (
            <TreeViewItem key={child.id} node={child} level={level + 1} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
};

export function Sidebar({ 
  theme, toggleTheme, mobileOpen, setMobileOpen, 
  pulling, pullProgress, pullResult 
}: SidebarProps) {
  const location = useLocation();
  const [treeData, setTreeData] = useState<TreeNode[]>([]);
  const [loadingTree, setLoadingTree] = useState(true);

  useEffect(() => {
    const fetchTree = async () => {
      try {
        const res = await axios.get('/api/notes/full-tree');
        setTreeData(res.data);
      } catch (err) {
        console.error('Failed to fetch note tree:', err);
      } finally {
        setLoadingTree(false);
      }
    };
    fetchTree();
  }, [location.pathname]); // Refresh tree when navigating

  return (
    <aside 
      className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-border bg-surface/80 backdrop-blur-xl transform transition-transform duration-300 ease-out lg:static lg:translate-x-0 flex flex-col ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
    >
      <div className="p-6">
        <h2 className="text-2xl font-serif font-medium tracking-tight flex items-center gap-3">
          <span className="text-accent">✧</span> Second Brain
        </h2>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-2 space-y-6">
        {/* Main Navigation */}
        <div className="space-y-1">
          <div className="px-3 mb-2 text-[0.65rem] uppercase tracking-[0.2em] text-text-muted/60 font-semibold">Menu</div>
          {NAV_ITEMS.slice(0, 3).map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-accent/10 text-accent font-medium'
                    : 'text-text-muted hover:text-text-main hover:bg-white/5'
                }`}
              >
                <Icon size={18} className={isActive ? 'text-accent' : 'text-text-muted'} />
                <span className="text-sm">{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Hierarchical Notes Tree */}
        <div className="space-y-2">
          <div className="px-3 flex items-center justify-between">
            <span className="text-[0.65rem] uppercase tracking-[0.2em] text-text-muted/60 font-semibold">Knowledge Base</span>
            <Link to="/notes/new" className="text-accent hover:rotate-90 transition-transform">
              <PenTool size={12} />
            </Link>
          </div>
          <div className="space-y-1 max-h-[40vh] overflow-y-auto custom-scrollbar pr-1">
            {loadingTree ? (
              <div className="px-3 py-2 text-xs text-text-muted animate-pulse">Loading tree...</div>
            ) : treeData.length > 0 ? (
              treeData.map(node => (
                <TreeViewItem key={node.id} node={node} onSelect={() => setMobileOpen(false)} />
              ))
            ) : (
              <div className="px-3 py-2 text-xs text-text-muted italic">No notes yet</div>
            )}
          </div>
        </div>

        {/* Tools & Settings */}
        <div className="space-y-1">
          <div className="px-3 mb-2 text-[0.65rem] uppercase tracking-[0.2em] text-text-muted/60 font-semibold">Library</div>
          {NAV_ITEMS.slice(3).map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-200 ${
                  isActive
                    ? 'bg-accent/10 text-accent font-medium'
                    : 'text-text-muted hover:text-text-main hover:bg-white/5'
                }`}
              >
                <Icon size={16} className={isActive ? 'text-accent' : 'text-text-muted'} />
                <span className="text-sm">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="p-4 border-t border-border bg-surface/50">
        {pulling && (
          <div className="mb-4 p-3 bg-bg-highlight/50 rounded-xl border border-border text-[0.7rem]">
            <div className="font-medium text-accent mb-1.5 flex justify-between">
              <span>Syncing AI Model</span>
              <span>{Math.round(pullProgress || 0)}%</span>
            </div>
            <div className="w-full bg-bg-base/50 rounded-full h-1 overflow-hidden">
              <div
                className="h-full bg-accent transition-[width] duration-300 ease-out"
                style={{ width: `${pullProgress}%` }}
              />
            </div>
            {pullResult && <div className="mt-1.5 text-text-muted italic truncate opacity-60 uppercase text-[0.6rem] tracking-wider">{pullResult}</div>}
          </div>
        )}
        <button
          onClick={toggleTheme}
          className="flex items-center justify-between w-full px-4 py-2.5 rounded-xl bg-bg-base/40 border border-border hover:border-accent/30 text-text-muted hover:text-text-main transition-all group shadow-sm"
        >
          <span className="text-xs font-medium uppercase tracking-wider">{theme === 'dark' ? 'Lights On' : 'Go Dark'}</span>
          {theme === 'dark' ? 
            <Sun size={14} className="group-hover:rotate-45 transition-transform" /> : 
            <Moon size={14} className="group-hover:-rotate-12 transition-transform" /> 
          }
        </button>
      </div>
    </aside>
  );
}
