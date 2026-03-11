import { Router } from 'express';
import { supabase } from '../db';

export const dashboardRouter = Router();

dashboardRouter.get('/', async (req, res) => {
  const [
    { data: goalsRaw },
    { data: allTasks },
    { data: allMilestones },
    { data: allTopics },
    { data: recentDeliverables },
    { data: recentCompletedTasksRaw },
    { data: blockersRaw },
  ] = await Promise.all([
    supabase.from('goals').select('*, topics(name, color)').eq('status', 'active').order('created_at'),
    supabase.from('tasks').select('goal_id, milestone_id, status, percent_complete, completed_at, updated_at, title, milestones(type, title)'),
    supabase.from('milestones').select('goal_id, type, status, id'),
    supabase.from('topics').select('id, name, color'),
    supabase.from('deliverables').select('*').order('upload_date', { ascending: false }).limit(10),
    supabase.from('tasks').select('*, goals(title), milestones(title, type)').eq('status', 'completed').order('completed_at', { ascending: false }).limit(10),
    supabase.from('tasks').select('*, goals(title)').or('status.eq.blocked,and(blockers.not.is.null,blockers.neq.)').neq('status', 'completed').order('updated_at', { ascending: false }),
  ]);

  const goals = (goalsRaw || []).map(g => {
    const gTasks = (allTasks || []).filter(t => t.goal_id === g.id);
    const gMilestones = (allMilestones || []).filter(m => m.goal_id === g.id);
    const avgProgress = gTasks.length > 0
      ? gTasks.reduce((s, t) => s + t.percent_complete, 0) / gTasks.length
      : 0;
    return {
      ...g,
      topic_name: (g.topics as Record<string, unknown> | null)?.name ?? null,
      topic_color: (g.topics as Record<string, unknown> | null)?.color ?? null,
      topics: undefined,
      avg_progress: avgProgress,
      task_count: gTasks.length,
      completed_tasks: gTasks.filter(t => t.status === 'completed').length,
      milestone_count: gMilestones.length,
      completed_milestones: gMilestones.filter(m => m.status === 'completed').length,
    };
  });

  const overallProgress = goals.length > 0
    ? goals.reduce((s, g) => s + g.avg_progress, 0) / goals.length
    : 0;

  // Milestone progress by type (30/60/90)
  const activeGoalIds = goals.map(g => g.id);
  const activeMilestones = (allMilestones || []).filter(m => activeGoalIds.includes(m.goal_id));
  const milestoneProgressMap: Record<number, { type: number; total: number; completed: number; progress_sum: number }> = {};
  for (const m of activeMilestones) {
    if (!milestoneProgressMap[m.type]) {
      milestoneProgressMap[m.type] = { type: m.type, total: 0, completed: 0, progress_sum: 0 };
    }
    milestoneProgressMap[m.type].total++;
    if (m.status === 'completed') milestoneProgressMap[m.type].completed++;
    const mTasks = (allTasks || []).filter(t => t.milestone_id === m.id);
    const avg = mTasks.length > 0 ? mTasks.reduce((s, t) => s + t.percent_complete, 0) / mTasks.length : 0;
    milestoneProgressMap[m.type].progress_sum += avg;
  }
  const milestoneProgress = Object.values(milestoneProgressMap)
    .sort((a, b) => a.type - b.type)
    .map(m => ({ ...m, avg_progress: m.total > 0 ? m.progress_sum / m.total : 0, progress_sum: undefined }));

  // Topic progress
  const topicProgress = (allTopics || []).map(t => {
    const tGoals = goals.filter(g => (g as Record<string, unknown>).topic_id === t.id);
    const avgProgress = tGoals.length > 0
      ? tGoals.reduce((s, g) => s + g.avg_progress, 0) / tGoals.length
      : 0;
    return { id: t.id, name: t.name, color: t.color, goal_count: tGoals.length, avg_progress: avgProgress };
  }).filter(t => t.goal_count > 0).sort((a, b) => a.name.localeCompare(b.name));

  const recentCompletedTasks = (recentCompletedTasksRaw || []).map(t => ({
    ...t,
    goal_title: (t.goals as Record<string, unknown> | null)?.title ?? null,
    goals: undefined,
    milestone_title: (t.milestones as Record<string, unknown> | null)?.title ?? null,
    milestone_type: (t.milestones as Record<string, unknown> | null)?.type ?? null,
    milestones: undefined,
  }));

  const blockers = (blockersRaw || []).map(t => ({
    ...t,
    goal_title: (t.goals as Record<string, unknown> | null)?.title ?? null,
    goals: undefined,
  }));

  // Stats
  const allTasksAll = allTasks || [];
  const allMilestonesAll = allMilestones || [];
  const { count: totalDeliverables } = await supabase.from('deliverables').select('*', { count: 'exact', head: true });
  const { count: activeGoals } = await supabase.from('goals').select('*', { count: 'exact', head: true }).eq('status', 'active');

  const stats = {
    active_goals: activeGoals ?? 0,
    open_tasks: allTasksAll.filter(t => t.status !== 'completed').length,
    completed_tasks: allTasksAll.filter(t => t.status === 'completed').length,
    total_deliverables: totalDeliverables ?? 0,
    blocked_tasks: allTasksAll.filter(t => t.status === 'blocked').length,
    completed_milestones: allMilestonesAll.filter(m => m.status === 'completed').length,
    total_milestones: allMilestonesAll.length,
  };

  res.json({ overallProgress, goals, milestoneProgress, topicProgress, recentDeliverables, recentCompletedTasks, blockers, stats });
});
