import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Upload, Link as LinkIcon, Download, Trash2, ExternalLink, FileText, Filter } from 'lucide-react';
import { getDeliverables, uploadDeliverable, createLinkDeliverable, deleteDeliverable, getGoals, getTasks, getTopics } from '../lib/api';
import type { Deliverable, Goal, Task, Topic } from '../types';
import { formatDate, fileSize, cn } from '../lib/utils';
import Modal from '../components/Modal';

export default function Deliverables() {
  const qc = useQueryClient();
  const [showUpload, setShowUpload] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [filterGoal, setFilterGoal] = useState('');

  const { data: deliverables = [] } = useQuery({
    queryKey: ['deliverables', filterGoal],
    queryFn: () => getDeliverables(filterGoal ? { goal_id: filterGoal } : undefined),
  });
  const { data: goals = [] } = useQuery({ queryKey: ['goals'], queryFn: getGoals });
  const { data: tasks = [] } = useQuery<Task[]>({ queryKey: ['tasks'], queryFn: () => import('../lib/api').then(a => a.getTasks()) });
  const { data: topics = [] } = useQuery<Topic[]>({ queryKey: ['topics'], queryFn: getTopics });

  const deleteMutation = useMutation({
    mutationFn: deleteDeliverable,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['deliverables'] }),
  });

  function mimeIcon(mime?: string, type?: string) {
    if (type === 'link') return '🔗';
    if (!mime) return '📄';
    if (mime.startsWith('image/')) return '🖼️';
    if (mime === 'application/pdf') return '📋';
    if (mime.includes('word')) return '📝';
    if (mime.includes('sheet') || mime.includes('excel')) return '📊';
    if (mime.includes('presentation') || mime.includes('powerpoint')) return '📽️';
    if (mime.startsWith('video/')) return '🎬';
    return '📄';
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Deliverables</h1>
          <p className="text-gray-500 mt-1">Track files and links that demonstrate your progress</p>
        </div>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => setShowLink(true)}><LinkIcon size={16} /> Add Link</button>
          <button className="btn-primary" onClick={() => setShowUpload(true)}><Upload size={16} /> Upload File</button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 flex items-center gap-3">
        <Filter size={15} className="text-gray-400" />
        <select className="input w-auto" value={filterGoal} onChange={e => setFilterGoal(e.target.value)}>
          <option value="">All Goals</option>
          {goals.map(g => <option key={g.id} value={g.id}>{g.title}</option>)}
        </select>
        {filterGoal && <button className="text-sm text-blue-600 hover:underline" onClick={() => setFilterGoal('')}>Clear</button>}
        <span className="text-sm text-gray-400 ml-auto">{deliverables.length} item{deliverables.length !== 1 ? 's' : ''}</span>
      </div>

      {deliverables.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-5xl mb-4">📎</div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">No deliverables yet</h3>
          <p className="text-gray-500 mb-6">Upload files or add links to track your outputs and prove progress.</p>
          <div className="flex gap-3 justify-center">
            <button className="btn-secondary" onClick={() => setShowLink(true)}><LinkIcon size={16} /> Add Link</button>
            <button className="btn-primary" onClick={() => setShowUpload(true)}><Upload size={16} /> Upload File</button>
          </div>
        </div>
      ) : (
        <div className="grid gap-3">
          {deliverables.map(d => (
            <div key={d.id} className="card p-5 hover:shadow-sm transition-shadow">
              <div className="flex items-start gap-4">
                <div className="text-3xl flex-shrink-0">{mimeIcon(d.mime_type, d.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold text-gray-900">{d.title}</h3>
                      {d.description && <p className="text-sm text-gray-500 mt-0.5">{d.description}</p>}
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      {d.type === 'file' && (
                        <a href={`/api/deliverables/file/${d.id}`} download className="btn-ghost p-1.5" title="Download">
                          <Download size={15} />
                        </a>
                      )}
                      {d.type === 'link' && d.url && (
                        <a href={d.url} target="_blank" rel="noopener noreferrer" className="btn-ghost p-1.5" title="Open link">
                          <ExternalLink size={15} />
                        </a>
                      )}
                      <button className="btn-ghost p-1.5 text-red-500 hover:bg-red-50"
                        onClick={() => window.confirm('Delete this deliverable?') && deleteMutation.mutate(d.id)}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    <span className="text-xs text-gray-400">{formatDate(d.upload_date)}</span>
                    {d.file_size && <span className="text-xs text-gray-400">· {fileSize(d.file_size)}</span>}
                    {d.include_in_updates === 1 && (
                      <span className="badge bg-blue-50 text-blue-600 text-xs">In Updates</span>
                    )}
                    {d.goals?.map(g => (
                      <span key={g.id} className="badge bg-purple-50 text-purple-700 text-xs">{g.title}</span>
                    ))}
                    {d.topics?.map(t => (
                      <span key={t.id} className="badge text-xs" style={{ backgroundColor: t.color + '20', color: t.color }}>{t.name}</span>
                    ))}
                  </div>
                  {d.tasks && d.tasks.length > 0 && (
                    <div className="mt-1 text-xs text-gray-500">
                      Linked tasks: {d.tasks.map(t => t.title).join(', ')}
                    </div>
                  )}
                  {d.type === 'link' && d.url && (
                    <div className="mt-1 text-xs text-blue-600 truncate">{d.url}</div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={showUpload} onClose={() => setShowUpload(false)} title="Upload Deliverable" size="lg">
        <UploadForm goals={goals} tasks={tasks} topics={topics}
          onSuccess={() => { setShowUpload(false); qc.invalidateQueries({ queryKey: ['deliverables'] }); qc.invalidateQueries({ queryKey: ['tasks'] }); }} />
      </Modal>

      <Modal isOpen={showLink} onClose={() => setShowLink(false)} title="Add Link Deliverable" size="lg">
        <LinkForm goals={goals} tasks={tasks} topics={topics}
          onSuccess={() => { setShowLink(false); qc.invalidateQueries({ queryKey: ['deliverables'] }); qc.invalidateQueries({ queryKey: ['tasks'] }); }} />
      </Modal>
    </div>
  );
}

function UploadForm({ goals, tasks, topics, onSuccess }: {
  goals: Goal[]; tasks: Task[]; topics: Topic[]; onSuccess: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({ title: '', description: '', goal_ids: [] as string[], task_ids: [] as string[], topic_ids: [] as string[], mark_tasks_complete: false, include_in_updates: true });
  const [saving, setSaving] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', form.title || file.name);
      fd.append('description', form.description);
      fd.append('goal_ids', JSON.stringify(form.goal_ids));
      fd.append('task_ids', JSON.stringify(form.task_ids));
      fd.append('topic_ids', JSON.stringify(form.topic_ids));
      fd.append('mark_tasks_complete', String(form.mark_tasks_complete));
      fd.append('include_in_updates', String(form.include_in_updates));
      await uploadDeliverable(fd);
      onSuccess();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div
        className={cn('border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors', dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400')}
        onClick={() => fileRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) { setFile(f); if (!form.title) setForm(p => ({ ...p, title: f.name })); } }}
      >
        <input ref={fileRef} type="file" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); if (!form.title) setForm(p => ({ ...p, title: f.name })); } }} />
        {file ? (
          <div className="text-green-600">
            <div className="text-3xl mb-1">✓</div>
            <div className="font-medium">{file.name}</div>
            <div className="text-sm text-gray-400">{fileSize(file.size)}</div>
          </div>
        ) : (
          <>
            <Upload size={32} className="mx-auto text-gray-400 mb-2" />
            <div className="font-medium text-gray-700">Drop file here or click to browse</div>
            <div className="text-sm text-gray-400 mt-1">Max 50MB</div>
          </>
        )}
      </div>
      <DeliverableFormFields form={form} setForm={setForm} goals={goals} tasks={tasks} topics={topics} showMarkComplete />
      <button type="submit" className="btn-primary w-full" disabled={!file || saving}>
        {saving ? 'Uploading...' : 'Upload Deliverable'}
      </button>
    </form>
  );
}

function LinkForm({ goals, tasks, topics, onSuccess }: {
  goals: Goal[]; tasks: Task[]; topics: Topic[]; onSuccess: () => void;
}) {
  const [url, setUrl] = useState('');
  const [form, setForm] = useState({ title: '', description: '', goal_ids: [] as string[], task_ids: [] as string[], topic_ids: [] as string[], mark_tasks_complete: false, include_in_updates: true });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await createLinkDeliverable({ url, title: form.title || url, description: form.description, goal_ids: form.goal_ids, task_ids: form.task_ids, topic_ids: form.topic_ids, mark_tasks_complete: form.mark_tasks_complete, include_in_updates: form.include_in_updates });
      onSuccess();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">URL *</label>
        <input className="input" required type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." />
      </div>
      <DeliverableFormFields form={form} setForm={setForm} goals={goals} tasks={tasks} topics={topics} showMarkComplete />
      <button type="submit" className="btn-primary w-full" disabled={!url || saving}>
        {saving ? 'Saving...' : 'Add Link'}
      </button>
    </form>
  );
}

function DeliverableFormFields({ form, setForm, goals, tasks, topics, showMarkComplete }: {
  form: { title: string; description: string; goal_ids: string[]; task_ids: string[]; topic_ids: string[]; mark_tasks_complete: boolean; include_in_updates: boolean };
  setForm: React.Dispatch<React.SetStateAction<typeof form>>;
  goals: Goal[]; tasks: Task[]; topics: Topic[];
  showMarkComplete?: boolean;
}) {
  return (
    <>
      <div>
        <label className="label">Title</label>
        <input className="input" value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Deliverable title (optional)" />
      </div>
      <div>
        <label className="label">Description</label>
        <textarea className="input" rows={2} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="What does this deliverable represent?" />
      </div>
      <div>
        <label className="label">Link to Goals</label>
        <div className="space-y-1.5 max-h-32 overflow-y-auto">
          {goals.map(g => (
            <label key={g.id} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.goal_ids.includes(g.id)}
                onChange={e => setForm(p => ({ ...p, goal_ids: e.target.checked ? [...p.goal_ids, g.id] : p.goal_ids.filter(id => id !== g.id) }))} />
              {g.title}
            </label>
          ))}
        </div>
      </div>
      <div>
        <label className="label">Link to Tasks</label>
        <div className="space-y-1.5 max-h-32 overflow-y-auto">
          {tasks.map(t => (
            <label key={t.id} className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.task_ids.includes(t.id)}
                onChange={e => setForm(p => ({ ...p, task_ids: e.target.checked ? [...p.task_ids, t.id] : p.task_ids.filter(id => id !== t.id) }))} />
              {t.title}
            </label>
          ))}
        </div>
      </div>
      {showMarkComplete && form.task_ids.length > 0 && (
        <label className="flex items-center gap-2 text-sm cursor-pointer p-3 bg-green-50 rounded-lg border border-green-100">
          <input type="checkbox" checked={form.mark_tasks_complete}
            onChange={e => setForm(p => ({ ...p, mark_tasks_complete: e.target.checked }))} />
          <span className="font-medium text-green-700">Mark linked tasks as complete</span>
        </label>
      )}
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input type="checkbox" checked={form.include_in_updates}
          onChange={e => setForm(p => ({ ...p, include_in_updates: e.target.checked }))} />
        Include in weekly supervisor updates
      </label>
    </>
  );
}
