import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { BlockEditor } from '../components/BlockEditor';
import { VoiceMemo } from '../components/VoiceMemo';
import { Save, Maximize2, Minimize2, Sparkles, Tag, Wand2, Link2, X } from 'lucide-react';
import WritingAssistant from '../components/WritingAssistant';
import RelatedNotesSidebar from '../components/RelatedNotesSidebar';

interface Template {
  id: number;
  name: string;
  icon: string;
  title_template: string;
  content_template: string;
}

export default function NoteEditor() {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [isTagging, setIsTagging] = useState(false);
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [savedNoteId, setSavedNoteId] = useState<string | null>(null);
  const [showRelated, setShowRelated] = useState(false);

  // Writing assistant state
  const [selection, setSelection] = useState('');
  const [showAssistant, setShowAssistant] = useState(false);
  const [assistantPos, setAssistantPos] = useState({ x: 0, y: 0 });
  const contentAreaRef = useRef<HTMLDivElement>(null);

  const navigate = useNavigate();

  useEffect(() => {
    const templateTitle = sessionStorage.getItem('templateTitle');
    const templateContent = sessionStorage.getItem('templateContent');
    if (templateTitle !== null) { setTitle(templateTitle); sessionStorage.removeItem('templateTitle'); }
    if (templateContent !== null) { setContent(templateContent); sessionStorage.removeItem('templateContent'); }
    fetch('http://localhost:8000/api/templates')
      .then(res => { if (!res.ok) throw new Error(); return res.json(); })
      .then(setTemplates)
      .catch(console.error);
  }, []);

  // Detect text selection for writing assistant
  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const text = sel.toString().trim();
    if (text.length < 5) return;

    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const containerRect = contentAreaRef.current?.getBoundingClientRect();
    if (!containerRect) return;

    setSelection(text);
    setAssistantPos({
      x: Math.min(rect.left - containerRect.left, containerRect.width - 390),
      y: rect.bottom - containerRect.top + 8,
    });
    setShowAssistant(true);
  }, []);

  const handleAutoTag = async () => {
    if (!title && !content) return;
    setIsTagging(true);
    try {
      const res = await fetch('http://localhost:8000/api/notes/suggest-tags', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, model: localStorage.getItem('activeModel') || 'qwen2.5:0.5b' }),
      });
      if (res.ok) {
        const suggestedTags = await res.json();
        if (Array.isArray(suggestedTags) && suggestedTags.length > 0) {
          setTags(tags ? `${tags}, ${suggestedTags.join(', ')}` : suggestedTags.join(', '));
        }
      }
    } catch (e) { console.error(e); }
    finally { setIsTagging(false); }
  };

  const handleApplyTemplate = async () => {
    if (!selectedTemplateId) return;
    try {
      const res = await fetch(`http://localhost:8000/api/templates/${selectedTemplateId}/apply`);
      if (res.ok) {
        const data = await res.json();
        if (!title) setTitle(data.title || '');
        if (!content) setContent(data.content || '');
        else setContent(prev => `${prev.trim()}\n\n${data.content || ''}`);
      }
    } catch (e) { console.error(e); }
  };

  const handleSave = async () => {
    const payload = { title, content, tags: tags.split(',').map(t => t.trim()).filter(t => t) };
    try {
      const res = await fetch('http://localhost:8000/api/notes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const note = await res.json();
        setSavedNoteId(note.id);
        navigate(`/notes/${note.id}`);
      } else {
        console.error('Save failed', await res.text());
      }
    } catch (err) { console.error(err); }
  };

  // Accept writing assistant result — replace selection in content
  const handleAssistAccept = useCallback((result: string, action: string) => {
    if (action === 'continue') {
      setContent(prev => prev.trimEnd() + '\n\n' + result);
    } else {
      // Replace selection in content
      setContent(prev => {
        const idx = prev.indexOf(selection);
        if (idx === -1) return prev + '\n\n' + result;
        return prev.slice(0, idx) + result + prev.slice(idx + selection.length);
      });
    }
    setShowAssistant(false);
  }, [selection]);

  // Insert wikilink from related notes sidebar
  const handleInsertLink = useCallback((wikilink: string) => {
    setContent(prev => prev + '\n' + wikilink);
  }, []);

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const model = localStorage.getItem('activeModel') || 'qwen2.5:0.5b';

  return (
    <div style={{
      position: isFocusMode ? 'fixed' : 'relative',
      inset: isFocusMode ? 0 : 'auto',
      zIndex: isFocusMode ? 1000 : 'auto',
      background: isFocusMode ? 'var(--surface)' : 'transparent',
      padding: isFocusMode ? 32 : 0,
      display: 'flex', flexDirection: 'column', height: '100%',
    }}>
      {/* Top Bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 20, flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {!isFocusMode && (
            <>
              <span style={{ fontSize: '0.75rem', color: 'var(--on-surface-dim)' }}>■</span>
              <span style={{ fontSize: '0.8125rem', color: 'var(--on-surface-dim)' }}>Vault</span>
              <span style={{ fontSize: '0.8125rem', color: 'var(--on-surface-dim)', opacity: 0.4 }}>›</span>
              <span style={{ fontSize: '0.8125rem', color: 'var(--on-surface)' }}>New Note</span>
            </>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Related notes toggle */}
          {savedNoteId && (
            <button
              className={`btn-ghost ${showRelated ? 'active' : ''}`}
              onClick={() => setShowRelated(!showRelated)}
              style={{ fontSize: '0.75rem', gap: 6 }}
            >
              <Link2 size={14} /> Related
            </button>
          )}
          <button
            className="btn-ghost"
            onClick={() => setIsFocusMode(!isFocusMode)}
          >
            {isFocusMode ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            {isFocusMode ? 'Exit Focus' : 'Focus'}
          </button>
          <button
            className="btn"
            onClick={handleSave}
            disabled={!title.trim() || !content.trim()}
          >
            <Save size={14} /> Save Note
          </button>
        </div>
      </div>

      {/* Editor + Sidebar */}
      <div style={{ flex: 1, display: 'flex', minHeight: 0, gap: 0, position: 'relative' }}>
        {/* Main editor */}
        <div
          ref={contentAreaRef}
          style={{ flex: 1, overflowY: 'auto', maxWidth: showRelated ? 'calc(100% - 220px)' : 720, position: 'relative' }}
          onMouseUp={handleMouseUp}
        >
          {/* Title */}
          <input
            type="text"
            placeholder="Note Title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            style={{
              width: '100%', border: 'none', outline: 'none',
              background: 'transparent', color: 'var(--on-surface)',
              fontFamily: 'var(--font-display)', fontSize: '2rem',
              fontWeight: 700, letterSpacing: '-0.03em',
              marginBottom: 20,
            }}
          />

          {/* Template + Tag row */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
            <select
              className="input"
              value={selectedTemplateId}
              onChange={e => setSelectedTemplateId(e.target.value)}
              style={{ width: 180, fontSize: '0.75rem', padding: '6px 10px', borderRadius: 'var(--radius-full)' }}
            >
              <option value="">Template...</option>
              {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <button className="btn-ghost" onClick={handleApplyTemplate} disabled={!selectedTemplateId} style={{ fontSize: '0.75rem' }}>
              Apply
            </button>

            <div style={{ width: 1, height: 20, background: 'var(--outline)', margin: '0 4px' }} />

            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, flex: 1,
              background: 'var(--surface-container-lowest)',
              borderRadius: 'var(--radius-full)', padding: '6px 12px',
            }}>
              <Tag size={13} style={{ color: 'var(--on-surface-dim)', flexShrink: 0 }} />
              <input
                value={tags}
                onChange={e => setTags(e.target.value)}
                placeholder="Tags (comma separated)"
                style={{
                  background: 'transparent', border: 'none', outline: 'none',
                  color: 'var(--on-surface)', fontSize: '0.75rem',
                  fontFamily: 'var(--font-body)', width: '100%',
                }}
              />
            </div>

            <button
              className="btn-ghost"
              onClick={handleAutoTag}
              disabled={isTagging || (!title && !content)}
              style={{ fontSize: '0.75rem' }}
            >
              <Sparkles size={13} style={{ color: 'var(--secondary)' }} />
              {isTagging ? 'Tagging...' : 'AI Tags'}
            </button>

            <VoiceMemo compact onTranscribed={text => setContent(prev => prev ? `${prev}\n\n${text}` : text)} />
          </div>

          {/* AI Writing Assistant hint */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12,
            fontSize: '0.6875rem', color: 'var(--on-surface-dim)',
          }}>
            <Wand2 size={11} style={{ color: 'var(--primary)' }} />
            <span>Select text to open the AI writing assistant</span>
            <kbd style={{ padding: '1px 5px', borderRadius: 3, border: '1px solid var(--outline-variant)', fontSize: '0.5625rem', fontFamily: 'var(--font-mono)', opacity: 0.7 }}>Alt+C</kbd>
            <span>continue</span>
            <kbd style={{ padding: '1px 5px', borderRadius: 3, border: '1px solid var(--outline-variant)', fontSize: '0.5625rem', fontFamily: 'var(--font-mono)', opacity: 0.7 }}>Alt+R</kbd>
            <span>rewrite</span>
          </div>

          {/* Block Editor */}
          <div style={{
            background: 'var(--surface-container-lowest)',
            borderRadius: 'var(--radius-lg)',
            padding: 20, minHeight: 400,
            position: 'relative',
          }}>
            <BlockEditor value={content} onChange={val => setContent(val)} />

            {/* Writing Assistant floating panel */}
            {showAssistant && savedNoteId && (
              <div style={{
                position: 'absolute',
                left: Math.max(0, assistantPos.x),
                top: assistantPos.y,
                zIndex: 200,
              }}>
                <WritingAssistant
                  noteId={savedNoteId}
                  selection={selection}
                  context={title}
                  model={model}
                  onAccept={handleAssistAccept}
                  onClose={() => setShowAssistant(false)}
                />
              </div>
            )}

            {/* Hint when no savedNoteId yet */}
            {showAssistant && !savedNoteId && (
              <div style={{
                position: 'absolute',
                left: Math.max(0, assistantPos.x),
                top: assistantPos.y,
                zIndex: 200,
                background: 'var(--surface-container)',
                border: '1px solid var(--outline)',
                borderRadius: 'var(--radius-md)',
                padding: '10px 14px',
                fontSize: '0.8125rem',
                color: 'var(--on-surface-dim)',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <Wand2 size={14} style={{ color: 'var(--primary)' }} />
                Save the note first to use AI assist.
                <button onClick={() => setShowAssistant(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--on-surface-dim)', padding: 2 }}>
                  <X size={13} />
                </button>
              </div>
            )}
          </div>

          {/* Word count */}
          <div style={{
            textAlign: 'right', marginTop: 8,
            fontSize: '0.6875rem', color: 'var(--on-surface-dim)',
            fontFamily: 'var(--font-mono)',
          }}>
            {wordCount} words
          </div>
        </div>

        {/* Related Notes Sidebar */}
        {showRelated && savedNoteId && (
          <RelatedNotesSidebar
            noteId={savedNoteId}
            noteTitle={title}
            onInsertLink={handleInsertLink}
          />
        )}
      </div>
    </div>
  );
}
