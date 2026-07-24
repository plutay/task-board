import { useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from './supabaseClient';
import './App.css';

type Task = {
  id: string;
  title: string;
  status: string;
  description: string | null;
  priority: string;
  due_date: string | null;
  created_at: string;
};

const COLUMNS = [
  { id: 'todo', title: 'To Do' },
  { id: 'in_progress', title: 'In Progress' },
  { id: 'in_review', title: 'In Review' },
  { id: 'done', title: 'Done' },
];

function App() {
  const { session, loading: authLoading } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!session) return;
    loadTasks();
  }, [session]);

  async function loadTasks() {
    setTasksLoading(true);
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      setError(error.message);
    } else {
      setTasks(data as Task[]);
    }
    setTasksLoading(false);
  }

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setCreating(true);
    const { error } = await supabase
      .from('tasks')
      .insert({ title: newTitle.trim(), status: 'todo' });

    if (error) {
      setError(error.message);
    } else {
      setNewTitle('');
      await loadTasks(); // refresh the list to show the new task
    }
    setCreating(false);
  }

  if (authLoading) return <div className="centered">Loading...</div>;
  if (!session) return <div className="centered">Couldn't start a session. Please refresh.</div>;

  return (
    <div className="board">
      <header className="board-header">
        <h1>Task Board</h1>
      </header>

      <form className="new-task-form" onSubmit={handleCreateTask}>
        <input
          type="text"
          placeholder="Add a new task..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          disabled={creating}
        />
        <button type="submit" disabled={creating || !newTitle.trim()}>
          {creating ? 'Adding...' : 'Add Task'}
        </button>
      </form>

      {error && <div className="error-banner">Error: {error}</div>}

      <div className="columns">
        {COLUMNS.map((col) => {
          const columnTasks = tasks.filter((t) => t.status === col.id);
          return (
            <div key={col.id} className="column">
              <div className="column-header">
                <span>{col.title}</span>
                <span className="count">{columnTasks.length}</span>
              </div>
              <div className="column-body">
                {tasksLoading ? (
                  <p className="empty-state">Loading...</p>
                ) : columnTasks.length === 0 ? (
                  <p className="empty-state">No tasks yet</p>
                ) : (
                  columnTasks.map((task) => (
                    <div key={task.id} className="task-card">
                      <p className="task-title">{task.title}</p>
                      {task.priority && (
                        <span className={`priority-badge priority-${task.priority}`}>
                          {task.priority}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default App;