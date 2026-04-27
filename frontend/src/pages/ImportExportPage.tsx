import React, { useState, useRef } from 'react';
import { useUI } from '../context/UIContext';

// ─── Types ────────────────────────────────────────────────────────────────────
type ImportFormat = 'obsidian' | 'notion' | 'roam' | 'markdown';
type ExportFormat = 'obsidian' | 'graph-json' | 'graph-svg' | 'json' | 'markdown';

interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────
const IMPORT_FORMATS: { id: ImportFormat; label: string; icon: string; hint: string }[] = [
  { id: 'obsidian', label: 'Obsidian', icon: '🔮', hint: 'ZIP of your Obsidian vault folder' },
  { id: 'notion',   label: 'Notion',   icon: '◼', hint: 'Notion HTML/MD export ZIP' },
  { id: 'roam',     label: 'Roam Research', icon: '🌀', hint: 'Roam JSON export file' },
  { id: 'markdown', label: 'Markdown', icon: '📝', hint: 'ZIP of .md files or single .md' },
];

const EXPORT_FORMATS: { id: ExportFormat; label: string; icon: string; desc: string; ext: string }[] = [
  { id: 'obsidian',    label: 'Obsidian Vault', icon: '🔮', desc: 'Full vault ZIP with YAML frontmatter & backlinks', ext: 'zip' },
  { id: 'graph-json',  label: 'Graph JSON',     icon: '🕸', desc: 'Knowledge graph as machine-readable JSON', ext: 'json' },
  { id: 'graph-svg',   label: 'Graph SVG',      icon: '🎨', desc: 'Static knowledge graph visualization', ext: 'svg' },
  { id: 'json',        label: 'All Notes JSON', icon: '📦', desc: 'Raw JSON export of all notes', ext: 'json' },
  { id: 'markdown',    label: 'Markdown ZIP',   icon: '📝', desc: 'Plain Markdown files in a ZIP archive', ext: 'zip' },
];

