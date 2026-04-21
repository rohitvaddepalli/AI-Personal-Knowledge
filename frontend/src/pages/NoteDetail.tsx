import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import ConnectionsSidebar from '../components/ConnectionsSidebar';
import { BlockEditor } from '../components/BlockEditor';
import { MarkdownPreview } from '../components/Markdown';
import { apiUrl, isDesktopRuntime } from '../lib/api';
import { pickDesktopFile } from '../lib/desktopFiles';
import {
  Pin, Edit3, Save, X, ChevronRight, Clock, Paperclip, Download,
  Sparkles, Tag, MessageSquare, Link2, MoreVertical, FileText,
  AlertCircle, CheckCircle,
} from 'lucide-react';

// ── Confirm dialog ─────────────────────────────────────────────────────────
function ConfirmDialog({
  message,
  confirmLabel = 'Confirm',
  onConfirm,
  onCancel,
}: {
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onCancel}
    >
      <div
        className="animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--surface-container)', borderRadius: 'var(--radius-xl)',
          padding: 28, maxWidth: 400, width: '90%', border: '1px solid var(--outline)',
        }}
      >
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <AlertCircle size={20} style={{ color: 'var(--error)', flexShrink: 0, marginTop: 2 }} />
          <p style={{ fontSize: '0.875rem', lineHeight: 1.6, color: 'var(--on-surface)' }}>{message}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn-ghost" onClick={onCancel}>Cancel</button>
          <button
            className="btn"
            style={{ background: 'var(--error)', color: '#fff' }}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Toast ──────────────────────────────────────────────────────────────────
