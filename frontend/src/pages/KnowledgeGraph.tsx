import { useEffect, useRef, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { useNavigate } from 'react-router-dom';

export default function KnowledgeGraph() {
  const [data, setData] = useState({ nodes: [], links: [] });
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);

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
        if (current.width === nextWidth && current.height === nextHeight) {
          return current;
        }

        return { width: nextWidth, height: nextHeight };
      });
    };

    const scheduleSync = () => {
      if (frameId) return;
      frameId = window.requestAnimationFrame(syncDimensions);
    };

    scheduleSync();

    const resizeObserver = new ResizeObserver(scheduleSync);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, []);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <h1>Knowledge Graph</h1>
        <div ref={containerRef} style={{ flex: 1, backgroundColor: 'var(--surface-color)', borderRadius: '0.75rem', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
        <ForceGraph2D
            width={dimensions.width}
            height={dimensions.height}
            graphData={data}
            autoPauseRedraw
            cooldownTicks={80}
            cooldownTime={2500}
            d3AlphaDecay={0.08}
            nodeLabel="name"
            nodeAutoColorBy="group"
            nodeVal="val"
            linkDirectionalArrowLength={3.5}
            linkDirectionalArrowRelPos={1}
            onNodeClick={(node: any) => {
               navigate(`/notes/${node.id}`);
            }}
            linkColor={() => 'rgba(255,255,255,0.2)'}
        />
        </div>
    </div>
  );
}
