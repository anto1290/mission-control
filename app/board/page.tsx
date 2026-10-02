'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';

interface Task {
  id: string;
  title: string;
  status: string;
  assignee?: string;
  priority?: number;
  n_comments?: number;
  n_runs?: number;
}

const COLUMNS = [
  { key: 'ready', label: 'Ready', color: 'bg-blue-500' },
  { key: 'running', label: 'Running', color: 'bg-green-500' },
  { key: 'blocked', label: 'Blocked', color: 'bg-red-500' },
  { key: 'review', label: 'Review', color: 'bg-amber-500' },
  { key: 'done', label: 'Done', color: 'bg-dark-500' },
];

export default function BoardPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTask, setNewTask] = useState('');
  const [assignee, setAssignee] = useState('');

  useEffect(() => {
    fetchTasks();
    const interval = setInterval(fetchTasks, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/board');
      const data = await res.json();
      setTasks(data.tasks || []);
    } catch (e) {
      console.error('Failed to fetch tasks:', e);
    } finally {
      setLoading(false);
    }
  };

  const createTask = async () => {
    if (!newTask.trim()) return;
    
    try {
      const res = await fetch('/api/board/task', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTask, assignee: assignee || undefined }),
      });
      const data = await res.json();
      
      if (data.ok) {
        setNewTask('');
        setAssignee('');
        fetchTasks();
      }
    } catch (e) {
      console.error('Failed to create task:', e);
    }
  };

  const completeTask = async (id: string) => {
    try {
      await fetch('/api/board/task/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      fetchTasks();
    } catch (e) {
      console.error('Failed to complete task:', e);
    }
  };

  const getTasksByColumn = (status: string) => {
    return tasks.filter(t => {
      if (status === 'blocked') return ['blocked', 'scheduled', 'triage', 'todo'].includes(t.status);
      return t.status === status;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Task Board</h1>
          <p className="text-dark-400 mt-1">Real-time kanban board from Hermes</p>
        </div>
        <button
          onClick={fetchTasks}
          className="px-4 py-2 rounded-lg bg-dark-800 hover:bg-dark-700 text-white text-sm font-medium transition-colors"
        >
          ↻ Refresh
        </button>
      </div>

      {/* New Task */}
      <div className="glass-card rounded-xl p-4">
        <div className="flex gap-3">
          <input
            type="text"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            placeholder="New task title..."
            className="flex-1 px-4 py-2 rounded-lg bg-dark-800 border border-dark-700 text-white placeholder-dark-500 focus:outline-none focus:border-primary-500"
            onKeyDown={(e) => e.key === 'Enter' && createTask()}
          />
          <select
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            className="px-4 py-2 rounded-lg bg-dark-800 border border-dark-700 text-white focus:outline-none focus:border-primary-500"
          >
            <option value="">No assignee</option>
            <option value="default">Lead Agent</option>
            <option value="leadenginer">Lead Engineer</option>
            <option value="opencode">OpenCode</option>
          </select>
          <button
            onClick={createTask}
            disabled={!newTask.trim()}
            className="px-6 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium transition-colors"
          >
            Create
          </button>
        </div>
      </div>

      {/* Board */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="glass-card rounded-xl p-4 animate-pulse">
              <div className="h-4 bg-dark-700 rounded w-1/2 mb-4"></div>
              {[1, 2].map(j => (
                <div key={j} className="h-16 bg-dark-800 rounded mb-2"></div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {COLUMNS.map(col => (
            <Column
              key={col.key}
              column={col}
              tasks={getTasksByColumn(col.key)}
              onComplete={completeTask}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Column({ column, tasks, onComplete }: { column: any, tasks: Task[], onComplete: (id: string) => void }) {
  return (
    <div className="glass-card rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-2 h-2 rounded-full ${column.color}`}></div>
        <h3 className="font-semibold text-white">{column.label}</h3>
        <span className="ml-auto px-2 py-0.5 rounded-full bg-dark-800 text-dark-400 text-xs">
          {tasks.length}
        </span>
      </div>
      
      <div className="space-y-2">
        {tasks.length === 0 ? (
          <div className="text-center py-8 text-dark-500 text-sm">
            No tasks
          </div>
        ) : (
          tasks.map(task => (
            <TaskCard key={task.id} task={task} onComplete={onComplete} />
          ))
        )}
      </div>
    </div>
  );
}

function TaskCard({ task, onComplete }: { task: Task, onComplete: (id: string) => void }) {
  return (
    <div className="p-3 rounded-lg bg-dark-800/60 hover:bg-dark-800 transition-colors group">
      <p className="text-white text-sm font-medium">{task.title}</p>
      <div className="flex items-center gap-2 mt-2">
        {task.assignee && (
          <span className="px-2 py-0.5 rounded text-xs bg-dark-700 text-dark-300">
            {task.assignee}
          </span>
        )}
        {task.n_comments > 0 && (
          <span className="text-xs text-dark-500">💬 {task.n_comments}</span>
        )}
      </div>
      {task.status === 'running' && (
        <button
          onClick={() => onComplete(task.id)}
          className="mt-2 w-full px-2 py-1 rounded text-xs bg-green-500/20 text-green-400 hover:bg-green-500/30 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          ✓ Complete
        </button>
      )}
    </div>
  );
}