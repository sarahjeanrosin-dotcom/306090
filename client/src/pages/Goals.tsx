import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { Plus, Sparkles, ChevronLeft, Edit2, Trash2, CheckCircle } from 'lucide-react';
import { getGoals, getGoal, createGoal, updateGoal, deleteGoal, getTopics, createMilestone, createTask, updateMilestone } from '../lib/api';
import type { Goal, Topic, AIMilestoneResult } from '../types';
import { formatDate, statusColor, statusLabel, milestoneLabel, cn } from '../lib/utils';
import ProgressBar from '../components/ProgressBar';
import Modal from '../components/Modal';

export default function Goals() {
  const { id } = useParams();
  if (id) return <GoalDetail id={id} />;
  return <GoalList />;
}

function GoalList() {
  const qc = useQueryClient();
  const { data: goals = [] } = useQuery({ queryKey: ['goals'], queryFn: getGoals });
  const { data: topics = [] } = useQuery({ queryKey: ['topics'], queryFn: getTopics });
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);

  const deleteMutation = useMutation({
    mutationFn: deleteGoal,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['goals'] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Goals & Milestones</h1>
          <p className="text-gray-500 mt-1">Define your 90-day goals and let AI break them into milestones</p>
        </div>
        <button className="btn-primary" onClick={() => { setEditing(null); setShowForm(true); }}>
          <Plus size={16} /> New Goal
        </button>
      </div>

      {goals.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-5xl mb-4">🎯</div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">No goals yet</h3>
          <p className="text-gray-500 mb-6">Start by adding your first 90-day goal. AI will help you break it into 30/60/90 milestones.</p>
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            <Plus size={16} /> Add Your First Goal
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {goals.map(goal => (
            <div key={goal.id} className="card p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {goal.topic_name && (
                      <span className="badge text-xs" style={{ backgroundColor: goal.topic_color + '20', color: goal.topic_color }}>
                        {goal.topic_name}
                      </span>
                    )}
                    <span className={`badge ${statusColor(goal.status)}`}>{statusLabel(goal.status)}</span>
                  </div>
                  <Link to={`/goals/${goal.id}`} className="text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors">
                    {goal.title}
                  </Link>
                  {goal.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{goal.description}</p>}
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>{goal.completed_task_count || 0}/{goal.task_count || 0} tasks · {goal.milestone_count || 0} milestones</span>
                      <span>{Math.round(goal.avg_progress || 0)}%</span>
                    </div>
                    <ProgressBar value={goal.avg_progress || 0} size="sm" showLabel={false} />
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Link to={`/goals/${goal.id}`} className="btn-secondary text-xs py-1.5 px-3">View</Link>
                  <button className="btn-ghost p-2" onClick={() => { setEditing(goal); setShowForm(true); }}>
                    <Edit2 size={15} />
                  </button>
                  <button className="btn-ghost p-2 text-red-500 hover:bg-red-50"
                    onClick={() => window.confirm('Delete this goal?') && deleteMutation.mutate(goal.id)}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editing ? 'Edit Goal' : 'New 90-Day Goal'} size="lg">
        <GoalForm
          goal={editing}
          topics={topics}
          onSuccess={() => { setShowForm(false); qc.invalidateQueries({ queryKey: ['goals'] }); }}
        />
      </Modal>
    </div>
  );
}

function GoalDetail({ id }: { id: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: goal, isLoading } = useQuery({ queryKey: ['goal', id], queryFn: () => getGoal(id) });
  const { data: topics = [] } = useQuery({ queryKey: ['topics'], queryFn: getTopics });
  const [showEdit, setShowEdit] = useState(false);
  const [aiResult, setAiResult] = useState<AIMilestoneResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStreaming, setAiStreaming] = useState('');
  const [savingAI, setSavingAI] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: deleteGoal,
    onSuccess: () => navigate('/goals'),
  });

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>;
  if (!goal) return <div>Goal not found</div>;

  async function generateMilestones() {
    setAiLoading(true);
    setAiStreaming('');
    setAiResult(null);
    try {
      const resp = await fetch('/api/ai/generate-milestones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: { ...goal!, topic_name: goal!.topic_name } }),
      });
      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(l => l.startsWith('data: '));
        for (const line of lines) {
          const evt = JSON.parse(line.slice(6));
          if (evt.type === 'text') setAiStreaming(prev => prev + evt.text);
          if (evt.type === 'complete') setAiResult(evt.data);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAiLoading(false);
    }
  }

  async function saveAIResult() {
    if (!aiResult) return;
    setSavingAI(true);
    try {
      for (const m of aiResult.milestones) {
        const newM = await createMilestone({ goal_id: id, type: m.type, title: m.title, description: m.description });
        for (const t of aiResult.tasks.filter(t => t.milestone_type === m.type)) {
          await createTask({ goal_id: id, milestone_id: newM.id, title: t.title, description: t.description, notes: t.notes });
        }
      }
      qc.invalidateQueries({ queryKey: ['goal', id] });
      setAiResult(null);
      setAiStreaming('');
    } finally {
      setSavingAI(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link to="/goals" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900">
        <ChevronLeft size={16} /> All Goals
      </Link>

      {/* Header */}
      <div className="card p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              {goal.topic_name && (
                <span className="badge" style={{ backgroundColor: goal.topic_color + '20', color: goal.topic_color }}>{goal.topic_name}</span>
              )}
              <span className={`badge ${statusColor(goal.status)}`}>{statusLabel(goal.status)}</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{goal.title}</h1>
            {goal.description && <p className="text-gray-600 mt-2">{goal.description}</p>}
            {goal.success_criteria && (
              <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-100">
                <div className="text-xs font-medium text-green-700 mb-0.5">Success Criteria</div>
                <div className="text-sm text-green-800">{goal.success_criteria}</div>
              </div>
            )}
          </div>
          <div className="flex gap-2 ml-4">
            <button className="btn-secondary text-sm" onClick={() => setShowEdit(true)}><Edit2 size={15} /> Edit</button>
            <button className="btn-danger text-sm" onClick={() => window.confirm('Delete?') && deleteMutation.mutate(id)}>
              <Trash2 size={15} />
            </button>
          </div>
        </div>
        <div className="mt-4">
          <div className="flex justify-between text-sm text-gray-500 mb-2">
            <span>Overall Progress</span>
            <span className="font-semibold">{Math.round(goal.avg_progress || 0)}%</span>
          </div>
          <ProgressBar value={goal.avg_progress || 0} size="md" />
        </div>
      </div>

      {/* AI Generate button */}
      {(goal.milestones?.length === 0) && (
        <div className="card p-6 border-dashed border-2 border-blue-200 bg-blue-50/30">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                <Sparkles size={18} className="text-blue-600" /> AI Milestone Generator
              </h3>
              <p className="text-sm text-gray-600 mt-1">Let AI break this goal into 30/60/90-day milestones and tasks</p>
            </div>
            <button className="btn-primary" onClick={generateMilestones} disabled={aiLoading}>
              {aiLoading ? <><span className="animate-spin">⟳</span> Generating...</> : <><Sparkles size={16} /> Generate Plan</>}
            </button>
          </div>

          {aiLoading && aiStreaming && (
            <div className="mt-4 p-4 bg-white rounded-lg border border-blue-100 text-xs text-gray-600 font-mono max-h-40 overflow-y-auto">
              <div className="text-blue-600 font-medium mb-1">AI is thinking...</div>
              {aiStreaming}
            </div>
          )}

          {aiResult && (
            <div className="mt-4 space-y-4">
              <div className="text-sm font-medium text-gray-700">AI-Generated Plan (review & edit before saving):</div>
              {aiResult.milestones.map(m => (
                <div key={m.type} className="bg-white rounded-lg border border-gray-200 p-4">
                  <div className="font-semibold text-gray-900 flex items-center gap-2">
                    <span className="badge bg-blue-100 text-blue-700">{m.type}-Day</span> {m.title}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">{m.description}</p>
                  <div className="mt-3 space-y-1">
                    {aiResult.tasks.filter(t => t.milestone_type === m.type).map((t, i) => (
                      <div key={i} className="text-sm text-gray-700 flex items-start gap-2">
                        <span className="text-gray-400 mt-0.5">•</span>
                        <span><span className="font-medium">{t.title}</span>{t.description ? ` — ${t.description}` : ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div className="flex gap-3">
                <button className="btn-primary" onClick={saveAIResult} disabled={savingAI}>
                  {savingAI ? 'Saving...' : <><CheckCircle size={16} /> Save Plan</>}
                </button>
                <button className="btn-secondary" onClick={() => setAiResult(null)}>Discard</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Milestones & Tasks */}
      {[30, 60, 90].map(type => {
        const milestones = goal.milestones?.filter(m => m.type === type) || [];
        const tasks: NonNullable<Goal['tasks']> = goal.tasks?.filter(t => {
          const m = goal.milestones?.find(m => m.id === t.milestone_id);
          return m?.type === type;
        }) || [];
        return (
          <MilestoneSection key={type} type={type as 30 | 60 | 90} milestones={milestones} tasks={tasks} goalId={id}
            onUpdate={() => qc.invalidateQueries({ queryKey: ['goal', id] })} />
        );
      })}

      {/* Unlinked tasks */}
      {(() => {
        const unlinked = goal.tasks?.filter(t => !t.milestone_id) || [];
        if (unlinked.length === 0) return null;
        return (
          <div className="card p-6">
            <h3 className="font-semibold text-gray-900 mb-3">Unassigned Tasks</h3>
            <TaskList tasks={unlinked} onUpdate={() => qc.invalidateQueries({ queryKey: ['goal', id] })} />
          </div>
        );
      })()}

      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title="Edit Goal" size="lg">
        <GoalForm goal={goal} topics={topics} onSuccess={() => { setShowEdit(false); qc.invalidateQueries({ queryKey: ['goal', id] }); }} />
      </Modal>
    </div>
  );
}

function MilestoneSection({ type, milestones, tasks, goalId, onUpdate }: {
  type: 30 | 60 | 90; milestones: Goal['milestones']; tasks: NonNullable<Goal['tasks']>; goalId: string; onUpdate: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const colors = { 30: 'blue', 60: 'purple', 90: 'green' } as const;
  const colorMap = { blue: 'bg-blue-50 border-blue-200', purple: 'bg-purple-50 border-purple-200', green: 'bg-green-50 border-green-200' };
  const badgeMap = { blue: 'bg-blue-100 text-blue-700', purple: 'bg-purple-100 text-purple-700', green: 'bg-green-100 text-green-700' };
  const c = colors[type];

  return (
    <div className={`card p-6 border-l-4 ${c === 'blue' ? 'border-l-blue-500' : c === 'purple' ? 'border-l-purple-500' : 'border-l-green-500'}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <span className={`badge ${badgeMap[c]}`}>{type}-Day</span>
          Milestone
        </h3>
        {milestones?.length === 0 && (
          <button className="btn-secondary text-xs" onClick={() => setShowAdd(true)}>+ Add</button>
        )}
      </div>

      {milestones?.length === 0 ? (
        <p className="text-sm text-gray-400 italic">No {type}-day milestone set. {showAdd ? null : 'Click + Add or use AI above.'}</p>
      ) : (
        milestones?.map(m => (
          <div key={m.id} className={`p-4 rounded-lg ${colorMap[c]} mb-3`}>
            <div className="flex items-start justify-between">
              <div>
                <div className="font-medium text-gray-900">{m.title}</div>
                {m.description && <p className="text-sm text-gray-600 mt-1">{m.description}</p>}
                {m.target_date && <div className="text-xs text-gray-500 mt-1">Target: {formatDate(m.target_date)}</div>}
              </div>
              <MilestoneStatusToggle milestone={m} onUpdate={onUpdate} />
            </div>
            {tasks.length > 0 && (
              <div className="mt-3">
                <ProgressBar value={m.avg_progress || 0} size="sm" showLabel />
              </div>
            )}
          </div>
        ))
      )}

      {tasks.length > 0 && (
        <div className="mt-3">
          <div className="text-xs font-medium text-gray-500 mb-2 uppercase tracking-wide">Tasks</div>
          <TaskList tasks={tasks} onUpdate={onUpdate} />
        </div>
      )}

      {showAdd && (
        <MilestoneInlineForm type={type} goalId={goalId} onSuccess={() => { setShowAdd(false); onUpdate(); }} onCancel={() => setShowAdd(false)} />
      )}
    </div>
  );
}

function MilestoneStatusToggle({ milestone, onUpdate }: { milestone: NonNullable<Goal['milestones']>[number]; onUpdate: () => void }) {
  const qc = useQueryClient();
  const nextStatus = { not_started: 'in_progress', in_progress: 'completed', completed: 'not_started' } as const;
  const labels = { not_started: '○ Not Started', in_progress: '◑ In Progress', completed: '● Completed' };

  return (
    <button
      className={`text-xs font-medium px-2 py-1 rounded-full border transition-colors ${statusColor(milestone.status)}`}
      onClick={async () => {
        await updateMilestone(milestone.id, { ...milestone, status: nextStatus[milestone.status as keyof typeof nextStatus] });
        onUpdate();
      }}
    >
      {labels[milestone.status as keyof typeof labels]}
    </button>
  );
}

function TaskList({ tasks, onUpdate }: { tasks: NonNullable<Goal['tasks']>; onUpdate: () => void }) {
  const { updateTask, deleteTask } = { updateTask: (id: string, d: Record<string, unknown>) => fetch(`/api/tasks/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d) }), deleteTask: (id: string) => fetch(`/api/tasks/${id}`, { method: 'DELETE' }) };

  return (
    <div className="space-y-1.5">
      {tasks.map(t => (
        <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 group">
          <input
            type="checkbox"
            checked={t.status === 'completed'}
            className="w-4 h-4 text-blue-600 rounded border-gray-300"
            onChange={async () => {
              const newStatus = t.status === 'completed' ? 'todo' : 'completed';
              await updateTask(t.id, { ...t, status: newStatus, percent_complete: newStatus === 'completed' ? 100 : t.percent_complete });
              onUpdate();
            }}
          />
          <span className={`flex-1 text-sm ${t.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-800'}`}>{t.title}</span>
          {t.status === 'blocked' && <span className="badge bg-red-100 text-red-700 text-xs">Blocked</span>}
          <span className="text-xs text-gray-400 opacity-0 group-hover:opacity-100">{t.percent_complete}%</span>
          <button className="opacity-0 group-hover:opacity-100 p-1 text-red-400 hover:text-red-600"
            onClick={async () => { await deleteTask(t.id); onUpdate(); }}>
            <Trash2 size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}

function MilestoneInlineForm({ type, goalId, onSuccess, onCancel }: { type: number; goalId: string; onSuccess: () => void; onCancel: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  return (
    <div className="mt-4 p-4 bg-white rounded-lg border border-gray-200">
      <div className="text-sm font-medium text-gray-700 mb-3">Add {type}-Day Milestone</div>
      <input className="input mb-2" placeholder="Milestone title" value={title} onChange={e => setTitle(e.target.value)} />
      <textarea className="input mb-3" rows={2} placeholder="Description (optional)" value={description} onChange={e => setDescription(e.target.value)} />
      <div className="flex gap-2">
        <button className="btn-primary text-sm" disabled={!title || saving}
          onClick={async () => { setSaving(true); await createMilestone({ goal_id: goalId, type: type as 30 | 60 | 90, title, description }); onSuccess(); }}>
          Save
        </button>
        <button className="btn-secondary text-sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

function GoalForm({ goal, topics, onSuccess }: { goal: Goal | null; topics: Topic[]; onSuccess: () => void }) {
  const [form, setForm] = useState({
    title: goal?.title || '',
    description: goal?.description || '',
    topic_id: goal?.topic_id || '',
    success_criteria: goal?.success_criteria || '',
    start_date: goal?.start_date || new Date().toISOString().split('T')[0],
    target_end_date: goal?.target_end_date || '',
    status: goal?.status || 'active',
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (goal) await updateGoal(goal.id, form);
      else await createGoal(form);
      onSuccess();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Goal Title *</label>
        <input className="input" required placeholder="e.g., Master the product codebase" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
      </div>
      <div>
        <label className="label">Description</label>
        <textarea className="input" rows={3} placeholder="What do you want to achieve?" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Topic/Category</label>
          <select className="input" value={form.topic_id} onChange={e => setForm({ ...form, topic_id: e.target.value })}>
            <option value="">Select topic...</option>
            {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value as Goal['status'] })}>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
          </select>
        </div>
      </div>
      <div>
        <label className="label">Success Criteria</label>
        <textarea className="input" rows={2} placeholder="How will you know you've achieved this goal?" value={form.success_criteria} onChange={e => setForm({ ...form, success_criteria: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Start Date</label>
          <input type="date" className="input" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })} />
        </div>
        <div>
          <label className="label">Target End Date</label>
          <input type="date" className="input" value={form.target_end_date} onChange={e => setForm({ ...form, target_end_date: e.target.value })} />
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'Saving...' : goal ? 'Update Goal' : 'Create Goal'}</button>
      </div>
    </form>
  );
}
