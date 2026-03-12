import networkx as nx
from typing import Dict, Any
from sqlalchemy.orm import Session
from app.models.note import Note
from app.models.connection import Connection
from app.database import SessionLocal

def build_knowledge_graph(db: Session) -> nx.Graph:
    G = nx.Graph()
    notes = db.query(Note).filter(Note.is_archived == False).all()
    
    for note in notes:
        G.add_node(note.id, title=note.title, tags=note.tags)
        
    connections = db.query(Connection).all()
    for conn in connections:
        # Check if nodes still exist
        if G.has_node(conn.source_note_id) and G.has_node(conn.target_note_id):
            G.add_edge(
                conn.source_note_id, 
                conn.target_note_id, 
                weight=conn.strength,
                relationship=conn.relationship_type
            )
            
    return G

def get_graph_data_for_viz(db: Session) -> Dict[str, Any]:
    G = build_knowledge_graph(db)
    
    # Optional clustering
    try:
        from networkx.algorithms.community import louvain_communities
        communities = louvain_communities(G)
        node_group = {}
        for index, comm in enumerate(communities):
            for node in comm:
                node_group[node] = index
    except Exception:
        node_group = {}

    nodes = []
    for node, data in G.nodes(data=True):
        nodes.append({
            "id": node, 
            "name": data.get("title"), 
            "val": G.degree(node) + 1,
            "group": node_group.get(node, 0)
        })
        
    links = [{"source": u, "target": v, "relationship": data.get("relationship")} for u, v, data in G.edges(data=True)]
    
    return {"nodes": nodes, "links": links}
