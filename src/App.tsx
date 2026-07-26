import { useEffect, useState } from 'react';
import {
  DndContext,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useAuth } from './AuthContext';
import { supabase } from './supabaseClient';
import { TaskDetailModal } from './TaskDetailModal';
import './App.css';

type Label = {
  id: string;
  name: string;
  color: string;
};

type Task = {
  id: string;
  title: string;
  status: string;
  description: string | null;
  priority: string;
  due_date: string | null;
  created_at: string;
  labels: Label[];
};

const COLUMNS = [
  { id: 'todo', title: 'To Do' },
  { id: 'in_progress', title: 'In Progress' },
  { id: 'in_review', title: 'In Review' },
  { id: 'done', title: 'Done' },
];

function getDueStatus(dueDate: string | null, status: string): 'overdue' | 'soon' | null {
  if (!dueDate || status === 'done') return null;
  const due = new Date(dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return 'overdue';
  if (diffDays <= 2) return 'soon';
  return null;
}

function TaskCard({ task, onOpen }: { task: Task; onOpen: (task: Task) => void }) {
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

  const dueStatus = getDueStatus(task.due_date, task.status);

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className="task-card">
      <div className="task-card-top">
        <p className="task-title">{task.title}</p>
        <button
          className="task-open-btn"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={() => onOpen(task)}
        >
          Open
        </button>
      </div>
      {task.labels.length > 0 && (
        <div className="label-row">
          {task.labels.map((label) => (
            <span key={label.id} className="label-chip" style={{ background: label.color }}>
              {label.name}
            </span>
          ))}
        </div>
      )}
      <div className="task-meta">
        {task.priority && (
          <span className={`priority-badge priority-${task.priority}`}>{task.priority}</span>
        )}
        {task.due_date && (
          <span className={`due-badge ${dueStatus ? `due-${dueStatus}` : ''}`}>
            {dueStatus === 'overdue' ? 'Overdue' : dueStatus === 'soon' ? 'Due soon' : task.due_date}
          </span>
        )}
      </div>
    </div>
  );
}

function Column({
  column,
  tasks,
  loading,
  onOpenTask,
}: {
  column: { id: string; title: string };
  tasks: Task[];
  loading: boolean;
  onOpenTask: (task: Task) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div ref={setNodeRef} className={`column ${isOver ? 'column-over' : ''}`}>
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
          tasks.map((task) => <TaskCard key={task.id} task={task} onOpen={onOpenTask} />)
        )}
      </div>
    </div>
  );
}

