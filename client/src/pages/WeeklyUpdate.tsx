import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sparkles, Copy, Check, Trash2, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import { getUpdates, createUpdate, updateUpdate, deleteUpdate, getWeekContext } from '../lib/api';
import type { WeeklyUpdate, AIWeeklyUpdate } from '../types';
import { formatDate, getCurrentWeek, copyToClipboard } from '../lib/utils';

export default function WeeklyUpdatePage() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<'generate' | 'history'>('generate');

  const { data: updates = [] } = useQuery({ queryKey: ['updates'], queryFn: getUpdates });
  const deleteMutation = useMutation({ mutationFn: deleteUpdate, onSuccess: () => qc.invalidateQueries({ queryKey: ['updates'] }) });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Weekly Update Generator</h1>
        <p className="text-gray-500 mt-1">Generate and manage your Friday progress updates for your supervisor</p>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        {(['generate', 'history'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {tab === 'generate' ? '✨ Generate Update' : `📋 History (${updates.length})`}
          </button>
        ))}
      </div>

      {activeTab === 'generate' && <GenerateUpdate onSave={() => { setActiveTab('history'); qc.invalidateQueries({ queryKey: ['updates'] }); }} />}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {updates.length === 0 ? (
            <div className="card p-12 text-center">
              <div className="text-4xl mb-3">📋</div>
              <p className="text-gray-500">No saved updates yet. Generate your first update above.</p>
            </div>
          ) : (
            updates.map(u => <UpdateCard key={u.id} update={u} onDelete={() => deleteMutation.mutate(u.id)} onUpdate={() => qc.invalidateQueries({ queryKey: ['updates'] })} />)
          )}
        </div>
      )}
    </div>
  );
}

function GenerateUpdate({ onSave }: { onSave: () => void }) {
  const qc = useQueryClient();
  const week = getCurrentWeek();
  const [weekStart, setWeekStart] = useState(week.weekStart);
  const [weekEnd, setWeekEnd] = useState(week.weekEnd);
  const [generating, setGenerating] = useState(false);
  const [streaming, setStreaming] = useState('');
  const [result, setResult] = useState<AIWeeklyUpdate | null>(null);
  const [edited, setEdited] = useState('');
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  async function generate() {
    setGenerating(true);
    setStreaming('');
    setResult(null);
    try {
      const ctx = await getWeekContext(weekStart, weekEnd);
      const resp = await fetch('/api/ai/summarize-week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStart, weekEnd, ...ctx }),
      });

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split('\n').filter(l => l.startsWith('data: '))) {
          const evt = JSON.parse(line.slice(6));
          if (evt.type === 'text') setStreaming(p => p + evt.text);
          if (evt.type === 'complete' && evt.data) {
            setResult(evt.data);
            setEdited(evt.data.full_email || '');
          }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopy() {
    await copyToClipboard(edited || result?.full_email || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleSave() {
    if (!result) return;
    setSaving(true);
    try {
      await createUpdate({
        week_start: weekStart,
        week_end: weekEnd,
        content: result.full_email,
        edited_content: edited !== result.full_email ? edited : undefined,
      });
      onSave();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Week picker */}
      <div className="card p-5">
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Calendar size={18} className="text-blue-600" /> Select Week
        </h3>
        <div className="flex items-center gap-3">
          <div>
            <label className="label text-xs">Week Start</label>
            <input type="date" className="input" value={weekStart} onChange={e => setWeekStart(e.target.value)} />
          </div>
          <span className="text-gray-400 mt-5">→</span>
          <div>
            <label className="label text-xs">Week End</label>
            <input type="date" className="input" value={weekEnd} onChange={e => setWeekEnd(e.target.value)} />
          </div>
          <div className="mt-5">
            <button className="btn-primary" onClick={generate} disabled={generating}>
              {generating ? <><span className="animate-spin inline-block">⟳</span> Generating...</> : <><Sparkles size={16} /> Generate Update</>}
            </button>
          </div>
        </div>
      </div>

      {/* Streaming preview */}
      {generating && streaming && (
        <div className="card p-5">
          <div className="text-sm font-medium text-blue-600 mb-2 flex items-center gap-2">
            <span className="animate-pulse">●</span> AI is drafting your update...
          </div>
          <pre className="text-xs text-gray-600 whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">{streaming}</pre>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-4">
          {/* Sections */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SectionCard title="✅ Accomplishments" content={result.sections.accomplishments} />
            <SectionCard title="📎 Deliverables" content={result.sections.deliverables} />
            <SectionCard title="📈 Goal Progress" content={result.sections.progress} />
            <SectionCard title="🚧 Blockers" content={result.sections.blockers} />
            <SectionCard title="🎯 Next Week Focus" content={result.sections.next_week} className="md:col-span-2" />
          </div>

          {/* Full email editor */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Full Email Draft</h3>
              <div className="flex gap-2">
                <button className="btn-secondary text-sm" onClick={handleCopy}>
                  {copied ? <><Check size={15} /> Copied!</> : <><Copy size={15} /> Copy</>}
                </button>
                <button className="btn-primary text-sm" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : '💾 Save Update'}
                </button>
              </div>
            </div>
            <div className="text-xs text-gray-500 mb-2">Subject: {result.subject}</div>
            <textarea
              className="input font-mono text-sm"
              rows={16}
              value={edited}
              onChange={e => setEdited(e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function SectionCard({ title, content, className }: { title: string; content: string; className?: string }) {
  return (
    <div className={`card p-4 ${className || ''}`}>
      <div className="font-medium text-gray-800 mb-2 text-sm">{title}</div>
      <div className="text-sm text-gray-600 whitespace-pre-line">{content}</div>
    </div>
  );
}

function UpdateCard({ update, onDelete, onUpdate }: { update: WeeklyUpdate; onDelete: () => void; onUpdate: () => void }) {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(update.edited_content || update.content);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);

  const displayContent = update.edited_content || update.content;

  async function handleSave() {
    setSaving(true);
    try {
      await updateUpdate(update.id, { edited_content: editedContent, content: update.content });
      onUpdate();
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold text-gray-900">
            Week of {formatDate(update.week_start)} – {formatDate(update.week_end)}
          </div>
          <div className="text-xs text-gray-400 mt-0.5">Generated {formatDate(update.generated_at, 'MMM d, yyyy h:mm a')}</div>
        </div>
        <div className="flex gap-2">
          <button className="btn-ghost p-2 text-sm" onClick={async () => { await copyToClipboard(displayContent); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
            {copied ? <Check size={16} className="text-green-600" /> : <Copy size={16} />}
          </button>
          <button className="btn-ghost p-2 text-red-500 hover:bg-red-50" onClick={() => window.confirm('Delete?') && onDelete()}>
            <Trash2 size={16} />
          </button>
          <button className="btn-ghost p-2" onClick={() => setExpanded(e => !e)}>
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          {editing ? (
            <div>
              <textarea className="input font-mono text-sm" rows={14} value={editedContent} onChange={e => setEditedContent(e.target.value)} />
              <div className="flex gap-2 mt-3">
                <button className="btn-primary text-sm" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
                <button className="btn-secondary text-sm" onClick={() => { setEditing(false); setEditedContent(update.edited_content || update.content); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <div>
              <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans">{displayContent}</pre>
              <button className="btn-secondary text-sm mt-3" onClick={() => setEditing(true)}>✏️ Edit</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
