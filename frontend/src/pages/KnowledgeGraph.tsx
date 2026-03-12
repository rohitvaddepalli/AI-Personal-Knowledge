import { useEffect, useState, useRef } from 'react';
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
    if (containerRef.current) {
        setDimensions({
            width: containerRef.current.offsetWidth,
            height: containerRef.current.offsetHeight
        });
    }
    
    const handleResize = () => {
        if (containerRef.current) {
            setDimensions({
                width: containerRef.current.offsetWidth,
                height: containerRef.current.offsetHeight
            });
        }
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        <h1>Knowledge Graph</h1>
        <div ref={containerRef} style={{ flex: 1, backgroundColor: 'var(--surface-color)', borderRadius: '0.75rem', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
        <ForceGraph2D
            width={dimensions.width}
            height={dimensions.height}
            graphData={data}
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
