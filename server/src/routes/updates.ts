import { Router } from 'express';
import { supabase } from '../db';
import { v4 as uuidv4 } from 'uuid';

export const updatesRouter = Router();

updatesRouter.get('/', async (req, res) => {
  const { data, error } = await supabase
    .from('weekly_updates')
    .select('*')
    .order('week_start', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

updatesRouter.get('/:id', async (req, res) => {
  const { data, error } = await supabase
    .from('weekly_updates')
    .select('*')
    .eq('id', req.params.id)
    .single();
  if (error || !data) return res.status(404).json({ error: 'Not found' });
  res.json(data);
});

updatesRouter.post('/', async (req, res) => {
  const { week_start, week_end, content, edited_content } = req.body;
  if (!week_start || !week_end || !content) {
    return res.status(400).json({ error: 'week_start, week_end, content required' });
  }
  const id = uuidv4();
  const { data, error } = await supabase
    .from('weekly_updates')
    .insert({ id, week_start, week_end, content, edited_content: edited_content || null })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

updatesRouter.put('/:id', async (req, res) => {
  const { edited_content, content } = req.body;
  const { data, error } = await supabase
    .from('weekly_updates')
    .update({ edited_content, content, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

updatesRouter.delete('/:id', async (req, res) => {
  const { error } = await supabase.from('weekly_updates').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

// Get context data for a given week range
updatesRouter.get('/context/:weekStart/:weekEnd', async (req, res) => {
  const { weekStart, weekEnd } = req.params;
  const weekEndFull = weekEnd + 'T23:59:59';

  const [
    { data: completedTasksRaw },
    { data: deliverablesRaw },
    { data: blockersRaw },
    { data: goalsRaw },
  ] = await Promise.all([
    supabase
      .from('tasks')
      .select('*, goals(title), milestones(title, type)')
      .gte('completed_at', weekStart)
      .lte('completed_at', weekEndFull)
      .order('completed_at', { ascending: false }),
    supabase
      .from('deliverables')
      .select('*')
      .gte('upload_date', weekStart)
      .lte('upload_date', weekEndFull)
      .eq('include_in_updates', true)
      .order('upload_date', { ascending: false }),
    supabase
      .from('tasks')
      .select('*, goals(title)')
      .or('status.eq.blocked,and(blockers.not.is.null,blockers.neq.)')
      .neq('status', 'completed'),
    supabase
      .from('goals')
      .select('*, topics(name)')
      .eq('status', 'active')
      .order('created_at'),
  ]);

  const completedTasks = (completedTasksRaw || []).map(t => ({
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

  // Fetch task stats for goals
  const goalIds = (goalsRaw || []).map(g => g.id);
  const { data: goalTasks } = goalIds.length
    ? await supabase.from('tasks').select('goal_id, status, percent_complete').in('goal_id', goalIds)
    : { data: [] };

  const goals = (goalsRaw || []).map(g => {
    const gTasks = (goalTasks || []).filter(t => t.goal_id === g.id);
    const avgProgress = gTasks.length > 0
      ? gTasks.reduce((s, t) => s + t.percent_complete, 0) / gTasks.length
      : 0;
    return {
      ...g,
      topic_name: (g.topics as Record<string, unknown> | null)?.name ?? null,
      topics: undefined,
      avg_progress: avgProgress,
      task_count: gTasks.length,
      completed_tasks: gTasks.filter(t => t.status === 'completed').length,
    };
  });

  res.json({ completedTasks, deliverables: deliverablesRaw || [], blockers, goals });
});
