import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import ConnectionsSidebar from '../components/ConnectionsSidebar';
import { BlockEditor } from '../components/BlockEditor';
import { MarkdownPreview } from '../components/Markdown';
import { apiUrl, isDesktopRuntime } from '../lib/api';
import { pickDesktopFile } from '../lib/desktopFiles';

export default function NoteDetail() {
  const { id } = useParams();
  const [note, setNote] = useState<any>(null);
  const [collections, setCollections] = useState<any[]>([]);
  const [selectedCol, setSelectedCol] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const [chatQuestion, setChatQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [aiResult, setAiResult] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [transformMode, setTransformMode] = useState('concise');
  const [attachments, setAttachments] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);
  const [showVersions, setShowVersions] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<any>(null);
  const [noteTree, setNoteTree] = useState<any>(null);
  const [allNotes, setAllNotes] = useState<any[]>([]);
  const [showParentSelector, setShowParentSelector] = useState(false);
  const desktopRuntime = isDesktopRuntime();

  const fetchNote = () => {
    fetch(`http://localhost:8000/api/notes/${id}`)
      .then(res => res.json())
      .then(data => {
        setNote(data);
        setEditTitle(data.title);
        setEditContent(data.content);
      })
      .catch(console.error);
  };

  const togglePin = async () => {
    if (!note) return;
    try {
      const res = await fetch(`http://localhost:8000/api/notes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_pinned: !note.is_pinned }),
      });
      if (res.ok) fetchNote();
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAttachments = async () => {
    if (!id) return;
    try {
      const res = await fetch(`http://localhost:8000/api/notes/${id}/attachments`);
      if (res.ok) {
        const data = await res.json();
        setAttachments(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const uploadAttachment = async (file: File) => {
    if (!id || !file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`http://localhost:8000/api/notes/${id}/attachments`, {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        fetchAttachments();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const file = e.target.files[0];
    if (!file) return;
    await uploadAttachment(file);
    e.target.value = '';
  };

  const handleDesktopFileUpload = async () => {
    const file = await pickDesktopFile();
    if (!file) return;
    await uploadAttachment(file);
  };

  const deleteAttachment = async (attachmentId: string) => {
    if (!confirm('Delete this attachment?')) return;
    try {
      await fetch(`http://localhost:8000/api/notes/${id}/attachments/${attachmentId}`, {
        method: 'DELETE'
      });
      fetchAttachments();
    } catch (e) {
      console.error(e);
    }
  };

  const fetchVersions = async () => {
    if (!id) return;
    try {
      const res = await fetch(`http://localhost:8000/api/notes/${id}/versions`);
      if (res.ok) {
        const data = await res.json();
        setVersions(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const restoreVersion = async (versionId: string) => {
    if (!confirm('Restore this version? Current state will be saved as a new version.')) return;
    try {
      const res = await fetch(`http://localhost:8000/api/notes/${id}/versions/${versionId}/restore`, {
        method: 'POST'
      });
      if (res.ok) {
        fetchNote();
        fetchVersions();
        setSelectedVersion(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchNoteTree = async () => {
    if (!id) return;
    try {
      const res = await fetch(`http://localhost:8000/api/notes/${id}/tree`);
      if (res.ok) {
        const data = await res.json();
        setNoteTree(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAllNotes = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/notes');
      if (res.ok) {
        const data = await res.json();
        setAllNotes(data.filter((n: any) => n.id !== id));
      }
    } catch (e) {
      console.error(e);
    }
  };

  const setParentNote = async (parentId: string | null) => {
    try {
      const res = await fetch(`http://localhost:8000/api/notes/${id}/parent?parent_id=${parentId || ''}`, {
        method: 'POST'
      });
      if (res.ok) {
        fetchNote();
        fetchNoteTree();
        setShowParentSelector(false);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchNote();
    fetchAttachments();
    fetchVersions();
    fetchNoteTree();
    fetchAllNotes();

    fetch('http://localhost:8000/api/collections')
      .then(res => res.json())
      .then(setCollections)
      .catch(console.error);

    fetch(`http://localhost:8000/api/chat/sessions?note_id=${id}`)
      .then(res => res.json())
      .then(sessions => {
        if (sessions && sessions.length > 0) {
          const latest = sessions[0];
          setSessionId(latest.id);
          fetch(`http://localhost:8000/api/chat/sessions/${latest.id}`)
            .then(res => res.json())
            .then(data => setChatHistory(data.messages || []))
            .catch(console.error);
        }
      })
      .catch(console.error);
  }, [id]);

  const handleSaveUpdate = async () => {
    try {
      const res = await fetch(`http://localhost:8000/api/notes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle, content: editContent }),
      });
      if (res.ok) {
        setIsEditing(false);
        fetchNote();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const addToCollection = async () => {
    if (!selectedCol) return;
    try {
      await fetch(`http://localhost:8000/api/collections/${selectedCol}/notes/${id}`, { method: 'POST' });
      alert('Added to collection!');
      setSelectedCol('');
    } catch (e) {
      console.error(e);
    }
  };

  const handleChat = async () => {
    if (!chatQuestion.trim()) return;
    setChatLoading(true);
    setChatHistory(prev => [...prev, { role: 'user', content: chatQuestion }]);
    const q = chatQuestion;
    setChatQuestion('');

    try {
      const res = await fetch('http://localhost:8000/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q,
          note_id: id,
          session_id: sessionId,
          profile_context: localStorage.getItem('profileBio') || undefined,
          model: localStorage.getItem('activeModel') || 'qwen2.5:0.5b'
        }),
      });
      const data = await res.json();
      setChatHistory(prev => [...prev, { role: 'ai', content: data.answer }]);
      if (data.session_id) setSessionId(data.session_id);
    } catch (e: any) {
      setChatHistory(prev => [...prev, { role: 'ai', content: `Error: ${e.message}` }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleSummarize = async () => {
    if (!id) return;
    setAiLoading(true);
    setAiResult('');
    try {
      const res = await fetch(`http://localhost:8000/api/notes/${id}/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: localStorage.getItem('activeModel') || 'qwen2.5:0.5b' })
      });
      if (!res.ok) {
        const text = await res.text();
        setAiResult(`Error: ${text}`);
        return;
      }
      const data = await res.json();
      setAiResult(data.result);
    } catch (e: any) {
      setAiResult(`Error: ${e.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  const resolveInstruction = () => {
    if (transformMode === 'concise') {
      return 'Rewrite this note to be shorter and more concise while preserving key ideas.';
    }
    if (transformMode === 'expand') {
      return 'Expand this note with more detail, explanations, and concrete examples.';
    }
    if (transformMode === 'beginner') {
      return 'Rewrite this note so that a beginner can understand it, using simple language.';
    }
    return transformMode;
  };

  const handleTransform = async () => {
    if (!id) return;
    setAiLoading(true);
    setAiResult('');
    try {
      const res = await fetch(`http://localhost:8000/api/notes/${id}/transform`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction: resolveInstruction(),
          model: localStorage.getItem('activeModel') || 'qwen2.5:0.5b'
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        setAiResult(`Error: ${text}`);
        return;
      }
      const data = await res.json();
      setAiResult(data.result);
    } catch (e: any) {
      setAiResult(`Error: ${e.message}`);
    } finally {
      setAiLoading(false);
    }
  };

  if (!note) return <div>Loading...</div>;

  const wordCount = note.content ? note.content.trim().split(/\s+/).length : 0;
  const readingTime = Math.max(1, Math.ceil(wordCount / 200)); // ~200 wpm reading speed

  return (
    <div style={{ display: 'flex', gap: '2rem', height: '100%' }}>
      <div style={{ flex: 3, overflowY: 'auto', paddingRight: '1rem' }}>
        {/* Note Tree Breadcrumb */}
        {noteTree?.ancestors && noteTree.ancestors.length > 0 && (
          <div style={{ marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            {noteTree.ancestors.map((ancestor: any, idx: number) => (
              <span key={ancestor.id}>
                <Link to={`/notes/${ancestor.id}`} style={{ color: 'var(--accent-color)', textDecoration: 'none' }}>
                  {ancestor.title}
                </Link>
                {idx < noteTree.ancestors.length - 1 && <span style={{ margin: '0 0.3rem' }}>→</span>}
              </span>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {isEditing ? (
            <input
              className="input"
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
              style={{ fontSize: '1.5rem', fontWeight: 'bold', flex: 1, marginRight: '1rem' }}
            />
          ) : (
            <h1>{note.title}</h1>
          )}

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              className="btn"
              onClick={togglePin}
              style={{
                backgroundColor: note.is_pinned ? 'var(--accent-color)' : 'var(--surface-color)',
                minWidth: '40px'
              }}
              title={note.is_pinned ? 'Unpin Note' : 'Pin Note'}
            >
              {note.is_pinned ? '📌' : '📍'}
            </button>
            {isEditing ? (
              <>
                <button className="btn" onClick={handleSaveUpdate}>
                  Save
                </button>
                <button
                  className="btn"
                  onClick={() => setIsEditing(false)}
                  style={{ backgroundColor: 'var(--border-color)' }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button className="btn" onClick={() => setIsEditing(true)}>
                Edit
              </button>
            )}

            <button className="btn" onClick={() => setShowVersions(!showVersions)} style={{ backgroundColor: showVersions ? 'var(--accent-color)' : 'var(--surface-color)' }}>
              🕐 History
            </button>

            <button className="btn" onClick={() => setShowParentSelector(!showParentSelector)} style={{ backgroundColor: showParentSelector ? 'var(--accent-color)' : 'var(--surface-color)' }}>
              🌳 Parent
            </button>

            <select
              className="input"
              value={selectedCol}
              onChange={e => setSelectedCol(e.target.value)}
              style={{ marginBottom: 0 }}
            >
              <option value="">Add to Collection...</option>
              {collections.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <button className="btn" onClick={addToCollection} disabled={!selectedCol}>
              Add
            </button>
            <Link
              to={`/notes`}
              className="btn"
              style={{ textDecoration: 'none', backgroundColor: 'var(--border-color)' }}
            >
              Back
            </Link>
          </div>
        </div>

        {!isEditing && (
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {note.tags?.map((tag: string) => (
              <span
                key={tag}
                style={{
                  backgroundColor: 'var(--accent-color)',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '1rem',
                  fontSize: '0.8rem',
                }}
              >
                #{tag}
              </span>
            ))}
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: 'auto' }}>
              {wordCount} words · {readingTime} min read
            </span>
          </div>
        )}

        {/* Parent Selector */}
        {showParentSelector && (
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <strong>Set Parent Note</strong>
              <button className="btn" onClick={() => setShowParentSelector(false)} style={{ fontSize: '0.8rem', padding: '0.2rem 0.5rem' }}>✕</button>
            </div>
            <select
              className="input"
              style={{ marginBottom: '0.5rem' }}
              onChange={(e) => setParentNote(e.target.value || null)}
              defaultValue=""
            >
              <option value="">-- No Parent (Root) --</option>
              {allNotes.map((n: any) => (
                <option key={n.id} value={n.id}>{n.title}</option>
              ))}
            </select>
            {note.parent_note_id && (
              <button className="btn" onClick={() => setParentNote(null)} style={{ fontSize: '0.8rem' }}>
                Remove Parent
              </button>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
          <button className="btn" onClick={handleSummarize} disabled={aiLoading}>
            Summarize
          </button>
          <a
            href={apiUrl(`/api/export/note/${id}/markdown`)}
            target="_blank"
            rel="noopener noreferrer"
            className="btn"
            style={{ textDecoration: 'none' }}
          >
            📥 Export MD
          </a>
          <select
            className="input"
            style={{ marginBottom: 0, width: '220px' }}
            value={transformMode}
            onChange={e => setTransformMode(e.target.value)}
          >
            <option value="concise">Make more concise</option>
            <option value="expand">Expand with examples</option>
            <option value="beginner">Beginner-friendly explanation</option>
          </select>
          <button className="btn" onClick={handleTransform} disabled={aiLoading}>
            Rewrite
          </button>
          {aiLoading && <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>AI is working...</span>}
        </div>

        {isEditing ? (
          <div style={{ marginTop: '1rem' }}>
            <BlockEditor value={editContent} onChange={val => setEditContent(val)} />
          </div>
        ) : (
          <div style={{ backgroundColor: 'transparent', marginBottom: '1rem' }}>
            <MarkdownPreview
              source={note.content ? note.content.replace(/\[\[(.*?)\]\]/g, '[$1](/notes?q=$1)') : ''}
              skipHtml={true}
              fallbackClassName="whitespace-pre-wrap"
              style={{ backgroundColor: 'transparent', color: 'var(--text-main)' }}
            />
          </div>
        )}

        {note.backlinks && note.backlinks.length > 0 && (
          <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Linked References</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {note.backlinks.map((link: any) => (
                <li key={link.id} style={{ marginBottom: '0.5rem' }}>
                  <Link to={`/notes/${link.id}`} style={{ color: 'var(--accent-color)', textDecoration: 'none' }}>
                    {link.title}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Child Notes */}
        {noteTree?.descendants && noteTree.descendants.length > 0 && (
          <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
            <h3 style={{ fontSize: '1rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>🌳 Child Notes</h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {noteTree.descendants.map((child: any) => (
                <li key={child.id} style={{ marginBottom: '0.5rem' }}>
                  <Link to={`/notes/${child.id}`} style={{ color: 'var(--accent-color)', textDecoration: 'none' }}>
                    ↳ {child.title}
                  </Link>
                  {child.children && child.children.length > 0 && (
                    <ul style={{ listStyle: 'none', paddingLeft: '1.5rem', marginTop: '0.3rem' }}>
                      {child.children.map((grandchild: any) => (
                        <li key={grandchild.id} style={{ marginBottom: '0.3rem' }}>
                          <Link to={`/notes/${grandchild.id}`} style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.9rem' }}>
                            ↳ {grandchild.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Attachments Section */}
        <div style={{ marginTop: '2rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <h3 style={{ fontSize: '1rem', color: 'var(--text-muted)', margin: 0 }}>📎 Attachments</h3>
            {desktopRuntime ? (
              <button className="btn" onClick={() => void handleDesktopFileUpload()} style={{ cursor: 'pointer', fontSize: '0.85rem', padding: '0.4rem 0.8rem' }} disabled={uploading}>
                {uploading ? 'Uploading...' : '+ Add File'}
              </button>
            ) : (
              <label className="btn" style={{ cursor: 'pointer', fontSize: '0.85rem', padding: '0.4rem 0.8rem' }}>
                {uploading ? 'Uploading...' : '+ Add File'}
                <input
                  type="file"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                  disabled={uploading}
                />
              </label>
            )}
          </div>

          {attachments.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No attachments yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {attachments.map((att: any) => (
                <div
                  key={att.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.5rem 0.8rem',
                    backgroundColor: 'var(--bg-highlight)',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)'
                  }}
                >
                  <a
                    href={apiUrl(`/api/notes/${id}/attachments/${att.id}/download`)}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--accent-color)', textDecoration: 'none', fontSize: '0.9rem' }}
                  >
                    {att.original_filename}
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginLeft: '0.5rem' }}>
                      ({(att.file_size / 1024).toFixed(1)} KB)
                    </span>
                  </a>
                  <button
                    onClick={() => deleteAttachment(att.id)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#ff4444',
                      cursor: 'pointer',
                      fontSize: '1rem',
                      padding: '0.2rem'
                    }}
                    title="Delete attachment"
                  >
                    🗑
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {aiResult && (
          <div className="card" style={{ marginTop: '0.5rem' }}>
            <h3 style={{ marginTop: 0, marginBottom: '0.5rem' }}>AI Result</h3>
            <MarkdownPreview source={aiResult} skipHtml={true} fallbackClassName="whitespace-pre-wrap" style={{ backgroundColor: 'transparent', color: 'var(--text-main)' }} />
          </div>
        )}

        {/* Version History Panel */}
        {showVersions && (
          <div className="card" style={{ marginTop: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>🕐 Version History</h3>
              <button className="btn" onClick={() => setShowVersions(false)} style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}>✕</button>
            </div>
            {versions.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No versions yet. Edit this note to create versions.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '300px', overflowY: 'auto' }}>
                {versions.map((v: any) => (
                  <div
                    key={v.id}
                    style={{
                      padding: '0.75rem',
                      backgroundColor: selectedVersion?.id === v.id ? 'var(--bg-highlight)' : 'transparent',
                      border: '1px solid var(--border-color)',
                      borderRadius: '6px',
                      cursor: 'pointer'
                    }}
                    onClick={() => setSelectedVersion(selectedVersion?.id === v.id ? null : v)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 'bold' }}>Version {v.version_number}</span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {new Date(v.created_at).toLocaleString()}
                      </span>
                    </div>
                    {selectedVersion?.id === v.id && (
                      <div style={{ marginTop: '0.5rem' }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                          <strong>{v.title}</strong>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxHeight: '100px', overflow: 'hidden' }}>
                          {v.content.substring(0, 200)}...
                        </div>
                        <button
                          className="btn"
                          onClick={(e) => { e.stopPropagation(); restoreVersion(v.id); }}
                          style={{ marginTop: '0.5rem', fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}
                        >
                          ↩️ Restore This Version
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          borderLeft: '1px solid var(--border-color)',
          paddingLeft: '1rem',
        }}
      >
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '0.5rem' }}>
          <button
            onClick={() => setChatOpen(false)}
            style={{
              flex: 1,
              padding: '0.5rem',
              border: 'none',
              background: !chatOpen ? 'transparent' : 'rgba(255,255,255,0.05)',
              color: !chatOpen ? 'var(--accent-color)' : 'var(--text-muted)',
              borderBottom: !chatOpen ? '2px solid var(--accent-color)' : 'none',
              cursor: 'pointer',
              fontWeight: !chatOpen ? 'bold' : 'normal',
            }}
          >
            Connections
          </button>
          <button
            onClick={() => setChatOpen(true)}
            style={{
              flex: 1,
              padding: '0.5rem',
              border: 'none',
              background: chatOpen ? 'transparent' : 'rgba(255,255,255,0.05)',
              color: chatOpen ? 'var(--accent-color)' : 'var(--text-muted)',
              borderBottom: chatOpen ? '2px solid var(--accent-color)' : 'none',
              cursor: 'pointer',
              fontWeight: chatOpen ? 'bold' : 'normal',
            }}
          >
            AI Chat {chatHistory.length > 0 && `(${chatHistory.length})`}
          </button>
        </div>

        {!chatOpen ? (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <ConnectionsSidebar noteId={id || ''} />
          </div>
        ) : (
          <div
            className="card"
            style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '500px', padding: '1rem' }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
              }}
            >
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0 }}>Conversation Context</p>
              {chatHistory.length > 0 && (
                <button
                  onClick={async () => {
                    if (sessionId && confirm('Clear this chat?')) {
                      await fetch(`http://localhost:8000/api/chat/sessions/${sessionId}`, { method: 'DELETE' });
                      setChatHistory([]);
                      setSessionId(null);
                    }
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: '#ff4444',
                    cursor: 'pointer',
                    fontSize: '0.8rem',
                  }}
                >
                  Clear Chat
                </button>
              )}
            </div>
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                marginBottom: '1rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.8rem',
              }}
            >
              {chatHistory.length === 0 && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  Ask the AI a question about this specific note...
                </p>
              )}
              {chatHistory.map((m: any, i) => (
                <div key={i} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '90%' }}>
                  <div
                    style={{
                      padding: '0.6rem 1rem',
                      borderRadius: '12px',
                      fontSize: '0.9rem',
                      color: m.role === 'user' ? '#fff' : 'var(--text-main)',
                      backgroundColor: m.role === 'user' ? 'var(--accent-color)' : 'var(--bg-highlight)',
                      border: m.role === 'ai' ? '1px solid var(--border-color)' : 'none',
                    }}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>AI is thinking...</p>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                className="input"
                style={{ padding: '0.6rem', marginBottom: 0, flex: 1 }}
                placeholder="Ask about this note..."
                value={chatQuestion}
                onChange={e => setChatQuestion(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleChat()}
              />
              <button className="btn" style={{ padding: '0.6rem 1rem' }} onClick={handleChat} disabled={chatLoading}>
                Send
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
