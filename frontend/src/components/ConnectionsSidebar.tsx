import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowLeft, ArrowLeftRight, Link2Off, Sparkles } from 'lucide-react';

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
  if (direction === 'incoming') return <ArrowLeft size={12} style={{ flexShrink: 0, color: 'var(--on-surface-dim)' }} />;
  if (direction === 'outgoing') return <ArrowRight size={12} style={{ flexShrink: 0, color: 'var(--primary)' }} />;
  return <ArrowLeftRight size={12} style={{ flexShrink: 0, color: 'var(--tertiary)' }} />;
}

const strengthColor = (s: number) => {
  if (s >= 0.8) return 'var(--primary)';
  if (s >= 0.5) return 'var(--tertiary)';
  return 'var(--on-surface-dim)';
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
            const hasBoth = connections.some(c2 => c2.source_note_id === otherId && c2.target_note_id === noteId)
              && connections.some(c2 => c2.source_note_id === noteId && c2.target_note_id === otherId);
            const direction: LinkDirection = hasBoth ? 'bidirectional' : isIncoming ? 'incoming' : 'outgoing';
            return { connection: c, note: noteMap[otherId] ?? null, direction };
          });

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

        const noteRes = await fetch(`http://localhost:8000/api/notes/${noteId}`);
        if (noteRes.ok && !cancelled) {
          const noteData = await noteRes.json();
          setBacklinks(noteData.backlinks ?? []);
        }

        if (!cancelled) {
          try {
            const allRes = await fetch('http://localhost:8000/api/notes?limit=100');
            const allNotes: NoteInfo[] = allRes.ok ? await allRes.json() : [];
            const thisNote = await (await fetch(`http://localhost:8000/api/notes/${noteId}`)).json();
            if (thisNote?.title) {
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', marginBottom: 12 }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              flex: 1, padding: '6px 4px', border: 'none', background: 'transparent',
              cursor: 'pointer', fontSize: '0.6875rem',
              fontFamily: 'var(--font-display)', fontWeight: activeTab === tab.key ? 600 : 400,
              color: activeTab === tab.key ? 'var(--primary)' : 'var(--on-surface-dim)',
              borderBottom: activeTab === tab.key ? '2px solid var(--primary)' : '2px solid transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
              transition: 'all 200ms',
            }}
          >
            {tab.label}
            {tab.count > 0 && (
              <span style={{
                fontSize: '0.5625rem',
                backgroundColor: activeTab === tab.key ? 'var(--primary-dim)' : 'var(--surface-container-high)',
                color: activeTab === tab.key ? 'var(--primary)' : 'var(--on-surface-dim)',
                padding: '0 5px', borderRadius: 'var(--radius-full)',
                fontWeight: 600,
              }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--on-surface-dim)', fontSize: '0.8125rem' }}>
          <div style={{
            width: 14, height: 14, borderRadius: '50%',
            border: '2px solid var(--primary-dim)', borderTopColor: 'var(--primary)',
            animation: 'spin 0.8s linear infinite',
          }} />
          Loading...
        </div>
      )}

      {/* Connections Tab */}
      {!loading && activeTab === 'connections' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, overflowY: 'auto' }}>
          {rich.length === 0 ? (
            <div style={{ color: 'var(--on-surface-dim)', fontSize: '0.8125rem', textAlign: 'center', padding: 16 }}>
              <Sparkles size={20} style={{ margin: '0 auto 8px', opacity: 0.4, display: 'block' }} />
              No AI connections found yet.
            </div>
          ) : rich.map(rc => (
            <div key={rc.connection.id} style={{
              padding: 10, borderRadius: 'var(--radius-md)',
              background: 'var(--surface-container)',
              display: 'flex', flexDirection: 'column', gap: 6,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <DirectionIcon direction={rc.direction} />
                <Link to={`/notes/${rc.note?.id ?? ''}`} style={{
                  color: 'var(--on-surface)', textDecoration: 'none',
                  fontWeight: 500, fontSize: '0.8125rem', flex: 1,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {rc.note?.title ?? 'Unknown'}
                </Link>
                <span style={{
                  fontSize: '0.625rem', fontWeight: 600,
                  color: strengthColor(rc.connection.strength),
                  fontFamily: 'var(--font-mono)',
                }}>
                  {(rc.connection.strength * 100).toFixed(0)}%
                </span>
              </div>

              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                <span className="tag-ai" style={{ fontSize: '0.5625rem', padding: '1px 6px' }}>
                  {rc.connection.relationship_type || 'similar'}
                </span>
                <span className="tag" style={{ fontSize: '0.5625rem', padding: '1px 6px' }}>
                  {rc.direction}
                </span>
              </div>

              {rc.connection.ai_explanation && (
                <p style={{
                  fontSize: '0.6875rem', color: 'var(--on-surface-dim)', margin: 0,
                  fontStyle: 'italic', lineHeight: 1.4,
                }}>
                  "{rc.connection.ai_explanation}"
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Backlinks Tab */}
      {!loading && activeTab === 'backlinks' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, overflowY: 'auto' }}>
          {backlinks.length === 0 ? (
            <p style={{ color: 'var(--on-surface-dim)', fontSize: '0.8125rem', textAlign: 'center', padding: 16 }}>
              No notes link to this one with {'[[wiki-links]]'} yet.
            </p>
          ) : backlinks.map(bl => (
            <div key={bl.id} className="neural-link" style={{
              padding: '8px 10px', borderRadius: 'var(--radius-sm)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <ArrowLeft size={12} style={{ color: 'var(--on-surface-dim)', flexShrink: 0 }} />
              <Link to={`/notes/${bl.id}`} style={{
                color: 'var(--on-surface)', textDecoration: 'none',
                fontSize: '0.8125rem', fontWeight: 500,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
              }}>
                {bl.title}
              </Link>
            </div>
          ))}
        </div>
      )}

      {/* Unlinked Mentions Tab */}
      {!loading && activeTab === 'unlinked' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, overflowY: 'auto' }}>
          {unlinked.length === 0 ? (
            <p style={{ color: 'var(--on-surface-dim)', fontSize: '0.8125rem', textAlign: 'center', padding: 16 }}>
              No unlinked mentions found.
            </p>
          ) : (
            <>
              <p style={{ color: 'var(--on-surface-dim)', fontSize: '0.6875rem', margin: '0 0 6px' }}>
                Notes that mention this note's title without a {'[[wiki-link]]'}:
              </p>
              {unlinked.map(n => (
                <div key={n.id} style={{
                  padding: '8px 10px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--surface-container)',
                  display: 'flex', alignItems: 'center', gap: 6,
                  border: '1px dashed var(--outline)',
                }}>
                  <Link2Off size={12} style={{ color: 'var(--on-surface-dim)', flexShrink: 0 }} />
                  <Link to={`/notes/${n.id}`} style={{
                    color: 'var(--on-surface-variant)', textDecoration: 'none',
                    fontSize: '0.8125rem', overflow: 'hidden', textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap', flex: 1,
                  }}>
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
