import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowLeft, ArrowLeftRight, Link2Off } from 'lucide-react';

interface Connection {
  id: number;
  source_note_id: string;
  target_note_id: string;
  relationship_type: string;
  strength: number;
  ai_explanation: string;
}

interface NoteInfo {
  id: string;
  title: string;
  content?: string;
}

type LinkDirection = 'incoming' | 'outgoing' | 'bidirectional';

interface RichConnection {
  connection: Connection;
  note: NoteInfo | null;
  direction: LinkDirection;
}

function DirectionIcon({ direction }: { direction: LinkDirection }) {
  const style = { flexShrink: 0 };
  if (direction === 'incoming') return <ArrowLeft size={12} style={{ ...style, color: '#6b7f99' }} />;
  if (direction === 'outgoing') return <ArrowRight size={12} style={{ ...style, color: 'var(--accent-color)' }} />;
  return <ArrowLeftRight size={12} style={{ ...style, color: 'var(--accent-amber)' }} />;
}

const STRENGTH_COLOR = (s: number) => {
  if (s >= 0.8) return 'var(--accent-color)';
  if (s >= 0.5) return 'var(--accent-amber)';
  return 'var(--text-muted)';
};

export default function ConnectionsSidebar({ noteId }: { noteId: string }) {
  const [rich, setRich] = useState<RichConnection[]>([]);
  const [backlinks, setBacklinks] = useState<NoteInfo[]>([]);
  const [unlinked, setUnlinked] = useState<NoteInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'connections' | 'backlinks' | 'unlinked'>('connections');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const fetchAll = async () => {
      try {
        // Fetch AI connections
        const connRes = await fetch(`http://localhost:8000/api/connections/note/${noteId}`);
        const connections: Connection[] = connRes.ok ? await connRes.json() : [];

        const noteMap: Record<string, NoteInfo> = {};
        const ids = [...new Set(connections.flatMap(c => [c.source_note_id, c.target_note_id]))].filter(id => id !== noteId);
        await Promise.allSettled(ids.map(async id => {
          try {
            const r = await fetch(`http://localhost:8000/api/notes/${id}`);
            if (r.ok) noteMap[id] = await r.json();
          } catch {}
        }));

        if (!cancelled) {
          const richConnections: RichConnection[] = connections.map(c => {
            const otherId = c.source_note_id === noteId ? c.target_note_id : c.source_note_id;
            const isIncoming = c.target_note_id === noteId;
            // Check if reverse connection also exists
            const hasBoth = connections.some(
              c2 => c2.source_note_id === otherId && c2.target_note_id === noteId
            ) && connections.some(
              c2 => c2.source_note_id === noteId && c2.target_note_id === otherId
            );
            const direction: LinkDirection = hasBoth ? 'bidirectional' : isIncoming ? 'incoming' : 'outgoing';
            return { connection: c, note: noteMap[otherId] ?? null, direction };
          });
          // De-duplicate bidirectional (keep only one entry per pair)
          const seen = new Set<string>();
          const deduped = richConnections.filter(rc => {
            if (rc.direction !== 'bidirectional') return true;
            const otherId = rc.connection.source_note_id === noteId ? rc.connection.target_note_id : rc.connection.source_note_id;
            const key = [noteId, otherId].sort().join('|');
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          setRich(deduped);
        }

        // Fetch note details for backlinks from the note endpoint (already computed by backend)
        const noteRes = await fetch(`http://localhost:8000/api/notes/${noteId}`);
        if (noteRes.ok && !cancelled) {
          const noteData = await noteRes.json();
          setBacklinks(noteData.backlinks ?? []);
        }

        // Search for unlinked mentions (notes that mention this note's title but aren't wikilinked)
        // We use a lightweight client-side approach: fetch nearby notes and check content
        if (!cancelled) {
          try {
            const allRes = await fetch('http://localhost:8000/api/notes?limit=100');
            const allNotes: NoteInfo[] = allRes.ok ? await allRes.json() : [];
            const thisNote = await (await fetch(`http://localhost:8000/api/notes/${noteId}`)).json();
            if (thisNote && thisNote.title) {
              const titleLower = thisNote.title.toLowerCase();
              const wikiLinkPattern = `[[${thisNote.title}]]`;
              const unlinkedMentions = allNotes.filter(n => {
                if (n.id === noteId) return false;
                const content = (n.content ?? '').toLowerCase();
                return content.includes(titleLower) && !content.includes(wikiLinkPattern.toLowerCase());
              });
              if (!cancelled) setUnlinked(unlinkedMentions);
            }
          } catch {}
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchAll();
    return () => { cancelled = true; };
  }, [noteId]);

  const tabs: { key: typeof activeTab; label: string; count: number }[] = [
    { key: 'connections', label: 'Links', count: rich.length },
    { key: 'backlinks', label: 'Backlinks', count: backlinks.length },
    { key: 'unlinked', label: 'Unlinked', count: unlinked.length },
  ];

  return (
    <div className="card" style={{ height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '1rem' }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1, padding: '0.4rem 0.3rem', border: 'none', background: 'transparent',
              cursor: 'pointer', fontSize: '0.75rem', fontWeight: activeTab === tab.key ? 600 : 400,
              color: activeTab === tab.key ? 'var(--accent-color)' : 'var(--text-muted)',
              borderBottom: activeTab === tab.key ? '2px solid var(--accent-color)' : '2px solid transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem',
              transition: 'all 0.15s',
            }}
          >
            {tab.label}
            {tab.count > 0 && (
              <span style={{ fontSize: '0.65rem', backgroundColor: activeTab === tab.key ? 'var(--accent-color)' : 'var(--border-color)', color: activeTab === tab.key ? 'var(--bg-color)' : 'var(--text-muted)', padding: '0 0.3rem', borderRadius: '8px' }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading...</p>}

      {/* Connections Tab */}
      {!loading && activeTab === 'connections' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', flex: 1 }}>
          {rich.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No AI connections found yet.</p>
          ) : rich.map(rc => (
            <div key={rc.connection.id} style={{ padding: '0.75rem', backgroundColor: 'var(--bg-highlight)', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <DirectionIcon direction={rc.direction} />
                <Link to={`/notes/${rc.note?.id ?? ''}`} style={{ color: 'var(--text-main)', textDecoration: 'none', fontWeight: 500, fontSize: '0.85rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {rc.note?.title ?? 'Unknown'}
                </Link>
                <span style={{ fontSize: '0.7rem', color: STRENGTH_COLOR(rc.connection.strength), fontWeight: 600 }}>
                  {(rc.connection.strength * 100).toFixed(0)}%
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: '6px', backgroundColor: 'var(--accent-color)18', color: 'var(--accent-color)', border: '1px solid var(--accent-color)30' }}>
                  {rc.connection.relationship_type || 'similar'}
                </span>
                <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', borderRadius: '6px', backgroundColor: 'var(--bg-highlight)', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}>
                  {rc.direction}
                </span>
              </div>
              {rc.connection.ai_explanation && (
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, fontStyle: 'italic', lineHeight: 1.4 }}>
                  "{rc.connection.ai_explanation}"
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Backlinks Tab */}
      {!loading && activeTab === 'backlinks' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
          {backlinks.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No notes link to this one with {'[[wiki-links]]'} yet.</p>
          ) : backlinks.map(bl => (
            <div key={bl.id} style={{ padding: '0.6rem 0.75rem', backgroundColor: 'var(--bg-highlight)', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ArrowLeft size={12} style={{ color: '#6b7f99', flexShrink: 0 }} />
              <Link to={`/notes/${bl.id}`} style={{ color: 'var(--text-main)', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {bl.title}
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Unlinked Mentions Tab */}
      {!loading && activeTab === 'unlinked' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1 }}>
          {unlinked.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No unlinked mentions found.</p>
          ) : (
            <>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', margin: '0 0 0.5rem' }}>
                These notes mention this note's title without a {'[[wiki-link]]'}:
              </p>
              {unlinked.map(n => (
                <div key={n.id} style={{ padding: '0.6rem 0.75rem', backgroundColor: 'var(--bg-highlight)', borderRadius: '8px', border: '1px dashed var(--border-color)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Link2Off size={12} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <Link to={`/notes/${n.id}`} style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.85rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {n.title}
                  </Link>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}
