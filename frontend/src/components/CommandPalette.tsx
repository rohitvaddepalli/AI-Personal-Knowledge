import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Search, FileText, MessageSquare, Plus, Calendar,
  Link2, Brain, Archive, Inbox, Zap, Clock,
} from 'lucide-react';
import { apiUrl } from '../lib/api';

// ── Types ──────────────────────────────────────────────────────────────────
interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: React.ReactNode;
  category: string;
  action: () => void;
}

interface RecentEntry {
  id: string;
  label: string;
  type: 'command' | 'note';
  hint?: string;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

const HISTORY_KEY = 'cmd_palette_history';
const MAX_HISTORY = 8;

function loadHistory(): RecentEntry[] {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveHistory(entry: RecentEntry) {
  const history = loadHistory().filter((h) => h.id !== entry.id);
  history.unshift(entry);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
}

// ── Component ──────────────────────────────────────────────────────────────
export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [noteResults, setNoteResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(0);
  const [history, setHistory] = useState<RecentEntry[]>(() => loadHistory());
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // ── Static quick actions ─────────────────────────────────────────────────
  const buildCommands = useCallback((): Command[] => [
    {
      id: 'new-note',
      label: 'New Note',
      hint: 'Open the note editor',
      icon: <Plus size={15} />,
      category: 'Actions',
      action: () => navigate('/notes/new'),
    },
    {
      id: 'daily-note',
      label: 'Open Daily Note',
      hint: "Today's journal",
      icon: <Calendar size={15} />,
      category: 'Actions',
      action: async () => {
        try {
          const res = await fetch(apiUrl('/api/notes/daily/today'));
          if (res.ok) {
            const note = await res.json();
            navigate(`/notes/${note.id}`);
          }
        } catch { navigate('/notes'); }
      },
    },
    {
      id: 'ask-brain',
      label: 'Ask your Brain',
      hint: `Query "${query}" with AI`,
      icon: <Brain size={15} style={{ color: 'var(--primary)' }} />,
      category: 'Actions',
      action: () => {
        navigate('/ask');
        // Pre-fill the question if there's a query
        if (query.trim()) {
          setTimeout(() => {
            const ta = document.querySelector('textarea') as HTMLTextAreaElement | null;
            if (ta) {
              const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
              nativeInputValueSetter?.call(ta, query);
              ta.dispatchEvent(new Event('input', { bubbles: true }));
            }
          }, 200);
        }
      },
    },
    {
      id: 'import-url',
      label: 'Import URL',
      hint: 'Capture an article or page',
      icon: <Link2 size={15} />,
      category: 'Actions',
      action: () => navigate('/notes'),
    },
    {
      id: 'review',
      label: 'Review Due Notes',
      hint: 'Spaced repetition queue',
      icon: <Archive size={15} />,
      category: 'Actions',
      action: () => navigate('/review'),
    },
    {
      id: 'inbox',
      label: 'Open Inbox',
      hint: 'Triage unprocessed notes',
      icon: <Inbox size={15} />,
      category: 'Actions',
      action: () => navigate('/inbox'),
    },
    {
      id: 'chat',
      label: 'New AI Chat',
      hint: 'Start a fresh conversation',
      icon: <MessageSquare size={15} />,
      category: 'Actions',
      action: () => navigate('/ask'),
    },
  ], [navigate, query]);

  // ── Note search ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setNoteResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(apiUrl('/api/search'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: query.trim(), limit: 5 }),
        });
        if (res.ok) {
          const data = await res.json();
          setNoteResults(Array.isArray(data) ? data.slice(0, 5) : []);
        }
      } catch { setNoteResults([]); }
      finally { setSearching(false); }
    }, 180);
    return () => clearTimeout(timer);
  }, [query]);

  // ── Focus input on open ───────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(0);
      setNoteResults([]);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // ── Build combined result list ────────────────────────────────────────────
  const commands = buildCommands();
  const filteredCommands = query.trim()
    ? commands.filter((c) =>
        c.label.toLowerCase().includes(query.toLowerCase()) ||
        (c.hint || '').toLowerCase().includes(query.toLowerCase())
      )
    : commands;

  type ResultItem =
    | { kind: 'command'; data: Command }
    | { kind: 'note'; data: any }
    | { kind: 'history'; data: RecentEntry };

  const items: ResultItem[] = [];

  if (!query.trim()) {
    // Show recent actions first
    if (history.length > 0) {
      history.slice(0, 4).forEach((h) => items.push({ kind: 'history', data: h }));
    }
  }

  filteredCommands.forEach((c) => items.push({ kind: 'command', data: c }));
  noteResults.forEach((n) => items.push({ kind: 'note', data: n }));

  const totalItems = items.length;

  const execute = useCallback((item: ResultItem) => {
    if (item.kind === 'command') {
      saveHistory({ id: item.data.id, label: item.data.label, hint: item.data.hint, type: 'command' });
      setHistory(loadHistory());
      item.data.action();
    } else if (item.kind === 'note') {
      saveHistory({ id: item.data.id, label: item.data.title, hint: 'Note', type: 'note' });
      setHistory(loadHistory());
      navigate(`/notes/${item.data.id}`);
    } else if (item.kind === 'history') {
      // Re-run by finding matching command or navigating
      const cmd = commands.find((c) => c.id === item.data.id);
      if (cmd) { cmd.action(); }
      else if (item.data.type === 'note') { navigate(`/notes/${item.data.id}`); }
    }
    onClose();
  }, [commands, navigate, onClose]);

  // ── Keyboard navigation ───────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected((s) => (s + 1) % totalItems);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected((s) => (s - 1 + totalItems) % totalItems);
    } else if (e.key === 'Enter' && totalItems > 0) {
      e.preventDefault();
      execute(items[selected]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${selected}"]`) as HTMLElement | null;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  if (!open) return null;

  // ── Render helpers ────────────────────────────────────────────────────────
  const renderItem = (item: ResultItem, idx: number) => {
    const isSelected = idx === selected;
    const base: React.CSSProperties = {
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '9px 14px', borderRadius: 'var(--radius-md)',
      cursor: 'pointer', transition: 'background 120ms',
      background: isSelected ? 'var(--primary-dim)' : 'transparent',
    };

    if (item.kind === 'history') {
      return (
        <div key={`h-${item.data.id}`} data-idx={idx} style={base}
          onClick={() => execute(item)}
          onMouseEnter={() => setSelected(idx)}>
          <Clock size={13} style={{ color: 'var(--on-surface-dim)', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.8125rem', color: 'var(--on-surface)', fontFamily: 'var(--font-display)' }}>
              {item.data.label}
            </div>
            {item.data.hint && (
              <div style={{ fontSize: '0.6875rem', color: 'var(--on-surface-dim)' }}>{item.data.hint}</div>
            )}
          </div>
          <span style={{ fontSize: '0.5rem', color: 'var(--on-surface-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>recent</span>
        </div>
      );
    }

    if (item.kind === 'command') {
      return (
        <div key={`c-${item.data.id}`} data-idx={idx} style={base}
          onClick={() => execute(item)}
          onMouseEnter={() => setSelected(idx)}>
          <span style={{ color: isSelected ? 'var(--primary)' : 'var(--on-surface-dim)', flexShrink: 0 }}>
            {item.data.icon}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.8125rem', color: 'var(--on-surface)', fontFamily: 'var(--font-display)', fontWeight: 500 }}>
              {item.data.label}
            </div>
            {item.data.hint && (
              <div style={{ fontSize: '0.6875rem', color: 'var(--on-surface-dim)' }}>{item.data.hint}</div>
            )}
          </div>
          <kbd style={{
            fontSize: '0.5625rem', padding: '2px 6px',
            borderRadius: 4, border: '1px solid var(--outline-variant)',
            color: 'var(--on-surface-dim)', background: 'var(--surface-container-highest)',
            fontFamily: 'var(--font-mono)', letterSpacing: '0.04em', flexShrink: 0,
          }}>
            {item.data.category}
          </kbd>
        </div>
      );
    }

    if (item.kind === 'note') {
      return (
        <div key={`n-${item.data.id}`} data-idx={idx} style={base}
          onClick={() => execute(item)}
          onMouseEnter={() => setSelected(idx)}>
          <FileText size={13} style={{ color: isSelected ? 'var(--secondary)' : 'var(--on-surface-dim)', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.8125rem', color: 'var(--on-surface)', fontFamily: 'var(--font-display)', fontWeight: 500 }}>
              {item.data.title}
            </div>
            {item.data.content && (
              <div style={{
                fontSize: '0.6875rem', color: 'var(--on-surface-dim)',
                overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
              }}>
                {item.data.content.substring(0, 80)}
              </div>
            )}
          </div>
          <kbd style={{
            fontSize: '0.5625rem', padding: '2px 6px',
            borderRadius: 4, border: '1px solid var(--outline-variant)',
            color: 'var(--secondary)', background: 'var(--secondary-container)',
            fontFamily: 'var(--font-mono)', flexShrink: 0,
          }}>Note</kbd>
        </div>
      );
    }

    return null;
  };

  // Group headers
  const sections: { title?: string; items: ResultItem[] }[] = [];
  if (!query.trim() && history.length > 0) {
    sections.push({ title: 'Recent', items: items.filter((i) => i.kind === 'history') });
  }
  const actionItems = items.filter((i) => i.kind === 'command');
  if (actionItems.length) sections.push({ title: query.trim() ? undefined : 'Quick Actions', items: actionItems });
  const noteItems = items.filter((i) => i.kind === 'note');
  if (noteItems.length) sections.push({ title: 'Notes', items: noteItems });

  let globalIdx = 0;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 400,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '12vh',
      }}
      onClick={onClose}
    >
      <div
        className="animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 560, maxHeight: '70vh',
          background: 'var(--surface-container)',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--outline)',
          boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
          overflow: 'hidden',
          display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Search input */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '14px 18px',
          borderBottom: '1px solid var(--outline-variant)',
        }}>
          {searching
            ? <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid var(--primary-dim)', borderTopColor: 'var(--primary)', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
            : <Search size={18} style={{ color: 'var(--on-surface-dim)', flexShrink: 0 }} />
          }
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(0); }}
            onKeyDown={handleKeyDown}
            placeholder="Search notes or run a command..."
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--on-surface)', fontSize: '0.9375rem', fontFamily: 'var(--font-body)',
            }}
          />
          <kbd style={{
            fontSize: '0.6875rem', padding: '3px 8px',
            borderRadius: 6, border: '1px solid var(--outline-variant)',
            color: 'var(--on-surface-dim)', background: 'var(--surface-container-highest)',
            fontFamily: 'var(--font-mono)', flexShrink: 0,
          }}>Esc</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} style={{ overflowY: 'auto', flex: 1, padding: '8px' }}>
          {items.length === 0 && query.trim() && !searching && (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--on-surface-dim)', fontSize: '0.875rem' }}>
              No results for "<strong>{query}</strong>"
            </div>
          )}

          {sections.map((section, si) => (
            <div key={si}>
              {section.title && (
                <div style={{
                  padding: '6px 14px 4px',
                  fontSize: '0.5625rem', fontFamily: 'var(--font-display)',
                  fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
                  color: 'var(--on-surface-dim)',
                }}>
                  {section.title}
                </div>
              )}
              {section.items.map((item) => {
                const el = renderItem(item, globalIdx);
                globalIdx++;
                return el;
              })}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{
          display: 'flex', gap: 12, padding: '8px 16px',
          borderTop: '1px solid var(--outline-variant)',
          fontSize: '0.625rem', color: 'var(--on-surface-dim)',
          fontFamily: 'var(--font-mono)',
        }}>
          <span><kbd style={{ padding: '1px 5px', borderRadius: 4, border: '1px solid var(--outline-variant)', fontSize: '0.5625rem' }}>↑↓</kbd> navigate</span>
          <span><kbd style={{ padding: '1px 5px', borderRadius: 4, border: '1px solid var(--outline-variant)', fontSize: '0.5625rem' }}>↵</kbd> run</span>
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Zap size={9} style={{ color: 'var(--primary)' }} /> Second Brain — Ctrl+K
          </span>
        </div>
      </div>
    </div>
  );
}
