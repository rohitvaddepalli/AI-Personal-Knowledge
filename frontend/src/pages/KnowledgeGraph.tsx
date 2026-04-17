import { useEffect, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { useNavigate } from 'react-router-dom';
import { Plus, Minus, RotateCcw, Download, ArrowRight } from 'lucide-react';

export default function KnowledgeGraph() {
  const [data, setData] = useState({ nodes: [], links: [] });
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [filter, setFilter] = useState('all');
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<any>(null);

  useEffect(() => {
    fetch('http://localhost:8000/api/graph')
      .then(res => res.json())
      .then(setData)
      .catch(console.error);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let frameId = 0;
    const syncDimensions = () => {
      frameId = 0;
      const nextWidth = container.offsetWidth;
      const nextHeight = container.offsetHeight;
      setDimensions((current) => {
        if (current.width === nextWidth && current.height === nextHeight) return current;
        return { width: nextWidth, height: nextHeight };
      });
    };
    const scheduleSync = () => { if (frameId) return; frameId = window.requestAnimationFrame(syncDimensions); };
    scheduleSync();
    const resizeObserver = new ResizeObserver(scheduleSync);
    resizeObserver.observe(container);
    return () => { resizeObserver.disconnect(); if (frameId) window.cancelAnimationFrame(frameId); };
  }, []);

  const handleZoom = (dir: 'in' | 'out' | 'reset') => {
    if (!graphRef.current) return;
    const g = graphRef.current;
    if (dir === 'reset') { g.zoomToFit(400); return; }
    const currentZoom = g.zoom();
    g.zoom(dir === 'in' ? currentZoom * 1.3 : currentZoom * 0.7, 300);
  };

  const filters = [
    { key: 'all', label: 'All', accent: false },
    { key: 'tag', label: 'By Tag', accent: false },
    { key: 'ai', label: '✦ AI Links', accent: true },
    { key: 'manual', label: 'Manual Links', accent: false },
  ];

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '24px 28px', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem' }}>Graph Explorer</h1>
          {/* Tab links */}
          <nav style={{ display: 'flex', gap: 4, fontFamily: 'var(--font-display)', fontSize: '0.8125rem' }}>
            {['Notes', 'Chat', 'Graph', 'Flashcards', 'Analytics'].map(tab => (
              <span
                key={tab}
                style={{
                  padding: '4px 10px', borderRadius: 'var(--radius-full)', cursor: 'pointer',
                  color: tab === 'Graph' ? 'var(--primary)' : 'var(--on-surface-dim)',
                  borderBottom: tab === 'Graph' ? '2px solid var(--primary)' : 'none',
                  fontWeight: tab === 'Graph' ? 600 : 400,
                }}
              >
                {tab}
              </span>
            ))}
          </nav>
        </div>

        {/* Stats badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          fontFamily: 'var(--font-mono)', fontSize: '0.6875rem',
          color: 'var(--on-surface-dim)',
        }}>
          {data.nodes.length} Nodes • {data.links.length} Connections
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexShrink: 0 }}>
        {filters.map(f => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            style={{
              padding: '6px 14px', borderRadius: 'var(--radius-full)',
              border: filter === f.key ? 'none' : '1px solid var(--outline)',
              background: filter === f.key
                ? (f.accent ? 'var(--secondary-dim)' : 'var(--primary-dim)')
                : 'transparent',
              color: filter === f.key
                ? (f.accent ? 'var(--secondary)' : 'var(--primary)')
                : 'var(--on-surface-variant)',
              fontSize: '0.75rem', fontFamily: 'var(--font-display)',
              fontWeight: 500, cursor: 'pointer',
              transition: 'all 200ms',
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Graph + Controls */}
      <div style={{ flex: 1, display: 'flex', gap: 16, minHeight: 0 }}>
        <div ref={containerRef} style={{
          flex: 1, borderRadius: 'var(--radius-lg)', overflow: 'hidden',
          background: 'var(--surface-container-lowest)', position: 'relative',
        }}>
          {dimensions.width > 0 && (
            <ForceGraph2D
              ref={graphRef}
              width={dimensions.width}
              height={dimensions.height}
              graphData={data}
              autoPauseRedraw
              cooldownTicks={80}
              cooldownTime={2500}
              d3AlphaDecay={0.08}
              nodeLabel="name"
              nodeVal="val"
              linkDirectionalArrowLength={3.5}
              linkDirectionalArrowRelPos={1}
              onNodeClick={(node: any) => setSelectedNode(node)}
              nodeCanvasObject={(node: any, ctx, globalScale) => {
                const size = (node.val || 4) * 1.5;
                const isSelected = selectedNode?.id === node.id;

                // Node glow
                if (isSelected) {
                  ctx.beginPath();
                  ctx.arc(node.x!, node.y!, size + 6, 0, 2 * Math.PI);
                  ctx.fillStyle = 'rgba(202, 190, 255, 0.15)';
                  ctx.fill();
                }

                // Node circle
                ctx.beginPath();
                ctx.arc(node.x!, node.y!, size, 0, 2 * Math.PI);
                const isAI = node.group === 'ai';
                ctx.fillStyle = isSelected ? '#CABEFF'
                  : isAI ? '#03C6B2'
                  : '#947DFF';
                ctx.fill();

                // White center dot for selected
                if (isSelected) {
                  ctx.beginPath();
                  ctx.arc(node.x!, node.y!, size * 0.35, 0, 2 * Math.PI);
                  ctx.fillStyle = '#fff';
                  ctx.fill();
                }

                // Label
                if (globalScale > 1.2 || isSelected) {
                  ctx.font = `${isSelected ? 600 : 400} ${11 / globalScale}px Manrope, sans-serif`;
                  ctx.fillStyle = isSelected ? '#E2E2EB' : '#A0A0AB';
                  ctx.textAlign = 'center';
                  ctx.fillText(node.name || '', node.x!, node.y! + size + 10 / globalScale);
                }
              }}
              linkColor={() => 'rgba(148, 125, 255, 0.15)'}
              linkWidth={1}
            />
          )}

          {/* Zoom Controls */}
          <div style={{
            position: 'absolute', top: 16, right: 16,
            display: 'flex', flexDirection: 'column', gap: 4,
          }}>
            {[
              { icon: <Plus size={16} />, action: () => handleZoom('in') },
              { icon: <Minus size={16} />, action: () => handleZoom('out') },
              { icon: <RotateCcw size={16} />, action: () => handleZoom('reset') },
            ].map((ctrl, i) => (
              <button key={i} onClick={ctrl.action} style={{
                width: 36, height: 36, borderRadius: 'var(--radius-md)',
                background: 'var(--surface-container)', border: '1px solid var(--outline)',
                color: 'var(--on-surface-variant)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'all 200ms',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-container-high)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface-container)'; }}
              >
                {ctrl.icon}
              </button>
            ))}
            <div style={{ height: 8 }} />
            <button onClick={() => {}} style={{
              padding: '8px 12px', borderRadius: 'var(--radius-md)',
              background: 'var(--surface-container)', border: '1px solid var(--outline)',
              color: 'var(--on-surface-variant)', cursor: 'pointer',
              fontSize: '0.6875rem', fontFamily: 'var(--font-display)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Download size={13} /> Export SVG
            </button>
          </div>
        </div>

        {/* Right Panel — Node Details + Legend */}
        <div style={{ width: 280, minWidth: 280, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Selected Node Card */}
          {selectedNode && (
            <div className="animate-fade-in" style={{
              padding: 16, borderRadius: 'var(--radius-lg)',
              background: 'var(--surface-container)',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginBottom: 8,
              }}>
                <span className="label-xs" style={{ color: 'var(--on-surface-dim)' }}>Active Node</span>
                <span style={{
                  fontSize: '0.625rem', color: 'var(--secondary)',
                  fontFamily: 'var(--font-mono)',
                }}>
                  ∞ {selectedNode.connections || 0} Connections
                </span>
              </div>

              <h3 style={{
                fontFamily: 'var(--font-display)', fontSize: '1.125rem',
                fontWeight: 700, marginBottom: 8,
              }}>
                {selectedNode.name || 'Unnamed Node'}
              </h3>

              <p style={{
                fontSize: '0.8125rem', color: 'var(--on-surface-variant)',
                lineHeight: 1.5, marginBottom: 12,
              }}>
                {selectedNode.description || 'Explore connections in your knowledge graph...'}
              </p>

              {/* Tags */}
              {selectedNode.tags && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
                  {(Array.isArray(selectedNode.tags) ? selectedNode.tags : []).map((t: string) => (
                    <span key={t} className="tag" style={{ fontSize: '0.5625rem' }}>#{t}</span>
                  ))}
                </div>
              )}

              <button
                onClick={() => navigate(`/notes/${selectedNode.id}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  background: 'transparent', border: 'none',
                  color: 'var(--primary)', cursor: 'pointer',
                  fontFamily: 'var(--font-display)', fontWeight: 600,
                  fontSize: '0.8125rem',
                }}
              >
                Open Note <ArrowRight size={14} />
              </button>
            </div>
          )}

          {/* Neural Insight */}
          <div style={{
            padding: 16, borderRadius: 'var(--radius-lg)',
            background: 'var(--secondary-container)',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8,
              color: 'var(--secondary)',
            }}>
              <span>◉</span>
              <span style={{
                fontFamily: 'var(--font-display)', fontWeight: 700,
                fontSize: '0.8125rem',
              }}>
                Neural Insight
              </span>
            </div>
            <p style={{
              fontSize: '0.8125rem', color: 'var(--on-surface-variant)',
              lineHeight: 1.5, marginBottom: 12,
            }}>
              Explore clusters in your knowledge graph to discover hidden connections between concepts.
            </p>
            <button className="btn-secondary" style={{ width: '100%', fontSize: '0.75rem' }}>
              Review Suggested Links
            </button>
          </div>

          {/* Graph Legend */}
          <div style={{
            padding: 12, borderRadius: 'var(--radius-md)',
            background: 'var(--surface-container)',
          }}>
            <span className="label-xs" style={{ marginBottom: 8, display: 'block' }}>Graph Legend</span>
            {[
              { color: '#947DFF', label: 'Manual Entry' },
              { color: '#03C6B2', label: 'AI Suggested' },
              { line: 'solid', label: 'Strong Link' },
              { line: 'dashed', label: 'Weak Reference' },
            ].map((item, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '4px 0', fontSize: '0.75rem',
                color: 'var(--on-surface-variant)',
              }}>
                {item.color ? (
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                ) : (
                  <div style={{
                    width: 16, height: 0,
                    borderTop: item.line === 'dashed' ? '1.5px dashed var(--on-surface-dim)' : '1.5px solid var(--on-surface-variant)',
                    flexShrink: 0,
                  }} />
                )}
                {item.label}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
