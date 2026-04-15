import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { LayoutGrid, Table, CalendarDays, Pin, Filter, ChevronLeft, ChevronRight } from 'lucide-react';

interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  is_pinned: boolean;
  source_type: string | null;
}

type ViewMode = 'table' | 'kanban' | 'calendar';

// ---------- Table View ----------
function TableView({ notes }: { notes: Note[] }) {
  const [sortKey, setSortKey] = useState<keyof Note>('created_at');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const sorted = useMemo(() => {
    return [...notes].sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      const cmp = String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [notes, sortKey, sortDir]);

  const toggleSort = (key: keyof Note) => {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const colHeader = (label: string, key: keyof Note) => (
    <th
      onClick={() => toggleSort(key)}
      style={{ cursor: 'pointer', padding: '0.75rem 1rem', textAlign: 'left', whiteSpace: 'nowrap', userSelect: 'none', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border-color)' }}
    >
      {label} {sortKey === key ? (sortDir === 'asc' ? '↑' : '↓') : ''}
    </th>
  );

  return (
    <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
        <thead style={{ backgroundColor: 'var(--bg-highlight)' }}>
          <tr>
            {colHeader('Title', 'title')}
            {colHeader('Tags', 'tags')}
            {colHeader('Type', 'source_type')}
            {colHeader('Created', 'created_at')}
            {colHeader('Updated', 'updated_at')}
            <th style={{ padding: '0.75rem 1rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, borderBottom: '1px solid var(--border-color)' }}>Pinned</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((note, i) => (
            <tr
              key={note.id}
              style={{ backgroundColor: i % 2 === 0 ? 'transparent' : 'var(--bg-highlight)', transition: 'background 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--accent-color)12')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = i % 2 === 0 ? 'transparent' : 'var(--bg-highlight)')}
            >
              <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', maxWidth: '260px' }}>
                <Link to={`/notes/${note.id}`} style={{ color: 'var(--accent-color)', textDecoration: 'none', fontWeight: 500, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {note.title}
                </Link>
              </td>
              <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                  {note.tags?.slice(0, 3).map(t => (
                    <span key={t} style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '12px', backgroundColor: 'var(--accent-color)22', color: 'var(--accent-color)', border: '1px solid var(--accent-color)44' }}>
                      #{t}
                    </span>
                  ))}
                  {note.tags?.length > 3 && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>+{note.tags.length - 3}</span>}
                </div>
              </td>
              <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                {note.source_type || '—'}
              </td>
              <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                {new Date(note.created_at).toLocaleDateString()}
              </td>
              <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                {note.updated_at ? new Date(note.updated_at).toLocaleDateString() : '—'}
              </td>
              <td style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border-color)', textAlign: 'center' }}>
                {note.is_pinned ? <Pin size={14} style={{ color: 'var(--accent-color)' }} /> : <span style={{ color: 'var(--border-color)' }}>—</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------- Kanban View ----------
const KANBAN_COLUMNS: { key: string; label: string; color: string }[] = [
  { key: 'untagged', label: '📝 Untagged', color: '#8a887d' },
  { key: 'ai', label: '🤖 AI', color: '#7a8b75' },
  { key: 'research', label: '🔬 Research', color: '#6b7f99' },
  { key: 'journal', label: '📓 Journal', color: '#c4a962' },
  { key: 'other', label: '📁 Other', color: '#9b7faa' },
];

function KanbanView({ notes }: { notes: Note[] }) {
  const columns = useMemo(() => {
    const map: Record<string, Note[]> = { untagged: [], ai: [], research: [], journal: [], other: [] };
    notes.forEach(note => {
      if (!note.tags || note.tags.length === 0) { map.untagged.push(note); return; }
      let placed = false;
      for (const tag of note.tags) {
        if (tag.includes('ai') || tag.includes('ml') || tag.includes('llm')) { map.ai.push(note); placed = true; break; }
        if (tag.includes('research') || tag.includes('science') || tag.includes('study')) { map.research.push(note); placed = true; break; }
        if (tag.includes('journal') || tag.includes('daily') || tag.includes('diary')) { map.journal.push(note); placed = true; break; }
      }
      if (!placed) map.other.push(note);
    });
    return map;
  }, [notes]);

  return (
    <div style={{ display: 'flex', gap: '1rem', overflowX: 'auto', paddingBottom: '1rem', minHeight: '500px' }}>
      {KANBAN_COLUMNS.map(col => (
        <div key={col.key} style={{ minWidth: '260px', flex: '0 0 260px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.8rem', backgroundColor: 'var(--bg-highlight)', borderRadius: '10px', border: `1px solid ${col.color}44`, marginBottom: '0.5rem' }}>
            <span style={{ fontWeight: 600, fontSize: '0.85rem', color: col.color }}>{col.label}</span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', backgroundColor: col.color + '22', padding: '0.2rem 0.5rem', borderRadius: '8px' }}>{columns[col.key]?.length ?? 0}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, overflowY: 'auto', paddingRight: '2px' }}>
            {(columns[col.key] ?? []).map(note => (
              <Link key={note.id} to={`/notes/${note.id}`} style={{ textDecoration: 'none' }}>
                <div
                  className="card"
                  style={{ padding: '0.8rem', cursor: 'pointer', transition: 'all 0.15s', borderLeft: `3px solid ${col.color}` }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-1px)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
                >
                  <div style={{ fontWeight: 500, fontSize: '0.85rem', marginBottom: '0.4rem', color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {note.is_pinned && <Pin size={10} style={{ display: 'inline', marginRight: '0.3rem', color: 'var(--accent-color)' }} />}
                    {note.title}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {note.content?.substring(0, 60)}...
                  </div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    {new Date(note.created_at).toLocaleDateString()}
                  </div>
                </div>
              </Link>
            ))}
            {(columns[col.key] ?? []).length === 0 && (
              <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', border: '1px dashed var(--border-color)', borderRadius: '8px' }}>
                No notes
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- Calendar View ----------
function CalendarView({ notes }: { notes: Note[] }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth()); // 0-indexed

  const notesByDate = useMemo(() => {
    const map: Record<string, Note[]> = {};
    notes.forEach(note => {
      const d = new Date(note.created_at);
      if (d.getFullYear() === year && d.getMonth() === month) {
        const key = d.getDate().toString();
        if (!map[key]) map[key] = [];
        map[key].push(note);
      }
    });
    return map;
  }, [notes, year, month]);

  const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' });

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const prevMonth = () => { if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1); };
  const nextMonth = () => { if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1); };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <button className="btn" onClick={prevMonth} style={{ padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><ChevronLeft size={16} /></button>
        <h3 style={{ margin: 0, fontFamily: 'var(--font-serif)' }}>{monthName}</h3>
        <button className="btn" onClick={nextMonth} style={{ padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}><ChevronRight size={16} /></button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.4rem' }}>
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
          <div key={d} style={{ textAlign: 'center', padding: '0.4rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>{d}</div>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} />;
          const dayNotes = notesByDate[day.toString()] ?? [];
          const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
          return (
            <div
              key={day}
              style={{
                minHeight: '80px',
                padding: '0.4rem',
                borderRadius: '8px',
                border: `1px solid ${isToday ? 'var(--accent-color)' : 'var(--border-color)'}`,
                backgroundColor: isToday ? 'var(--accent-color)11' : 'transparent',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ fontSize: '0.8rem', fontWeight: isToday ? 700 : 400, color: isToday ? 'var(--accent-color)' : 'var(--text-muted)', marginBottom: '0.3rem' }}>{day}</div>
              {dayNotes.slice(0, 2).map(n => (
                <Link
                  key={n.id}
                  to={`/notes/${n.id}`}
                  title={n.title}
                  style={{ display: 'block', fontSize: '0.7rem', color: 'var(--accent-color)', textDecoration: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', padding: '0.15rem 0.3rem', borderRadius: '4px', backgroundColor: 'var(--accent-color)15', marginBottom: '0.15rem' }}
                >
                  {n.title}
                </Link>
              ))}
              {dayNotes.length > 2 && (
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'right' }}>+{dayNotes.length - 2} more</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------- Main Page ----------
export default function DatabaseView() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [tagFilter, setTagFilter] = useState('');

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/notes?limit=100');
      if (res.ok) {
        const data = await res.json();
        setNotes(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    notes.forEach(n => n.tags?.forEach(t => set.add(t)));
    return Array.from(set).sort();
  }, [notes]);

  const filtered = useMemo(() => {
    if (!tagFilter) return notes;
    return notes.filter(n => n.tags?.includes(tagFilter));
  }, [notes, tagFilter]);

  const VIEW_BUTTONS: { mode: ViewMode; icon: ReactNode; label: string }[] = [
    { mode: 'table', icon: <Table size={16} />, label: 'Table' },
    { mode: 'kanban', icon: <LayoutGrid size={16} />, label: 'Kanban' },
    { mode: 'calendar', icon: <CalendarDays size={16} />, label: 'Calendar' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%', overflowY: 'auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>Database View</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0.25rem 0 0' }}>Browse your notes as table, kanban, or calendar</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {/* Tag filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <Filter size={14} style={{ color: 'var(--text-muted)' }} />
            <select
              className="input"
              value={tagFilter}
              onChange={e => setTagFilter(e.target.value)}
              style={{ marginBottom: 0, width: '140px', fontSize: '0.85rem' }}
            >
              <option value="">All Tags</option>
              {allTags.map(t => <option key={t} value={t}>#{t}</option>)}
            </select>
          </div>
          {/* View toggle */}
          <div style={{ display: 'flex', border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden' }}>
            {VIEW_BUTTONS.map(({ mode, icon, label }) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '0.3rem',
                  padding: '0.5rem 0.9rem', border: 'none', cursor: 'pointer',
                  fontSize: '0.8rem', fontWeight: 500,
                  backgroundColor: viewMode === mode ? 'var(--accent-color)' : 'var(--surface-color)',
                  color: viewMode === mode ? 'var(--bg-color)' : 'var(--text-muted)',
                  transition: 'all 0.15s'
                }}
                title={label}
              >
                {icon} {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        {[
          { label: 'Total Notes', value: notes.length },
          { label: 'Pinned', value: notes.filter(n => n.is_pinned).length },
          { label: 'Tagged', value: notes.filter(n => n.tags?.length > 0).length },
          { label: 'Filtered', value: filtered.length },
        ].map(stat => (
          <div key={stat.label} className="card" style={{ padding: '0.6rem 1rem', flex: '1 0 100px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--accent-color)', fontFamily: 'var(--font-serif)' }}>{stat.value}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* View Content */}
      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>Loading notes...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '3rem' }}>No notes found.</div>
      ) : viewMode === 'table' ? (
        <TableView notes={filtered} />
      ) : viewMode === 'kanban' ? (
        <KanbanView notes={filtered} />
      ) : (
        <CalendarView notes={filtered} />
      )}
    </div>
  );
}