function Toast({ message, type = 'success' }: { message: string; type?: 'success' | 'error' | 'info' }) {
  const color = type === 'error' ? 'var(--error)' : type === 'success' ? 'var(--secondary)' : 'var(--primary)';
  const Icon = type === 'error' ? AlertCircle : CheckCircle;
  return (
    <div
      className="animate-fade-in"
      style={{
        position: 'fixed', bottom: 24, right: 24, zIndex: 300,
        padding: '12px 18px', borderRadius: 'var(--radius-lg)',
        background: 'var(--surface-container-high)',
        border: `1px solid ${color}`,
        color: 'var(--on-surface)', fontSize: '0.8125rem',
        boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
        display: 'flex', alignItems: 'center', gap: 8, maxWidth: 360,
      }}
    >
      <Icon size={14} style={{ color, flexShrink: 0 }} />
      {message}
    </div>
  );
}

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
  const [showAIPanel, setShowAIPanel] = useState(false);
  const desktopRuntime = isDesktopRuntime();

  // Dialog / toast state
  const [confirmDeleteAtt, setConfirmDeleteAtt] = useState<string | null>(null);
  const [confirmRestoreVer, setConfirmRestoreVer] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchNote = () => {
    fetch(apiUrl(`/api/notes/${id}`))
      .then(res => { if (!res.ok) throw new Error(`${res.status}`); return res.json(); })
      .then(data => { setNote(data); setEditTitle(data.title); setEditContent(data.content); })
      .catch(console.error);
  };

  const togglePin = async () => {
    if (!note) return;
    try {
      const res = await fetch(apiUrl(`/api/notes/${id}`), {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_pinned: !note.is_pinned }),
      });
      if (res.ok) fetchNote();
    } catch (e) { console.error(e); }
  };

  const fetchAttachments = async () => {
    if (!id) return;
    try {
      const res = await fetch(apiUrl(`/api/notes/${id}/attachments`));
      if (res.ok) setAttachments(await res.json());
    } catch (e) { console.error(e); }
  };

  const uploadAttachment = async (file: File) => {
    if (!id || !file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(apiUrl(`/api/notes/${id}/attachments`), { method: 'POST', body: formData });
      if (res.ok) fetchAttachments();
    } catch (err) { console.error(err); }
    finally { setUploading(false); }
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
    setConfirmDeleteAtt(attachmentId);
  };

  const confirmDeleteAttachment = async (attachmentId: string) => {
    try {
      await fetch(apiUrl(`/api/notes/${id}/attachments/${attachmentId}`), { method: 'DELETE' });
      fetchAttachments();
      showToast('Attachment deleted.', 'success');
    } catch (e) { console.error(e); showToast('Failed to delete attachment.', 'error'); }
  };

  const fetchVersions = async () => {
    if (!id) return;
    try {
      const res = await fetch(apiUrl(`/api/notes/${id}/versions`));
      if (res.ok) setVersions(await res.json());
    } catch (e) { console.error(e); }
  };

  const restoreVersion = async (versionId: string) => {
    setConfirmRestoreVer(versionId);
  };

  const confirmRestoreVersion = async (versionId: string) => {
    try {
      const res = await fetch(apiUrl(`/api/notes/${id}/versions/${versionId}/restore`), { method: 'POST' });
      if (res.ok) { fetchNote(); fetchVersions(); setSelectedVersion(null); showToast('Version restored.', 'success'); }
    } catch (e) { console.error(e); showToast('Failed to restore version.', 'error'); }
  };

  const fetchNoteTree = async () => {
    if (!id) return;
    try {
      const res = await fetch(apiUrl(`/api/notes/${id}/tree`));
      if (res.ok) setNoteTree(await res.json());
    } catch (e) { console.error(e); }
  };

  const fetchAllNotes = async () => {
    try {
      const res = await fetch(apiUrl('/api/notes'));
      if (res.ok) {
        const data = await res.json();
        setAllNotes(Array.isArray(data) ? data.filter((n: any) => n.id !== id) : []);
      }
    } catch (e) { console.error(e); }
  };

  const setParentNote = async (parentId: string | null) => {
    try {
      const res = await fetch(apiUrl(`/api/notes/${id}/parent?parent_id=${parentId || ''}`), { method: 'POST' });
      if (res.ok) { fetchNote(); fetchNoteTree(); setShowParentSelector(false); }
    } catch (e) { console.error(e); }
  };

  useEffect(() => {
    fetchNote(); fetchAttachments(); fetchVersions(); fetchNoteTree(); fetchAllNotes();
    fetch(apiUrl('/api/collections')).then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); }).then(setCollections).catch(console.error);
    fetch(apiUrl(`/api/chat/sessions?note_id=${id}`)).then(r => r.json())
      .then(sessions => {
        if (sessions?.length > 0) {
          const latest = sessions[0];
          setSessionId(latest.id);
          fetch(apiUrl(`/api/chat/sessions/${latest.id}`)).then(r => r.json())
            .then(data => setChatHistory(data.messages || [])).catch(console.error);
        }
      }).catch(console.error);
  }, [id]);

  const handleSaveUpdate = async () => {
    try {
      const res = await fetch(apiUrl(`/api/notes/${id}`), {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: editTitle, content: editContent }),
      });
      if (res.ok) { setIsEditing(false); fetchNote(); }
    } catch (e) { console.error(e); }
  };

  const addToCollection = async () => {
    if (!selectedCol) return;
    try {
      await fetch(apiUrl(`/api/collections/${selectedCol}/notes/${id}`), { method: 'POST' });
      showToast('Added to collection!', 'success');
      setSelectedCol('');
    } catch (e) { console.error(e); showToast('Failed to add to collection.', 'error'); }
  };

  const handleChat = async () => {
    if (!chatQuestion.trim()) return;
    setChatLoading(true);
    setChatHistory(prev => [...prev, { role: 'user', content: chatQuestion }]);
    const q = chatQuestion; setChatQuestion('');
    try {
      const res = await fetch(apiUrl('/api/ask'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: q, note_id: id, session_id: sessionId,
          profile_context: localStorage.getItem('profileBio') || undefined,
          model: localStorage.getItem('activeModel') || 'qwen2.5:0.5b'
        }),
      });
      const data = await res.json();
      setChatHistory(prev => [...prev, { role: 'ai', content: data.answer }]);
      if (data.session_id) setSessionId(data.session_id);
    } catch (e: any) {
      setChatHistory(prev => [...prev, { role: 'ai', content: `Error: ${e.message}` }]);
    } finally { setChatLoading(false); }
  };

  const handleSummarize = async () => {
    if (!id) return;
    setAiLoading(true); setAiResult('');
    try {
      const res = await fetch(apiUrl(`/api/notes/${id}/summarize`), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: localStorage.getItem('activeModel') || 'qwen2.5:0.5b' })
      });
      if (!res.ok) { setAiResult(`Error: ${await res.text()}`); return; }
      const data = await res.json();
      setAiResult(data.result);
    } catch (e: any) { setAiResult(`Error: ${e.message}`); }
    finally { setAiLoading(false); }
  };

  const resolveInstruction = () => {
    if (transformMode === 'concise') return 'Rewrite concisely while preserving key ideas.';
    if (transformMode === 'expand') return 'Expand with detail, explanations, and examples.';
    if (transformMode === 'beginner') return 'Rewrite for a beginner with simple language.';
    return transformMode;
  };

  const handleTransform = async () => {
    if (!id) return;
    setAiLoading(true); setAiResult('');
    try {
      const res = await fetch(apiUrl(`/api/notes/${id}/transform`), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instruction: resolveInstruction(), model: localStorage.getItem('activeModel') || 'qwen2.5:0.5b' }),
      });
      if (!res.ok) { setAiResult(`Error: ${await res.text()}`); return; }
      const data = await res.json();
      setAiResult(data.result);
    } catch (e: any) { setAiResult(`Error: ${e.message}`); }
    finally { setAiLoading(false); }
  };

  if (!note) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--on-surface-dim)', gap: 12 }}>
      <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid var(--primary-dim)', borderTopColor: 'var(--primary)', animation: 'spin 0.8s linear infinite' }} />
      <span style={{ fontSize: '0.8125rem' }}>Loading note...</span>
    </div>
  );

  const wordCount = note.content ? note.content.trim().split(/\s+/).length : 0;
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));

  return (
    <div style={{ display: 'flex', height: '100%', gap: 0 }}>
      {/* Dialogs + Toast */}
      {confirmDeleteAtt && (
        <ConfirmDialog
          message="Delete this attachment? This cannot be undone."
          confirmLabel="Delete"
          onConfirm={() => { confirmDeleteAttachment(confirmDeleteAtt); setConfirmDeleteAtt(null); }}
          onCancel={() => setConfirmDeleteAtt(null)}
        />
      )}
      {confirmRestoreVer && (
        <ConfirmDialog
          message="Restore this version? The current state will be saved as a new version first."
          confirmLabel="Restore"
          onConfirm={() => { confirmRestoreVersion(confirmRestoreVer); setConfirmRestoreVer(null); }}
          onCancel={() => setConfirmRestoreVer(null)}
        />
      )}
      {toast && <Toast message={toast.msg} type={toast.type} />}
      {/* ═══ Main Editor ═══ */}
      <div style={{ flex: 1, overflowY: 'auto', paddingRight: 20 }}>
        {/* Breadcrumb */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          marginBottom: 16, fontSize: '0.8125rem', color: 'var(--on-surface-dim)',
        }}>
          <span>■</span>
          <span>Vault</span>
          {noteTree?.ancestors?.map((ancestor: any) => (
            <span key={ancestor.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ChevronRight size={12} style={{ opacity: 0.4 }} />
              <Link to={`/notes/${ancestor.id}`} style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: '0.8125rem' }}>
                {ancestor.title}
              </Link>
            </span>
          ))}
          <ChevronRight size={12} style={{ opacity: 0.4 }} />
          <span style={{ color: 'var(--on-surface)' }}>{note.title}</span>
        </div>

        {/* Toolbar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 20,
        }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className={note.is_pinned ? 'btn' : 'btn-ghost'}
              onClick={togglePin}
              style={{ padding: '6px 10px' }}
            >
              <Pin size={14} />
            </button>
            {isEditing ? (
              <>
                <button className="btn" onClick={handleSaveUpdate}><Save size={14} /> Save</button>
                <button className="btn-ghost" onClick={() => setIsEditing(false)}><X size={14} /> Cancel</button>
              </>
            ) : (
              <button className="btn-secondary" onClick={() => setIsEditing(true)}>
                <Edit3 size={14} /> Edit
              </button>
            )}
            <button className="btn-ghost" onClick={() => setShowVersions(!showVersions)}>
              <Clock size={14} /> History
            </button>
            <button className="btn-ghost" onClick={() => setShowParentSelector(!showParentSelector)}>
              Parent
            </button>
          </div>

          <div style={{ display: 'flex', gap: 6 }}>
            {/* AI Actions Button */}
            <button
              className="btn"
              onClick={() => setShowAIPanel(!showAIPanel)}
              style={{
                background: showAIPanel
                  ? 'linear-gradient(135deg, var(--primary), var(--primary-container))'
                  : 'var(--surface-container-high)',
                color: showAIPanel ? 'var(--on-primary)' : 'var(--primary)',
              }}
            >
              <Sparkles size={14} /> AI Actions
            </button>
            <button className="btn-ghost" style={{ padding: '6px 8px' }} title="More options (coming soon)" disabled>
              <MoreVertical size={16} />
            </button>
          </div>
        </div>

        {/* Title */}
        {isEditing ? (
          <input
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            style={{
              width: '100%', border: 'none', outline: 'none',
              background: 'transparent', color: 'var(--on-surface)',
              fontFamily: 'var(--font-display)', fontSize: '2rem',
              fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 16,
            }}
          />
        ) : (
          <h1 style={{
            fontFamily: 'var(--font-display)', fontSize: '2rem',
            fontWeight: 700, letterSpacing: '-0.03em', marginBottom: 16,
          }}>
            {note.title}
          </h1>
        )}

        {/* Tags + metadata */}
        {!isEditing && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            marginBottom: 20, flexWrap: 'wrap',
          }}>
            {note.tags?.map((tag: string) => (
              <span key={tag} className="tag">{tag}</span>
            ))}
            <span style={{
              marginLeft: 'auto', fontSize: '0.6875rem',
              color: 'var(--on-surface-dim)', fontFamily: 'var(--font-mono)',
            }}>
              {wordCount} words · {readingTime} min read
            </span>
          </div>
        )}

        {/* Parent Selector */}
        {showParentSelector && (
          <div style={{
            padding: 16, borderRadius: 'var(--radius-md)',
            background: 'var(--surface-container)', marginBottom: 16,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.875rem' }}>Set Parent Note</span>
              <button className="btn-ghost" onClick={() => setShowParentSelector(false)} style={{ padding: '4px 8px' }}><X size={14} /></button>
            </div>
            <select
              className="input"
              style={{ marginBottom: 8, borderRadius: 'var(--radius-full)' }}
              onChange={e => setParentNote(e.target.value || null)}
              defaultValue=""
            >
              <option value="">-- No Parent (Root) --</option>
              {allNotes.map((n: any) => <option key={n.id} value={n.id}>{n.title}</option>)}
            </select>
            {note.parent_note_id && (
              <button className="btn-ghost" onClick={() => setParentNote(null)} style={{ fontSize: '0.75rem' }}>
                Remove Parent
              </button>
            )}
          </div>
        )}

        {/* Content */}
        {isEditing ? (
          <div style={{
            background: 'var(--surface-container-lowest)',
            borderRadius: 'var(--radius-lg)', padding: 20,
          }}>
            <BlockEditor value={editContent} onChange={val => setEditContent(val)} />
          </div>
        ) : (
          <div style={{
            fontSize: '0.9375rem', lineHeight: 1.75,
            maxWidth: 700,
          }}>
            <BlockEditor value={note.content || ''} onChange={() => { }} editable={false} />
          </div>
        )}

        {/* AI Result */}
        {aiResult && (
          <div className="animate-fade-in" style={{
            marginTop: 20, padding: 16, borderRadius: 'var(--radius-md)',
            background: 'var(--surface-container)', borderLeft: '2px solid var(--secondary)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Sparkles size={14} style={{ color: 'var(--secondary)' }} />
              <span className="label-sm" style={{ color: 'var(--secondary)' }}>AI Result</span>
            </div>
            <MarkdownPreview source={aiResult} skipHtml={true} fallbackClassName="whitespace-pre-wrap" style={{ backgroundColor: 'transparent', color: 'var(--on-surface)' }} />
          </div>
        )}

        {/* Backlinks */}
        {note.backlinks?.length > 0 && (
          <div style={{ marginTop: 32, paddingTop: 16 }}>
            <span className="label-sm" style={{ marginBottom: 8, display: 'block' }}>Linked References</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {note.backlinks.map((link: any) => (
                <Link key={link.id} to={`/notes/${link.id}`} className="neural-link" style={{
                  textDecoration: 'none', color: 'var(--on-surface-variant)',
                  fontSize: '0.8125rem', padding: '6px 12px',
                  borderRadius: 'var(--radius-sm)',
                  transition: 'color 200ms',
                }}>
                  {link.title}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Child Notes */}
        {noteTree?.descendants?.length > 0 && (
          <div style={{ marginTop: 24 }}>
            <span className="label-sm" style={{ marginBottom: 8, display: 'block' }}>Child Notes</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {noteTree.descendants.map((child: any) => (
                <div key={child.id}>
                  <Link to={`/notes/${child.id}`} style={{
                    textDecoration: 'none', color: 'var(--primary)',
                    fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: 4,
                  }}>
                    <ChevronRight size={12} /> {child.title}
                  </Link>
                  {child.children?.length > 0 && (
                    <div style={{ paddingLeft: 20, marginTop: 4 }}>
                      {child.children.map((gc: any) => (
                        <Link key={gc.id} to={`/notes/${gc.id}`} style={{
                          textDecoration: 'none', color: 'var(--on-surface-dim)',
                          fontSize: '0.75rem', display: 'block', padding: '2px 0',
                        }}>
                          ↳ {gc.title}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Attachments */}
        <div style={{ marginTop: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span className="label-sm">Attachments</span>
            {desktopRuntime ? (
              <button className="btn-ghost" onClick={() => void handleDesktopFileUpload()} disabled={uploading} style={{ fontSize: '0.75rem' }}>
                <Paperclip size={12} /> {uploading ? 'Uploading...' : 'Add File'}
              </button>
            ) : (
              <label className="btn-ghost" style={{ cursor: 'pointer', fontSize: '0.75rem' }}>
                <Paperclip size={12} /> {uploading ? 'Uploading...' : 'Add File'}
                <input type="file" onChange={handleFileUpload} style={{ display: 'none' }} disabled={uploading} />
              </label>
            )}
          </div>
          {attachments.length === 0 ? (
            <p style={{ fontSize: '0.8125rem', color: 'var(--on-surface-dim)' }}>No attachments.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {attachments.map((att: any) => (
                <div key={att.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', borderRadius: 'var(--radius-sm)',
                  background: 'var(--surface-container-low)',
                }}>
                  <a
                    href={apiUrl(`/api/notes/${id}/attachments/${att.id}/download`)}
                    target="_blank" rel="noopener noreferrer"
                    style={{ color: 'var(--primary)', fontSize: '0.8125rem', textDecoration: 'none' }}
                  >
                    {att.original_filename}
                    <span style={{ color: 'var(--on-surface-dim)', fontSize: '0.625rem', marginLeft: 4 }}>
                      ({(att.file_size / 1024).toFixed(1)} KB)
                    </span>
                  </a>
                  <button onClick={() => deleteAttachment(att.id)} style={{
                    background: 'transparent', border: 'none', color: 'var(--error)',
                    cursor: 'pointer', padding: 4, opacity: 0.5,
                  }}>
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Version History */}
        {showVersions && (
          <div className="animate-fade-in" style={{
            marginTop: 24, padding: 16, borderRadius: 'var(--radius-md)',
            background: 'var(--surface-container)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Clock size={14} style={{ color: 'var(--on-surface-dim)' }} />
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.875rem' }}>Version History</span>
              </div>
              <button className="btn-ghost" onClick={() => setShowVersions(false)} style={{ padding: '4px 8px' }}><X size={14} /></button>
            </div>
            {versions.length === 0 ? (
              <p style={{ fontSize: '0.8125rem', color: 'var(--on-surface-dim)' }}>No versions yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 250, overflowY: 'auto' }}>
                {versions.map((v: any) => (
                  <div key={v.id}
                    onClick={() => setSelectedVersion(selectedVersion?.id === v.id ? null : v)}
                    style={{
                      padding: 10, borderRadius: 'var(--radius-sm)',
                      background: selectedVersion?.id === v.id ? 'var(--surface-container-high)' : 'var(--surface-container-low)',
                      cursor: 'pointer', transition: 'background 200ms',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.8125rem' }}>v{v.version_number}</span>
                      <span style={{ fontSize: '0.625rem', color: 'var(--on-surface-dim)', fontFamily: 'var(--font-mono)' }}>
                        {new Date(v.created_at).toLocaleString()}
                      </span>
                    </div>
                    {selectedVersion?.id === v.id && (
                      <div style={{ marginTop: 8 }}>
                        <p style={{ fontSize: '0.75rem', color: 'var(--on-surface-dim)', marginBottom: 8 }}>
                          {v.content?.substring(0, 150)}...
                        </p>
                        <button className="btn-secondary" onClick={e => { e.stopPropagation(); restoreVersion(v.id); }} style={{ fontSize: '0.6875rem' }}>
                          Restore
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

      {/* ═══ Right Panel — AI Actions / Connections / Chat ═══ */}
      <div style={{
        width: 320, minWidth: 320, display: 'flex', flexDirection: 'column',
        background: 'var(--surface-container-lowest)', borderRadius: 'var(--radius-lg)',
        overflow: 'hidden',
      }}>
        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--outline-variant)' }}>
          {[
            { key: 'connections', label: 'Connections' },
            { key: 'chat', label: `AI Chat${chatHistory.length > 0 ? ` (${chatHistory.length})` : ''}` },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setChatOpen(tab.key === 'chat')}
              style={{
                flex: 1, padding: '10px 12px', border: 'none',
                background: 'transparent', cursor: 'pointer',
                fontFamily: 'var(--font-display)', fontWeight: 500,
                fontSize: '0.75rem',
                color: (tab.key === 'chat' ? chatOpen : !chatOpen) ? 'var(--primary)' : 'var(--on-surface-dim)',
                borderBottom: (tab.key === 'chat' ? chatOpen : !chatOpen) ? '2px solid var(--primary)' : '2px solid transparent',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* AI Actions Panel (shown at top when active) */}
        {showAIPanel && (
          <div className="animate-fade-in" style={{
            padding: 16, borderBottom: '1px solid var(--outline-variant)',
          }}>
            <span className="label-sm" style={{ marginBottom: 12, display: 'block' }}>Intelligence Panel</span>
            {[
              { icon: <FileText size={16} />, label: 'Summarize', desc: 'Condense to key bullets', action: handleSummarize },
              { icon: <Tag size={16} />, label: 'Suggest Tags', desc: 'AI taxonomy analysis', action: () => showToast('Suggest Tags — coming soon.', 'info') },
              { icon: <Link2 size={16} />, label: 'Find Related', desc: 'Discover semantic links', action: () => showToast('Find Related — coming soon.', 'info') },
            ].map((item, i) => (
              <button
                key={i}
                onClick={item.action}
                disabled={aiLoading}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  width: '100%', padding: '10px 12px',
                  background: 'transparent', border: 'none',
                  borderRadius: 'var(--radius-md)', cursor: 'pointer',
                  transition: 'background 200ms', textAlign: 'left',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-variant)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: 'var(--radius-md)',
                  background: 'var(--surface-container-high)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--primary)', flexShrink: 0,
                }}>
                  {item.icon}
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.8125rem' }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--on-surface-dim)' }}>
                    {item.desc}
                  </div>
                </div>
              </button>
            ))}

            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <select
                  className="input"
                  value={transformMode}
                  onChange={e => setTransformMode(e.target.value)}
                  style={{ flex: 1, fontSize: '0.6875rem', padding: '6px 10px', borderRadius: 'var(--radius-full)' }}
                >
                  <option value="concise">Concise</option>
                  <option value="expand">Expand</option>
                  <option value="beginner">Beginner-friendly</option>
                </select>
                <button className="btn-secondary" onClick={handleTransform} disabled={aiLoading} style={{ fontSize: '0.6875rem', padding: '6px 12px' }}>
                  Rewrite
                </button>
              </div>
              <a href={apiUrl(`/api/export/note/${id}/markdown`)} target="_blank" rel="noopener noreferrer" className="btn-ghost" style={{ fontSize: '0.6875rem', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, width: '100%', justifyContent: 'center' }}>
                <Download size={12} /> Export Markdown
              </a>
            </div>

            {aiLoading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: '0.75rem', color: 'var(--on-surface-dim)' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--secondary)', animation: 'pulse 1s infinite' }} />
                AI working...
              </div>
            )}
          </div>
        )}

        {/* Collection selector */}
        <div style={{ padding: '8px 16px', display: 'flex', gap: 6, borderBottom: '1px solid var(--outline-variant)' }}>
          <select className="input" value={selectedCol} onChange={e => setSelectedCol(e.target.value)}
            style={{ flex: 1, fontSize: '0.6875rem', padding: '5px 8px', borderRadius: 'var(--radius-full)' }}
          >
            <option value="">Add to Collection...</option>
            {collections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button className="btn-ghost" onClick={addToCollection} disabled={!selectedCol} style={{ fontSize: '0.6875rem', padding: '5px 8px' }}>Add</button>
        </div>

        {/* Tab content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
          {!chatOpen ? (
            <ConnectionsSidebar noteId={id || ''} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
                {chatHistory.length === 0 && (
                  <p style={{ color: 'var(--on-surface-dim)', fontSize: '0.8125rem', textAlign: 'center', marginTop: 32 }}>
                    Ask the AI about this note...
                  </p>
                )}
                {chatHistory.map((m: any, i) => (
                  <div key={i} style={{
                    alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '90%',
                  }}>
                    <div style={{
                      padding: '8px 12px',
                      borderRadius: m.role === 'user' ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                      fontSize: '0.8125rem', lineHeight: 1.5,
                      background: m.role === 'user'
                        ? 'linear-gradient(135deg, var(--surface-container-high), var(--surface-container-highest))'
                        : 'var(--surface-container)',
                      color: 'var(--on-surface)',
                    }}>
                      <div style={{ whiteSpace: 'pre-wrap' }}>{m.content}</div>
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 12px', borderRadius: '12px 12px 12px 4px',
                    background: 'var(--surface-container)', fontSize: '0.8125rem',
                  }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)', animation: 'pulse 1s infinite' }} />
                    Thinking...
                  </div>
                )}
              </div>

              <div style={{
                display: 'flex', gap: 8,
                background: 'var(--surface-container-low)', borderRadius: 'var(--radius-md)',
                padding: '8px 10px',
              }}>
                <input
                  className="input"
                  value={chatQuestion}
                  onChange={e => setChatQuestion(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChat(); } }}
                  placeholder="Ask about this note..."
                  style={{ flex: 1, fontSize: '0.75rem', padding: '6px 10px', background: 'transparent', border: 'none' }}
                />
                <button className="btn" onClick={handleChat} disabled={chatLoading || !chatQuestion.trim()}
                  style={{ padding: '6px 10px', borderRadius: 'var(--radius-md)' }}
                >
                  <MessageSquare size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
