import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  created_at: string;
  is_pinned: boolean;
}

export default function NoteList() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [importUrlStr, setImportUrlStr] = useState('');
  const [importing, setImporting] = useState(false);
  const [collections, setCollections] = useState<any[]>([]);
  const [selectedCol, setSelectedCol] = useState('');
  const [selectedNotes, setSelectedNotes] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('q');
    if (q) {
      setSearchQuery(q);
      fetchNotes(q);
    } else {
      fetchNotes();
    }
    fetchCollections();
  }, []);

  const fetchCollections = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/collections');
      const data = await res.json();
      setCollections(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchNotes = async (query?: string) => {
    if (query && query.trim()) {
      try {
        const res = await fetch('http://localhost:8000/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: query, limit: 20 })
        });
        const data = await res.json();
        setNotes(data);
      } catch (e) {
        console.error(e);
      }
    } else {
      try {
        const res = await fetch('http://localhost:8000/api/notes');
        const data = await res.json();
        setNotes(data);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleImport = async () => {
    if (!importUrlStr.trim()) return;
    setImporting(true);
    try {
      const res = await fetch('http://localhost:8000/api/import/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          url: importUrlStr,
          model: localStorage.getItem('activeModel') || 'qwen2.5:0.5b'
        })
      });
      if (!res.ok) throw new Error(await res.text());
      setImportUrlStr('');
      await fetchNotes();
      alert('Imported successfully!');
    } catch (e: any) {
      alert(`Import failed: ${e.message}`);
    } finally {
      setImporting(false);
    }
  };

  const deleteNote = async (id: string) => {
    if (!confirm('Are you sure you want to delete this note?')) return;
    try {
      const res = await fetch(`http://localhost:8000/api/notes/${id}`, { method: 'DELETE' });
      if (res.ok) fetchNotes();
    } catch (e) {
      console.error(e);
    }
  };

  const togglePin = async (id: string, isPinned: boolean) => {
    try {
      const res = await fetch(`http://localhost:8000/api/notes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_pinned: !isPinned }),
      });
      if (res.ok) fetchNotes();
    } catch (e) {
      console.error(e);
    }
  };

  const toggleNoteSelection = (id: string) => {
    const newSelected = new Set(selectedNotes);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedNotes(newSelected);
  };

  const selectAll = () => {
    setSelectedNotes(new Set(sortedNotes.map(n => n.id)));
  };

  const deselectAll = () => {
    setSelectedNotes(new Set());
  };

  const bulkDelete = async () => {
    if (!confirm(`Move ${selectedNotes.size} notes to trash?`)) return;
    for (const id of selectedNotes) {
      await fetch(`http://localhost:8000/api/notes/${id}`, { method: 'DELETE' });
    }
    setSelectedNotes(new Set());
    fetchNotes();
  };

  const bulkPin = async (pin: boolean) => {
    for (const id of selectedNotes) {
      await fetch(`http://localhost:8000/api/notes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_pinned: pin }),
      });
    }
    setSelectedNotes(new Set());
    fetchNotes();
  };

  const filteredNotes = selectedCol
    ? notes.filter(n => collections.find(c => c.id.toString() === selectedCol)?.notes.some((cn: any) => cn.id === n.id))
    : notes;

  // Sort: pinned notes first, then by date
  const sortedNotes = [...filteredNotes].sort((a, b) => {
    if (a.is_pinned && !b.is_pinned) return -1;
    if (!a.is_pinned && b.is_pinned) return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Notes</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            className="btn" 
            onClick={() => setBulkMode(!bulkMode)}
            style={{ 
              backgroundColor: bulkMode ? 'var(--accent-color)' : 'var(--surface-color)',
              color: bulkMode ? 'var(--bg-base)' : 'var(--text-main)',
              border: bulkMode ? 'none' : '1px solid var(--border-color)'
            }}
          >
            {bulkMode ? 'Done' : 'Select Multiple'}
          </button>
          <Link to="/notes/new" className="btn" style={{ textDecoration: 'none' }}>+ New Note</Link>
        </div>
      </div>
      
      {bulkMode && selectedNotes.size > 0 && (
        <div className="card" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.8rem' }}>
          <span style={{ color: 'var(--text-muted)', marginRight: '1rem' }}>
            {selectedNotes.size} selected
          </span>
          <button className="btn" onClick={selectAll} style={{ fontSize: '0.85rem' }}>Select All</button>
          <button className="btn" onClick={deselectAll} style={{ fontSize: '0.85rem', backgroundColor: 'var(--surface-color)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>Deselect</button>
          <button className="btn" onClick={() => bulkPin(true)} style={{ fontSize: '0.85rem' }}>📌 Pin</button>
          <button className="btn" onClick={() => bulkPin(false)} style={{ fontSize: '0.85rem', backgroundColor: 'var(--surface-color)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>📍 Unpin</button>
          <button className="btn" onClick={bulkDelete} style={{ fontSize: '0.85rem', backgroundColor: '#ff4444' }}>🗑️ Trash</button>
        </div>
      )}
      
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
        <select 
          className="input" 
          value={selectedCol} 
          onChange={e => setSelectedCol(e.target.value)}
          style={{ marginBottom: 0, width: '200px' }}
        >
          <option value="">All Collections</option>
          {collections.map(c => (
            <option key={c.id} value={c.id.toString()}>{c.name}</option>
          ))}
        </select>

        <input 
          className="input" 
          placeholder="Search semantic + keywords..." 
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && fetchNotes(searchQuery)}
          style={{ marginBottom: 0, flex: 2, color: 'var(--text-main)', backgroundColor: 'var(--bg-base)' }}
        />
        <button className="btn" onClick={() => fetchNotes(searchQuery)} style={{ backgroundColor: 'var(--surface-color)', color: 'var(--text-main)', border: '1px solid var(--border-color)' }}>Search</button>
        
        <input 
          className="input" 
          placeholder="YouTube or Website URL..." 
          value={importUrlStr}
          onChange={e => setImportUrlStr(e.target.value)}
          style={{ marginBottom: 0, flex: 1, color: 'var(--text-main)', backgroundColor: 'var(--bg-base)' }}
        />
        <button className="btn" onClick={handleImport} disabled={importing}>
          {importing ? 'Importing...' : 'Import URL'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
        {sortedNotes.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>No notes found. Create one!</p> : null}
        {sortedNotes.map(note => (
          <div key={note.id} className="card" style={{ position: 'relative' }}>
            {bulkMode && (
              <input
                type="checkbox"
                checked={selectedNotes.has(note.id)}
                onChange={() => toggleNoteSelection(note.id)}
                style={{
                  position: 'absolute',
                  top: '0.8rem',
                  left: '0.8rem',
                  width: '20px',
                  height: '20px',
                  cursor: 'pointer',
                  zIndex: 10
                }}
              />
            )}
            <button 
                onClick={(e) => { e.stopPropagation(); togglePin(note.id, note.is_pinned); }}
                style={{ 
                    position: 'absolute', 
                    top: '0.8rem', 
                    right: '2.5rem', 
                    background: 'transparent', 
                    border: 'none', 
                    color: note.is_pinned ? 'var(--accent-color)' : 'var(--text-muted)', 
                    cursor: 'pointer',
                    fontSize: '1.2rem',
                    opacity: note.is_pinned ? 1 : 0.4
                }}
                title={note.is_pinned ? 'Unpin Note' : 'Pin Note'}
            >
                {note.is_pinned ? '📌' : '📍'}
            </button>
            <button 
                onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }}
                style={{ 
                    position: 'absolute', 
                    top: '0.8rem', 
                    right: '0.8rem', 
                    background: 'transparent', 
                    border: 'none', 
                    color: '#ff4444', 
                    cursor: 'pointer',
                    fontSize: '1.2rem',
                    opacity: 0.6
                }}
                title="Delete Note"
            >
                🗑
            </button>
            <Link to={`/notes/${note.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
              <h3 style={{ marginBottom: '0.5rem', cursor: 'pointer', paddingRight: '2.5rem', paddingLeft: bulkMode ? '2rem' : '0' }}>
                {note.is_pinned && <span style={{ marginRight: '0.3rem' }}>📌</span>}
                {note.title}
              </h3>
            </Link>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              {note.content.substring(0, 100)}...
            </p>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {note.tags?.map(tag => (
                <span key={tag} style={{ backgroundColor: 'var(--accent-color)', padding: '0.2rem 0.5rem', borderRadius: '1rem', fontSize: '0.8rem' }}>
                  #{tag}
                </span>
              ))}
            </div>
            <div style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {new Date(note.created_at).toLocaleDateString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
