import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Target, CheckSquare, Paperclip, AlertTriangle, TrendingUp, Award, Clock } from 'lucide-react';
import { getDashboard } from '../lib/api';
import { formatDate, statusColor, statusLabel, milestoneLabel } from '../lib/utils';
import ProgressBar from '../components/ProgressBar';

export default function Dashboard() {
  const { data, isLoading } = useQuery({ queryKey: ['dashboard'], queryFn: getDashboard });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#2C3E8F]" />
      </div>
    );
  }

  const d = data!;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">Your 30/60/90 day progress at a glance</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Target} label="Active Goals" value={d.stats.active_goals} color="blue" />
        <StatCard icon={CheckSquare} label="Tasks Done" value={d.stats.completed_tasks} color="green" />
        <StatCard icon={Paperclip} label="Deliverables" value={d.stats.total_deliverables} color="purple" />
        <StatCard icon={AlertTriangle} label="Blockers" value={d.stats.blocked_tasks} color="red" />
      </div>

      {/* Overall progress */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <TrendingUp size={20} className="text-[#2C3E8F]" />
            Overall 90-Day Progress
          </h2>
          <span className="text-3xl font-bold text-[#2C3E8F]">{Math.round(d.overallProgress)}%</span>
        </div>
        <ProgressBar value={d.overallProgress} size="lg" showLabel={false} />
        <div className="mt-3 text-sm text-gray-500">
          {d.stats.completed_milestones} of {d.stats.total_milestones} milestones completed
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Milestone progress */}
        <div className="card p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Award size={18} className="text-[#2C3E8F]" />
            Progress by Milestone
          </h2>
          {[30, 60, 90].map(type => {
            const mp = d.milestoneProgress.find(m => m.type === type);
            return (
              <div key={type} className="mb-4">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-sm font-medium text-gray-700">{milestoneLabel(type)} Milestone</span>
                  <span className="text-xs text-gray-500">
                    {mp?.completed || 0}/{mp?.total || 0} complete
                  </span>
                </div>
                <ProgressBar value={mp?.avg_progress || 0} showLabel size="md" />
              </div>
            );
          })}
        </div>

        {/* Topic progress */}
        <div className="card p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Progress by Topic</h2>
          {d.topicProgress.length === 0 ? (
            <p className="text-sm text-gray-400">No topics with goals yet.</p>
          ) : (
            d.topicProgress.map(t => (
              <div key={t.id} className="mb-4">
                <div className="flex justify-between items-center mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                    <span className="text-sm font-medium text-gray-700">{t.name}</span>
                    <span className="text-xs text-gray-400">({t.goal_count} goal{t.goal_count !== 1 ? 's' : ''})</span>
                  </div>
                  <span className="text-xs font-medium text-gray-600">{Math.round(t.avg_progress)}%</span>
                </div>
                <ProgressBar value={t.avg_progress} size="sm" color={undefined} />
              </div>
            ))
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Goals */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">Active Goals</h2>
            <Link to="/goals" className="text-sm text-[#2C3E8F] hover:underline">View all</Link>
          </div>
          {d.goals.length === 0 ? (
            <div className="text-center py-8">
              <Target size={32} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-500">No goals yet.</p>
              <Link to="/goals" className="btn-primary btn mt-3 text-xs">Add your first goal</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {d.goals.slice(0, 5).map(g => (
                <Link key={g.id} to={`/goals/${g.id}`} className="block p-3 rounded-lg border border-gray-100 hover:border-[#2C3E8F]/20 hover:bg-[#2C3E8F]/5 transition-colors">
                  <div className="flex justify-between items-start mb-1">
                    <span className="text-sm font-medium text-gray-800">{g.title}</span>
                    <span className="text-xs font-semibold text-[#2C3E8F] ml-2">{Math.round(g.avg_progress || 0)}%</span>
                  </div>
                  {g.topic_name && (
                    <span className="badge" style={{ backgroundColor: g.topic_color + '20', color: g.topic_color }}>
                      {g.topic_name}
                    </span>
                  )}
                  <ProgressBar value={g.avg_progress || 0} size="sm" className="mt-2" />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Blockers */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
              <AlertTriangle size={18} className="text-red-500" />
              Blockers & Risks
            </h2>
            <Link to="/tasks?status=blocked" className="text-sm text-[#2C3E8F] hover:underline">View all</Link>
          </div>
          {d.blockers.length === 0 ? (
            <p className="text-sm text-green-600 flex items-center gap-2">
              <span>✓</span> No blockers — great work!
            </p>
          ) : (
            <div className="space-y-3">
              {d.blockers.map(t => (
                <div key={t.id} className="p-3 rounded-lg bg-red-50 border border-red-100">
                  <div className="text-sm font-medium text-gray-800">{t.title}</div>
                  {t.goal_title && <div className="text-xs text-gray-500 mt-0.5">Goal: {t.goal_title}</div>}
                  {t.blockers && <div className="text-xs text-red-600 mt-1">{t.blockers}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent completed tasks */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">Recently Completed</h2>
            <Link to="/tasks?status=completed" className="text-sm text-[#2C3E8F] hover:underline">View all</Link>
          </div>
          {d.recentCompletedTasks.length === 0 ? (
            <p className="text-sm text-gray-400">No completed tasks yet. Get to work!</p>
          ) : (
            <div className="space-y-2">
              {d.recentCompletedTasks.slice(0, 6).map(t => (
                <div key={t.id} className="flex items-start gap-2 text-sm">
                  <span className="text-green-500 mt-0.5">✓</span>
                  <div>
                    <div className="text-gray-800">{t.title}</div>
                    <div className="text-xs text-gray-400">{t.goal_title || 'No goal'} · {formatDate(t.completed_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent deliverables */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">Recent Deliverables</h2>
            <Link to="/deliverables" className="text-sm text-[#2C3E8F] hover:underline">View all</Link>
          </div>
          {d.recentDeliverables.length === 0 ? (
            <div className="text-center py-6">
              <Paperclip size={28} className="mx-auto text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">No deliverables yet.</p>
              <Link to="/deliverables" className="btn-primary btn mt-3 text-xs">Upload a deliverable</Link>
            </div>
          ) : (
            <div className="space-y-2">
              {d.recentDeliverables.slice(0, 6).map(d => (
                <Link key={d.id} to="/deliverables" className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 transition-colors">
                  <span className="text-lg">{d.type === 'file' ? '📄' : '🔗'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800 truncate">{d.title}</div>
                    <div className="text-xs text-gray-400">{formatDate(d.upload_date)}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-[#2C3E8F]/10 text-[#2C3E8F]',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    red: 'bg-red-50 text-red-600',
  };
  return (
    <div className="card p-5">
      <div className={`w-10 h-10 rounded-lg ${colors[color]} flex items-center justify-center mb-3`}>
        <Icon size={20} />
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-500 mt-0.5">{label}</div>
    </div>
  );
}