// ─── Component ────────────────────────────────────────────────────────────────
const ImportExportPage: React.FC = () => {
  const { showToast } = useUI();
  const fileRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<'import' | 'export'>('import');
  const [selectedImport, setSelectedImport] = useState<ImportFormat>('obsidian');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [exportingId, setExportingId] = useState<ExportFormat | null>(null);
  const [dragOver, setDragOver] = useState(false);

  // ── Import ────────────────────────────────────────────────────────────────

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) runImport(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) runImport(file);
  };

  const runImport = async (file: File) => {
    setImporting(true);
    setImportResult(null);
    const formData = new FormData();
    formData.append('file', file);

    const endpointMap: Record<ImportFormat, string> = {
      obsidian: '/api/interop/import/obsidian',
      notion:   '/api/interop/import/notion',
      roam:     '/api/interop/import/roam',
      markdown: '/api/interop/import/markdown',
    };

    try {
      const res = await fetch(endpointMap[selectedImport], { method: 'POST', body: formData });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setImportResult(data);
      showToast(`✓ Imported ${data.imported} notes`, 'success');
    } catch (err: any) {
      showToast(`Import failed: ${err.message}`, 'error');
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // ── Export ────────────────────────────────────────────────────────────────

  const runExport = async (fmt: ExportFormat) => {
    setExportingId(fmt);
    const urlMap: Record<ExportFormat, string> = {
      obsidian:   '/api/interop/export/obsidian',
      'graph-json': '/api/interop/export/graph/json',
      'graph-svg':  '/api/interop/export/graph/svg',
      json:       '/api/notes?format=json&limit=10000',
      markdown:   '/api/export/markdown',
    };
    const extMap = Object.fromEntries(EXPORT_FORMATS.map(f => [f.id, f.ext]));
    const nameMap: Record<ExportFormat, string> = {
      obsidian:   'second_brain_obsidian',
      'graph-json': 'knowledge_graph',
      'graph-svg':  'knowledge_graph',
      json:       'second_brain_notes',
      markdown:   'second_brain_markdown',
    };

    try {
      const res = await fetch(urlMap[fmt]);
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `${nameMap[fmt]}_${new Date().toISOString().slice(0, 10)}.${extMap[fmt]}`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Export downloaded', 'success');
    } catch (err: any) {
      showToast(`Export failed: ${err.message}`, 'error');
    } finally {
      setExportingId(null);
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="import-export-page">
      <div className="ie-header">
        <h1>🔄 Import & Export</h1>
        <p>Move your knowledge freely between tools.</p>
      </div>

      {/* Tabs */}
      <div className="ie-tabs">
        {(['import', 'export'] as const).map(t => (
          <button
            key={t}
            className={`ie-tab ${activeTab === t ? 'active' : ''}`}
            onClick={() => setActiveTab(t)}
          >
            {t === 'import' ? '📥 Import' : '📤 Export'}
          </button>
        ))}
      </div>

      {/* ── Import panel ── */}
      {activeTab === 'import' && (
        <div className="ie-panel">
          <div className="ie-format-grid">
            {IMPORT_FORMATS.map(f => (
              <button
                key={f.id}
                className={`format-card ${selectedImport === f.id ? 'selected' : ''}`}
                onClick={() => setSelectedImport(f.id)}
              >
                <span className="format-icon">{f.icon}</span>
                <span className="format-label">{f.label}</span>
                <span className="format-hint">{f.hint}</span>
              </button>
            ))}
          </div>

          <div
            className={`drop-zone ${dragOver ? 'drag-over' : ''} ${importing ? 'loading' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleFileDrop}
            onClick={() => fileRef.current?.click()}
          >
            <input ref={fileRef} type="file" hidden accept=".zip,.json,.md" onChange={handleFileSelect} />
            {importing ? (
              <div className="drop-loading"><div className="spinner" /><span>Importing…</span></div>
            ) : (
              <>
                <div className="drop-icon">📂</div>
                <div className="drop-text">Drop file here or <span className="drop-link">browse</span></div>
                <div className="drop-sub">{IMPORT_FORMATS.find(f => f.id === selectedImport)?.hint}</div>
              </>
            )}
          </div>

          {importResult && (
            <div className="import-result">
              <div className="result-stat success">✓ {importResult.imported} imported</div>
              {importResult.skipped > 0 && <div className="result-stat warn">⚠ {importResult.skipped} skipped</div>}
              {importResult.errors.length > 0 && (
                <details className="result-errors">
                  <summary>{importResult.errors.length} errors</summary>
                  <ul>{importResult.errors.slice(0, 10).map((e, i) => <li key={i}>{e}</li>)}</ul>
                </details>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Export panel ── */}
      {activeTab === 'export' && (
        <div className="ie-panel">
          <p className="ie-sub">Choose a format to download your entire knowledge base.</p>
          <div className="export-grid">
            {EXPORT_FORMATS.map(f => (
              <div key={f.id} className="export-card">
                <div className="export-card-left">
                  <span className="export-icon">{f.icon}</span>
                  <div>
                    <div className="export-label">{f.label}</div>
                    <div className="export-desc">{f.desc}</div>
                  </div>
                </div>
                <button
                  className="btn-export"
                  onClick={() => runExport(f.id)}
                  disabled={exportingId !== null}
                >
                  {exportingId === f.id ? <span className="spinner-sm" /> : '↓'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        .import-export-page { max-width: 760px; margin: 0 auto; padding: 2rem 1.5rem; }
        .ie-header h1 { font-size: 1.75rem; font-weight: 800; margin-bottom: .35rem; }
        .ie-header p  { color: var(--text-secondary, #94a3b8); margin-bottom: 1.5rem; }
        .ie-tabs      { display: flex; gap: .5rem; margin-bottom: 1.5rem; }
        .ie-tab       { padding: .5rem 1.25rem; border-radius: 8px; border: 1px solid var(--border, #2a2a4a);
                        background: var(--surface, #1a1a2e); color: var(--text-secondary, #94a3b8);
                        font-size: .875rem; font-weight: 600; cursor: pointer; transition: all 150ms; }
        .ie-tab.active { background: var(--primary, #6366f1); color: #fff; border-color: var(--primary, #6366f1); }
        .ie-panel     { display: flex; flex-direction: column; gap: 1.25rem; }
        .ie-sub       { color: var(--text-secondary, #94a3b8); font-size: .875rem; }

        /* Format grid */
        .ie-format-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: .75rem; }
        .format-card    { display: flex; flex-direction: column; align-items: flex-start; gap: .2rem;
                          padding: .875rem 1rem; border-radius: 10px; border: 1px solid var(--border, #2a2a4a);
                          background: var(--surface, #1a1a2e); cursor: pointer; transition: border-color 150ms;
                          text-align: left; }
        .format-card:hover, .format-card.selected { border-color: var(--primary, #6366f1); }
        .format-card.selected { background: rgba(99,102,241,.1); }
        .format-icon  { font-size: 1.25rem; }
        .format-label { font-weight: 700; font-size: .9rem; color: var(--text, #e2e8f0); }
        .format-hint  { font-size: .75rem; color: var(--text-secondary, #94a3b8); }

        /* Drop zone */
        .drop-zone    { border: 2px dashed var(--border, #2a2a4a); border-radius: 14px;
                        padding: 3rem 2rem; text-align: center; cursor: pointer;
                        transition: border-color 200ms, background 200ms; }
        .drop-zone:hover, .drop-zone.drag-over { border-color: var(--primary, #6366f1); background: rgba(99,102,241,.05); }
        .drop-zone.loading { cursor: default; pointer-events: none; }
        .drop-loading { display: flex; align-items: center; justify-content: center; gap: .75rem; font-size: .9375rem; }
        .drop-icon    { font-size: 2.5rem; margin-bottom: .5rem; }
        .drop-text    { font-size: 1rem; font-weight: 600; color: var(--text, #e2e8f0); }
        .drop-link    { color: var(--primary, #6366f1); }
        .drop-sub     { font-size: .8125rem; color: var(--text-secondary, #94a3b8); margin-top: .25rem; }

        /* Spinner */
        .spinner      { width: 20px; height: 20px; border: 2px solid rgba(255,255,255,.2);
                        border-top-color: var(--primary, #6366f1); border-radius: 50%;
                        animation: spin 600ms linear infinite; }
        .spinner-sm   { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,.2);
                        border-top-color: #fff; border-radius: 50%; animation: spin 600ms linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        /* Import result */
        .import-result { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; }
        .result-stat   { padding: .35rem .875rem; border-radius: 999px; font-size: .8125rem; font-weight: 600; }
        .result-stat.success { background: rgba(34,197,94,.1); color: #22c55e; border: 1px solid rgba(34,197,94,.2); }
        .result-stat.warn    { background: rgba(234,179,8,.1);  color: #eab308; border: 1px solid rgba(234,179,8,.2);  }
        .result-errors { font-size: .8125rem; color: var(--text-secondary, #94a3b8); }
        .result-errors ul { margin: .35rem 0 0 1rem; }

        /* Export grid */
        .export-grid  { display: flex; flex-direction: column; gap: .75rem; }
        .export-card  { display: flex; align-items: center; justify-content: space-between;
                        padding: 1rem 1.25rem; border-radius: 12px; border: 1px solid var(--border, #2a2a4a);
                        background: var(--surface, #1a1a2e); transition: border-color 150ms; }
        .export-card:hover { border-color: var(--primary, #6366f1); }
        .export-card-left { display: flex; align-items: center; gap: .875rem; }
        .export-icon  { font-size: 1.375rem; }
        .export-label { font-weight: 700; font-size: .9375rem; color: var(--text, #e2e8f0); }
        .export-desc  { font-size: .8125rem; color: var(--text-secondary, #94a3b8); margin-top: .15rem; }
        .btn-export   { width: 36px; height: 36px; border-radius: 8px; border: 1px solid var(--border, #2a2a4a);
                        background: var(--surface-hi, #1e1e3a); color: var(--primary, #6366f1);
                        font-size: 1rem; font-weight: 700; cursor: pointer; display: flex;
                        align-items: center; justify-content: center; transition: background 150ms; }
        .btn-export:hover { background: var(--primary, #6366f1); color: #fff; }
        .btn-export:disabled { opacity: .5; cursor: not-allowed; }
      `}</style>
    </div>
  );
};

export default ImportExportPage;
