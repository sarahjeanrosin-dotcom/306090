import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { Plus, Filter, Edit2, Trash2, AlertTriangle } from 'lucide-react';
import { getTasks, createTask, updateTask, deleteTask, getGoals, getMilestones } from '../lib/api';
import type { Task, Goal, Milestone } from '../types';
import { formatDate, statusColor, statusLabel, milestoneLabel, cn } from '../lib/utils';
import ProgressBar from '../components/ProgressBar';
import Modal from '../components/Modal';

export default function Tasks() {
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);

  const statusFilter = searchParams.get('status') || '';
  const milestoneFilter = searchParams.get('milestone') || '';

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', statusFilter, milestoneFilter],
    queryFn: () => getTasks({ status: statusFilter || undefined }),
  });

  const { data: goals = [] } = useQuery({ queryKey: ['goals'], queryFn: getGoals });
  const { data: milestones = [] } = useQuery({ queryKey: ['milestones'], queryFn: () => getMilestones() });

  const deleteMutation = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Task> }) => updateTask(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  });

  const filtered = tasks.filter(t => {
    if (milestoneFilter === '30') return t.milestone_type === 30;
    if (milestoneFilter === '60') return t.milestone_type === 60;
    if (milestoneFilter === '90') return t.milestone_type === 90;
    if (milestoneFilter === 'none') return !t.milestone_id;
    return true;
  });

  const groupedByStatus = {
    todo: filtered.filter(t => t.status === 'todo'),
    in_progress: filtered.filter(t => t.status === 'in_progress'),
    blocked: filtered.filter(t => t.status === 'blocked'),
    completed: filtered.filter(t => t.status === 'completed'),
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tasks</h1>
          <p className="text-gray-500 mt-1">Track all your tasks across goals and milestones</p>
        </div>
        <button className="btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}>
          <Plus size={16} /> New Task
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4 flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Filter size={15} className="text-gray-400" />
          <span className="text-sm text-gray-600">Filter:</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          {['', 'todo', 'in_progress', 'blocked', 'completed'].map(s => (
            <button key={s} onClick={() => setSearchParams(s ? { status: s } : {})}
              className={cn('badge cursor-pointer', statusFilter === s ? 'bg-[#2C3E8F] text-white' : statusColor(s || 'all') || 'bg-gray-100 text-gray-600')}>
              {s ? statusLabel(s) : 'All'}
            </button>
          ))}
        </div>
        <div className="h-4 w-px bg-gray-200" />
        <div className="flex gap-2 flex-wrap">
          {[['', 'All Days'], ['30', '30-Day'], ['60', '60-Day'], ['90', '90-Day'], ['none', 'No Milestone']].map(([v, l]) => (
            <button key={v} onClick={() => setSearchParams(prev => { const p = new URLSearchParams(prev); v ? p.set('milestone', v) : p.delete('milestone'); return p; })}
              className={cn('badge cursor-pointer', milestoneFilter === v ? 'bg-[#2C3E8F] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {Object.entries(groupedByStatus).map(([status, items]) => (
          <div key={status} className="card p-4">
            <div className="text-2xl font-bold text-gray-900">{items.length}</div>
            <div className={`badge mt-1 ${statusColor(status)}`}>{statusLabel(status)}</div>
          </div>
        ))}
      </div>

      {/* Task list */}
      {filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-3">✅</div>
          <p className="text-gray-500">No tasks matching these filters.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(task => (
            <div key={task.id} className={cn('card p-4 hover:shadow-sm transition-shadow', task.status === 'blocked' && 'border-red-200 bg-red-50/30')}>
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={task.status === 'completed'}
                  className="w-4 h-4 mt-0.5 text-[#2C3E8F] rounded border-gray-300 flex-shrink-0"
                  onChange={() => updateMutation.mutate({
                    id: task.id,
                    data: { ...task, status: task.status === 'completed' ? 'todo' : 'completed', percent_complete: task.status === 'completed' ? task.percent_complete : 100 }
                  })}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className={cn('font-medium text-gray-900', task.status === 'completed' && 'line-through text-gray-400')}>
                        {task.title}
                      </span>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <span className={`badge text-xs ${statusColor(task.status)}`}>{statusLabel(task.status)}</span>
                        {task.milestone_type && <span className="badge bg-gray-100 text-gray-600 text-xs">{milestoneLabel(task.milestone_type)}</span>}
                        {task.goal_title && <span className="text-xs text-gray-500">{task.goal_title}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button className="btn-ghost p-1.5" onClick={() => { setEditing(task); setShowForm(true); }}>
                        <Edit2 size={14} />
                      </button>
                      <button className="btn-ghost p-1.5 text-red-500 hover:bg-red-50"
                        onClick={() => window.confirm('Delete?') && deleteMutation.mutate(task.id)}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  {task.description && <p className="text-sm text-gray-500 mt-1.5">{task.description}</p>}
                  {task.blockers && (
                    <div className="mt-2 text-sm text-red-600 flex items-start gap-1.5">
                      <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                      <span>{task.blockers}</span>
                    </div>
                  )}
                  {task.status !== 'completed' && (
                    <div className="mt-2 flex items-center gap-3">
                      <ProgressBar value={task.percent_complete} size="sm" className="flex-1" />
                      <span className="text-xs text-gray-500 w-8">{task.percent_complete}%</span>
                    </div>
                  )}
                  {task.due_date && (
                    <div className="mt-1 text-xs text-gray-400">Due: {formatDate(task.due_date)}</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editing ? 'Edit Task' : 'New Task'} size="lg">
        <TaskForm task={editing} goals={goals} milestones={milestones}
          onSuccess={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ['tasks'] }); }} />
      </Modal>
    </div>
  );
}

function TaskForm({ task, goals, milestones, onSuccess }: {
  task: Task | null; goals: Goal[]; milestones: Milestone[]; onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    title: task?.title || '',
    description: task?.description || '',
    goal_id: task?.goal_id || '',
    milestone_id: task?.milestone_id || '',
    status: task?.status || 'todo',
    percent_complete: task?.percent_complete || 0,
    notes: task?.notes || '',
    blockers: task?.blockers || '',
    due_date: task?.due_date || '',
  });
  const [saving, setSaving] = useState(false);

  const availableMilestones = form.goal_id
    ? milestones.filter(m => m.goal_id === form.goal_id)
    : milestones;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (task) await updateTask(task.id, form);
      else await createTask(form);
      onSuccess();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Title *</label>
        <input className="input" required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Task title" />
      </div>
      <div>
        <label className="label">Description</label>
        <textarea className="input" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Linked Goal</label>
          <select className="input" value={form.goal_id} onChange={e => setForm({ ...form, goal_id: e.target.value, milestone_id: '' })}>
            <option value="">No goal</option>
            {goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Milestone</label>
          <select className="input" value={form.milestone_id} onChange={e => setForm({ ...form, milestone_id: e.target.value })}>
            <option value="">No milestone</option>
            {availableMilestones.map(m => <option key={m.id} value={m.id}>{m.type}-Day: {m.title}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Status</label>
          <select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Task['status'] })}>
            <option value="todo">To Do</option>
            <option value="in_progress">In Progress</option>
            <option value="blocked">Blocked</option>
            <option value="completed">Completed</option>
          </select>
        </div>
        <div>
          <label className="label">Progress ({form.percent_complete}%)</label>
          <input type="range" min={0} max={100} step={5} className="w-full mt-2" value={form.percent_complete}
            onChange={e => setForm({ ...form, percent_complete: parseInt(e.target.value) })} />
        </div>
      </div>
      <div>
        <label className="label">Blockers</label>
        <textarea className="input" rows={2} value={form.blockers} onChange={e => setForm({ ...form, blockers: e.target.value })} placeholder="Any blockers or risks?" />
      </div>
      <div>
        <label className="label">Notes</label>
        <textarea className="input" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
      </div>
      <div>
        <label className="label">Due Date</label>
        <input type="date" className="input" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} />
      </div>
      <button type="submit" className="btn-primary w-full" disabled={saving}>
        {saving ? 'Saving...' : task ? 'Update Task' : 'Create Task'}
      </button>
    </form>
  );
}
