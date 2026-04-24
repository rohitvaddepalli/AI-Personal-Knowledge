/**
 * FileUploadModal — Phase 3.1
 * Drag-and-drop file ingestor with live job queue progress.
 * Supported: PDF, DOCX, PPTX, MD, TXT, HTML
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, X, FileText, CheckCircle, AlertCircle, Loader2, Trash2, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiUrl } from '../lib/api';

interface Job {
  id: string;
  filename: string;
  status: 'queued' | 'extracting' | 'saving' | 'embedding' | 'connecting' | 'done' | 'failed';
  note_id: string | null;
  error: string | null;
  created_at: number;
}

const STATUS_LABELS: Record<Job['status'], string> = {
  queued: 'Queued',
  extracting: 'Extracting text…',
  saving: 'Saving note…',
  embedding: 'Embedding…',
  connecting: 'Connecting…',
  done: 'Done',
  failed: 'Failed',
};

const ACCEPTED = '.pdf,.docx,.pptx,.md,.txt,.html,.htm';
const MAX_MB = 25;

interface Props {
  onClose: () => void;
}

export default function FileUploadModal({ onClose }: Props) {
  const navigate = useNavigate();
  const [dragging, setDragging] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll active jobs every 1.5s
  useEffect(() => {
    const active = jobs.filter((j) => !['done', 'failed'].includes(j.status));
    if (active.length === 0) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    if (pollRef.current) return; // already polling
    pollRef.current = setInterval(async () => {
      const updated = await Promise.all(
        jobs.map(async (j) => {
          if (['done', 'failed'].includes(j.status)) return j;
          try {
            const r = await fetch(apiUrl(`/api/ingest/jobs/${j.id}`));
            return r.ok ? (await r.json() as Job) : j;
          } catch { return j; }
        })
      );
      setJobs(updated);
    }, 1500);
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [jobs]);

  const uploadFile = useCallback(async (file: File) => {
    if (file.size > MAX_MB * 1024 * 1024) {
      alert(`${file.name} exceeds the ${MAX_MB} MB limit.`);
      return;
    }
    const form = new FormData();
    form.append('file', file);
    form.append('title', file.name.replace(/\.[^.]+$/, ''));

    setUploading(true);
    try {
      const res = await fetch(apiUrl('/api/ingest/file'), { method: 'POST', body: form });
      if (!res.ok) throw new Error(await res.text());
      const job: Job = await res.json();
      setJobs((prev) => [{ ...job, status: 'queued' } as Job, ...prev]);
    } catch (e: any) {
      alert(`Upload failed: ${e.message}`);
    } finally {
      setUploading(false);
    }
  }, []);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files) return;
    Array.from(files).forEach(uploadFile);
  }, [uploadFile]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const dismissJob = async (id: string) => {
    await fetch(apiUrl(`/api/ingest/jobs/${id}`), { method: 'DELETE' });
    setJobs((prev) => prev.filter((j) => j.id !== id));
  };

  const statusColor = (s: Job['status']) => {
    if (s === 'done') return 'var(--secondary)';
    if (s === 'failed') return 'var(--error)';
    return 'var(--primary)';
  };

  const jobsDone = jobs.filter((j) => j.status === 'done').length;
  const jobsActive = jobs.filter((j) => !['done', 'failed'].includes(j.status)).length;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 600,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div className="animate-slide-up" style={{
        width: '100%', maxWidth: 520,
        background: 'var(--surface-container)',
        borderRadius: 'var(--radius-2xl)',
        border: '1px solid var(--outline)',
        overflow: 'hidden',
        boxShadow: '0 32px 80px rgba(0,0,0,0.45)',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid var(--outline-variant)',
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <Upload size={18} style={{ color: 'var(--primary)' }} />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', flex: 1 }}>
            Import Files
          </span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--on-surface-dim)', padding: 4, borderRadius: 'var(--radius-sm)' }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 24 }}>
          {/* Drop zone */}
          <div
            onDrop={onDrop}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onClick={() => fileRef.current?.click()}
            style={{
              border: `2px dashed ${dragging ? 'var(--primary)' : 'var(--outline-variant)'}`,
              borderRadius: 'var(--radius-xl)',
              background: dragging ? 'var(--primary-container)' : 'var(--surface-container-lowest)',
              padding: '36px 24px',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 200ms',
              marginBottom: 20,
            }}
          >
            <Upload size={32} style={{ color: dragging ? 'var(--primary)' : 'var(--on-surface-dim)', margin: '0 auto 12px', display: 'block' }} />
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.9375rem', color: 'var(--on-surface)', marginBottom: 6 }}>
              {uploading ? 'Uploading…' : 'Drop files here or click to browse'}
            </p>
            <p style={{ fontSize: '0.75rem', color: 'var(--on-surface-dim)' }}>
              PDF, DOCX, PPTX, MD, TXT, HTML — up to {MAX_MB} MB each
            </p>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept={ACCEPTED}
              style={{ display: 'none' }}
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>

          {/* Jobs list */}
          {jobs.length > 0 && (
            <div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
                fontSize: '0.75rem', color: 'var(--on-surface-dim)',
              }}>
                <span style={{ flex: 1, fontFamily: 'var(--font-display)', fontWeight: 700 }}>
                  {jobsActive > 0 ? `Processing ${jobsActive} file${jobsActive > 1 ? 's' : ''}…` : `${jobsDone} file${jobsDone !== 1 ? 's' : ''} imported`}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 240, overflowY: 'auto' }}>
                {jobs.map((job) => (
                  <div key={job.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', borderRadius: 'var(--radius-md)',
                    background: 'var(--surface-container-lowest)',
                    border: `1px solid ${job.status === 'failed' ? 'var(--error)' : job.status === 'done' ? 'var(--outline-variant)' : 'var(--outline-variant)'}`,
                  }}>
                    <FileText size={16} style={{ color: statusColor(job.status), flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: '0.8125rem', fontFamily: 'var(--font-display)', fontWeight: 600,
                        color: 'var(--on-surface)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>{job.filename}</div>
                      <div style={{ fontSize: '0.6875rem', color: statusColor(job.status) }}>
                        {job.status === 'failed' ? (job.error || 'Failed') : STATUS_LABELS[job.status]}
                      </div>
                    </div>

                    {/* Status icon */}
                    {job.status === 'done' && (
                      <CheckCircle size={16} style={{ color: 'var(--secondary)', flexShrink: 0 }} />
                    )}
                    {job.status === 'failed' && (
                      <AlertCircle size={16} style={{ color: 'var(--error)', flexShrink: 0 }} />
                    )}
                    {!['done', 'failed'].includes(job.status) && (
                      <Loader2 size={16} style={{ color: 'var(--primary)', flexShrink: 0, animation: 'spin 1s linear infinite' }} />
                    )}

                    {/* Actions */}
                    {job.status === 'done' && job.note_id && (
                      <button
                        onClick={() => { onClose(); navigate(`/notes/${job.note_id}`); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', padding: 4 }}
                        title="Open note"
                      >
                        <ExternalLink size={14} />
                      </button>
                    )}
                    {['done', 'failed'].includes(job.status) && (
                      <button
                        onClick={() => dismissJob(job.id)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--on-surface-dim)', padding: 4 }}
                        title="Dismiss"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
