import { Router } from 'express';
import { supabase } from '../db';
import { v4 as uuidv4 } from 'uuid';

export const milestonesRouter = Router();

milestonesRouter.get('/', async (req, res) => {
  const { goal_id, type } = req.query;

  let query = supabase
    .from('milestones')
    .select('*, goals(title, start_date)')
    .order('type')
    .order('created_at');

  if (goal_id) query = query.eq('goal_id', goal_id as string);
  if (type) query = query.eq('type', Number(type));

  const { data: milestones, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  const ids = (milestones || []).map(m => m.id);
  const { data: tasks } = ids.length
    ? await supabase.from('tasks').select('milestone_id, status, percent_complete').in('milestone_id', ids)
    : { data: [] };

  const result = (milestones || []).map(m => {
    const mTasks = (tasks || []).filter(t => t.milestone_id === m.id);
    const avgProgress = mTasks.length > 0
      ? mTasks.reduce((s, t) => s + t.percent_complete, 0) / mTasks.length
      : 0;
    const goals = m.goals as Record<string, unknown> | null;
    return {
      ...m,
      goal_title: goals?.title ?? null,
      start_date: goals?.start_date ?? null,
      goals: undefined,
      task_count: mTasks.length,
      completed_task_count: mTasks.filter(t => t.status === 'completed').length,
      avg_progress: avgProgress,
    };
  });
  res.json(result);
});

milestonesRouter.post('/', async (req, res) => {
  const { goal_id, type, title, description, target_date } = req.body;
  if (!goal_id || !type || !title) return res.status(400).json({ error: 'goal_id, type, title required' });
  const id = uuidv4();
  const { data, error } = await supabase
    .from('milestones')
    .insert({ id, goal_id, type, title, description: description || null, target_date: target_date || null })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

milestonesRouter.put('/:id', async (req, res) => {
  const { title, description, target_date, status } = req.body;
  const { data, error } = await supabase
    .from('milestones')
    .update({ title, description, target_date, status, updated_at: new Date().toISOString() })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

milestonesRouter.delete('/:id', async (req, res) => {
  const { error } = await supabase.from('milestones').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});
