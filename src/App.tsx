import { useEffect, useState } from 'react';
import {
  DndContext,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from '@dnd-kit/core';
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

// A single draggable task card
function TaskCard({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  });

  const style = transform
    ? {
        transform: `translate(${transform.x}px, ${transform.y}px)`,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 999 : 'auto',
      }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="task-card"
    >
      <p className="task-title">{task.title}</p>
      {task.priority && (
        <span className={`priority-badge priority-${task.priority}`}>
          {task.priority}
        </span>
      )}
    </div>
  );
}

// A single droppable column
function Column({
  column,
  tasks,
  loading,
}: {
  column: { id: string; title: string };
  tasks: Task[];
  loading: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div
      ref={setNodeRef}
      className={`column ${isOver ? 'column-over' : ''}`}
    >
      <div className="column-header">
        <span>{column.title}</span>
        <span className="count">{tasks.length}</span>
      </div>
      <div className="column-body">
        {loading ? (
          <p className="empty-state">Loading...</p>
        ) : tasks.length === 0 ? (
          <p className="empty-state">No tasks yet</p>
        ) : (
          tasks.map((task) => <TaskCard key={task.id} task={task} />)
        )}
      </div>
    </div>
  );
}

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

    if (error) setError(error.message);
    else setTasks(data as Task[]);
    setTasksLoading(false);
  }

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setCreating(true);
    const { error } = await supabase
      .from('tasks')
      .insert({ title: newTitle.trim(), status: 'todo' });

    if (error) setError(error.message);
    else {
      setNewTitle('');
      await loadTasks();
    }
    setCreating(false);
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return; // dropped outside any column

    const taskId = active.id as string;
    const newStatus = over.id as string;

    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return; // no change needed

    // Optimistic update: change the UI immediately
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
    );

    // Persist to Supabase
    const { error } = await supabase
      .from('tasks')
      .update({ status: newStatus })
      .eq('id', taskId);

    if (error) {
      setError(error.message);
      // revert on failure
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: task.status } : t))
      );
    }
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

      <DndContext onDragEnd={handleDragEnd}>
        <div className="columns">
          {COLUMNS.map((col) => (
            <Column
              key={col.id}
              column={col}
              tasks={tasks.filter((t) => t.status === col.id)}
              loading={tasksLoading}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
}

export default App;