function App() {
  const { session, loading: authLoading } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState('');
  const [newPriority, setNewPriority] = useState('normal');
  const [newDueDate, setNewDueDate] = useState('');
  const [creating, setCreating] = useState(false);
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);

  const [newLabelName, setNewLabelName] = useState('');

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [labelFilter, setLabelFilter] = useState('all');

  // Task detail modal
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  useEffect(() => {
    if (!session) return;
    loadTasks();
    loadLabels();
  }, [session]);

  async function loadLabels() {
    const { data, error } = await supabase.from('labels').select('*').order('created_at');
    if (!error) setLabels(data as Label[]);
  }

  async function loadTasks() {
    setTasksLoading(true);
    const { data, error } = await supabase
      .from('tasks')
      .select('*, task_labels(labels(id, name, color))')
      .order('created_at', { ascending: true });

    if (error) {
      setError(error.message);
    } else {
      const shaped = (data as any[]).map((t) => ({
        ...t,
        labels: t.task_labels.map((tl: any) => tl.labels).filter(Boolean),
      }));
      setTasks(shaped as Task[]);
    }
    setTasksLoading(false);
  }

  async function logActivity(taskId: string, action: string) {
    await supabase.from('task_activity').insert({ task_id: taskId, action });
  }

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setCreating(true);
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        title: newTitle.trim(),
        status: 'todo',
        priority: newPriority,
        due_date: newDueDate || null,
      })
      .select()
      .single();

    if (error) {
      setError(error.message);
    } else {
      if (selectedLabelIds.length > 0) {
        const rows = selectedLabelIds.map((labelId) => ({ task_id: data.id, label_id: labelId }));
        await supabase.from('task_labels').insert(rows);
      }
      await logActivity(data.id, 'Created task');
      setNewTitle('');
      setNewPriority('normal');
      setNewDueDate('');
      setSelectedLabelIds([]);
      await loadTasks();
    }
    setCreating(false);
  }

  async function handleCreateLabel(e: React.FormEvent) {
    e.preventDefault();
    if (!newLabelName.trim()) return;

    const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
    const color = colors[labels.length % colors.length];

    const { error } = await supabase.from('labels').insert({ name: newLabelName.trim(), color });
    if (error) setError(error.message);
    else {
      setNewLabelName('');
      await loadLabels();
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const newStatus = over.id as string;

    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === newStatus) return;

    const oldStatus = task.status;
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)));

    const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', taskId);

    if (error) {
      setError(error.message);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: oldStatus } : t)));
    } else {
      const columnTitle = (id: string) => COLUMNS.find((c) => c.id === id)?.title ?? id;
      await logActivity(taskId, `Moved from ${columnTitle(oldStatus)} → ${columnTitle(newStatus)}`);
    }
  }

  if (authLoading) return <div className="centered">Loading...</div>;
  if (!session) return <div className="centered">Couldn't start a session. Please refresh.</div>;

  const filteredTasks = tasks.filter((t) => {
    const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPriority = priorityFilter === 'all' || t.priority === priorityFilter;
    const matchesLabel = labelFilter === 'all' || t.labels.some((l) => l.id === labelFilter);
    return matchesSearch && matchesPriority && matchesLabel;
  });

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter((t) => t.status === 'done').length;
  const overdueTasks = tasks.filter((t) => getDueStatus(t.due_date, t.status) === 'overdue').length;

  return (
    <div className="board">
      <header className="board-header">
        <h1>Task Board</h1>
        <div className="stats">
          <span><strong>{totalTasks}</strong> total</span>
          <span><strong>{completedTasks}</strong> completed</span>
          <span className={overdueTasks > 0 ? 'stat-overdue' : ''}>
            <strong>{overdueTasks}</strong> overdue
          </span>
        </div>
      </header>

      <form className="new-task-form" onSubmit={handleCreateTask}>
        <input
          type="text"
          placeholder="Add a new task..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          disabled={creating}
        />
        <select value={newPriority} onChange={(e) => setNewPriority(e.target.value)} disabled={creating}>
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
        </select>
        <input
          type="date"
          value={newDueDate}
          onChange={(e) => setNewDueDate(e.target.value)}
          disabled={creating}
        />
        <div className="label-picker">
          {labels.map((l) => (
            <label key={l.id} className="label-checkbox">
              <input
                type="checkbox"
                checked={selectedLabelIds.includes(l.id)}
                onChange={(e) => {
                  if (e.target.checked) setSelectedLabelIds((prev) => [...prev, l.id]);
                  else setSelectedLabelIds((prev) => prev.filter((id) => id !== l.id));
                }}
              />
              <span className="label-chip" style={{ background: l.color }}>{l.name}</span>
            </label>
          ))}
        </div>
        <button type="submit" disabled={creating || !newTitle.trim()}>
          {creating ? 'Adding...' : 'Add Task'}
        </button>
      </form>

      <form className="new-label-form" onSubmit={handleCreateLabel}>
        <input
          type="text"
          placeholder="New label name..."
          value={newLabelName}
          onChange={(e) => setNewLabelName(e.target.value)}
        />
        <button type="submit" disabled={!newLabelName.trim()}>Add Label</button>
        <div className="label-list">
          {labels.map((l) => (
            <span key={l.id} className="label-chip" style={{ background: l.color }}>
              {l.name}
            </span>
          ))}
        </div>
      </form>

      <div className="filter-bar">
        <input
          type="text"
          placeholder="Search tasks..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}>
          <option value="all">All priorities</option>
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
        </select>
        <select value={labelFilter} onChange={(e) => setLabelFilter(e.target.value)}>
          <option value="all">All labels</option>
          {labels.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </div>

      {error && <div className="error-banner">Error: {error}</div>}

      <DndContext onDragEnd={handleDragEnd}>
        <div className="columns">
          {COLUMNS.map((col) => (
            <Column
              key={col.id}
              column={col}
              tasks={filteredTasks.filter((t) => t.status === col.id)}
              loading={tasksLoading}
              onOpenTask={setSelectedTask}
            />
          ))}
        </div>
      </DndContext>

      {selectedTask && (
        <TaskDetailModal task={selectedTask} onClose={() => setSelectedTask(null)} />
      )}
    </div>
  );
}

export default App;