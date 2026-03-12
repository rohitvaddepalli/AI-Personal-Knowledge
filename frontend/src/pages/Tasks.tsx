import { useState, useEffect } from 'react';

interface Task {
  id: number;
  text: string;
  is_done: boolean;
}

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTaskText, setNewTaskText] = useState('');

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await fetch('http://localhost:8000/api/tasks');
      const data = await res.json();
      setTasks(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddTask = async () => {
    if (!newTaskText.trim()) return;
    try {
      const res = await fetch('http://localhost:8000/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: newTaskText, is_done: false })
      });
      if (res.ok) {
        setNewTaskText('');
        fetchTasks();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleDone = async (task: Task) => {
    try {
      await fetch(`http://localhost:8000/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_done: !task.is_done })
      });
      fetchTasks();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await fetch(`http://localhost:8000/api/tasks/${id}`, { method: 'DELETE' });
      fetchTasks();
    } catch (e) {
      console.error(e);
    }
  };

  const pendingTasks = tasks.filter(t => !t.is_done);
  const doneTasks = tasks.filter(t => t.is_done);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%', overflowY: 'auto' }}>
      <h1>Global Tasks</h1>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
        <input 
          className="input" 
          value={newTaskText} 
          onChange={e => setNewTaskText(e.target.value)} 
          onKeyDown={e => e.key === 'Enter' && handleAddTask()}
          placeholder="Enter a new task..." 
          style={{ marginBottom: 0, flex: 1 }}
        />
        <button className="btn" onClick={handleAddTask} disabled={!newTaskText.trim()}>Add Task</button>
      </div>

      {loading ? (
        <p>Loading tasks...</p>
      ) : tasks.length === 0 ? (
        <div style={{ textAlign: 'center', marginTop: '3rem' }}>
          <h2 style={{ color: 'var(--text-muted)' }}>No tasks found.</h2>
          <p style={{ color: 'var(--text-muted)' }}>Create a task above to get started!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '2rem' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h2>Pending ({pendingTasks.length})</h2>
            {pendingTasks.map(t => (
              <div key={t.id} className="card" style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                <input 
                  type="checkbox" 
                  checked={t.is_done} 
                  onChange={() => handleToggleDone(t)} 
                  style={{ width: '1.2rem', height: '1.2rem', cursor: 'pointer' }} 
                />
                <div style={{ flex: 1, lineHeight: 1.4 }}>{t.text}</div>
                <button 
                  onClick={() => handleDelete(t.id)}
                  style={{ background: 'transparent', border: 'none', color: '#ff4444', cursor: 'pointer', fontSize: '1.2rem' }}
                  title="Delete"
                >
                  🗑
                </button>
              </div>
            ))}
          </div>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <h2>Done ({doneTasks.length})</h2>
            {doneTasks.map(t => (
              <div key={t.id} className="card" style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', opacity: 0.6 }}>
                <input 
                  type="checkbox" 
                  checked={t.is_done} 
                  onChange={() => handleToggleDone(t)} 
                  style={{ width: '1.2rem', height: '1.2rem', cursor: 'pointer' }} 
                />
                <div style={{ flex: 1, lineHeight: 1.4, textDecoration: 'line-through' }}>{t.text}</div>
                <button 
                  onClick={() => handleDelete(t.id)}
                  style={{ background: 'transparent', border: 'none', color: '#ff4444', cursor: 'pointer', fontSize: '1.2rem' }}
                  title="Delete"
                >
                  🗑
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
