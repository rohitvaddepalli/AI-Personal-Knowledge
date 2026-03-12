import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

export default function Collections() {
  const [collections, setCollections] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');

  useEffect(() => {
    fetchCollections();
  }, []);

  const fetchCollections = () => {
    fetch('http://localhost:8000/api/collections')
      .then(res => res.json())
      .then(setCollections)
      .catch(console.error);
  };

  const createCollection = async () => {
    if (!name.trim()) return;
    try {
      await fetch('http://localhost:8000/api/collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description: desc })
      });
      setName('');
      setDesc('');
      fetchCollections();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <h1>Collections</h1>
      
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <h3>Create New Collection</h3>
        <input className="input" placeholder="Collection Name" value={name} onChange={e => setName(e.target.value)} />
        <textarea className="input" placeholder="Description (optional)" value={desc} onChange={e => setDesc(e.target.value)} rows={2} />
        <button className="btn" onClick={createCollection} style={{ alignSelf: 'flex-start' }}>Create</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
        {collections.map(col => (
          <div key={col.id} className="card">
            <h3>{col.name}</h3>
            <p style={{ color: 'var(--text-muted)' }}>{col.description}</p>
            <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.5rem' }}>
              <p style={{ fontSize: '0.9rem', marginBottom: '0.5rem' }}>{col.notes.length} notes</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {col.notes.map((n: any) => (
                  <Link key={n.id} to={`/notes/${n.id}`} style={{ backgroundColor: 'var(--bg-color)', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', textDecoration: 'none' }}>
                    📄 {n.title}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
