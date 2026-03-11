import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Check, X } from 'lucide-react';
import { getTopics, createTopic, updateTopic, deleteTopic } from '../lib/api';
import type { Topic } from '../types';

const COLORS = [
  '#2C3E8F', '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6', '#0ea5e9',
];

export default function Settings() {
  const qc = useQueryClient();
  const { data: topics = [] } = useQuery({ queryKey: ['topics'], queryFn: getTopics });
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: deleteTopic,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['topics'] }),
  });

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 mt-1">Manage topics and categories for your goals</p>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">Topics</h2>
          <button className="btn-primary text-sm" onClick={() => { setShowAdd(true); setEditingId(null); }}>
            <Plus size={15} /> Add Topic
          </button>
        </div>

        {showAdd && (
          <div className="mb-4">
            <TopicForm
              onSuccess={() => { setShowAdd(false); qc.invalidateQueries({ queryKey: ['topics'] }); }}
              onCancel={() => setShowAdd(false)}
            />
          </div>
        )}

        {topics.length === 0 && !showAdd ? (
          <p className="text-sm text-gray-400 italic">No topics yet. Add one above.</p>
        ) : (
          <div className="space-y-2">
            {topics.map(topic => (
              <div key={topic.id}>
                {editingId === topic.id ? (
                  <TopicForm
                    topic={topic}
                    onSuccess={() => { setEditingId(null); qc.invalidateQueries({ queryKey: ['topics'] }); }}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50">
                    <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: topic.color }} />
                    <span className="flex-1 text-sm font-medium text-gray-800">{topic.name}</span>
                    {topic.description && (
                      <span className="text-xs text-gray-400 flex-shrink-0 max-w-[200px] truncate">{topic.description}</span>
                    )}
                    <button className="btn-ghost p-1.5" onClick={() => setEditingId(topic.id)}>
                      <Edit2 size={14} />
                    </button>
                    <button
                      className="btn-ghost p-1.5 text-red-500 hover:bg-red-50"
                      onClick={() => window.confirm(`Delete "${topic.name}"?`) && deleteMutation.mutate(topic.id)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TopicForm({ topic, onSuccess, onCancel }: { topic?: Topic; onSuccess: () => void; onCancel: () => void }) {
  const [name, setName] = useState(topic?.name || '');
  const [color, setColor] = useState(topic?.color || COLORS[0]);
  const [description, setDescription] = useState(topic?.description || '');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (topic) await updateTopic(topic.id, { name, color, description });
      else await createTopic({ name, color, description });
      onSuccess();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="p-3 rounded-lg border border-indigo-100 bg-indigo-50/30 space-y-3">
      <div className="flex gap-2">
        <input
          className="input flex-1"
          placeholder="Topic name"
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus
          required
        />
        <input
          className="input w-40"
          placeholder="Description (optional)"
          value={description}
          onChange={e => setDescription(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 font-medium">Color:</span>
        {COLORS.map(c => (
          <button
            key={c}
            type="button"
            className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
            style={{ backgroundColor: c, borderColor: color === c ? '#1e293b' : 'transparent' }}
            onClick={() => setColor(c)}
          />
        ))}
        <input
          type="color"
          value={color}
          onChange={e => setColor(e.target.value)}
          className="w-6 h-6 rounded cursor-pointer border border-gray-300"
          title="Custom color"
        />
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn-primary text-sm py-1.5" disabled={!name.trim() || saving}>
          <Check size={14} /> {saving ? 'Saving...' : topic ? 'Save' : 'Add Topic'}
        </button>
        <button type="button" className="btn-secondary text-sm py-1.5" onClick={onCancel}>
          <X size={14} /> Cancel
        </button>
      </div>
    </form>
  );
}
