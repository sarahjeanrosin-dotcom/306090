import { Router } from 'express';
import { supabase } from '../db';
import { v4 as uuidv4 } from 'uuid';

export const tasksRouter = Router();

tasksRouter.get('/', async (req, res) => {
  const { goal_id, milestone_id, status } = req.query;

  let query = supabase
    .from('tasks')
    .select('*, goals(title), milestones(title, type)')
    .order('updated_at', { ascending: false });

  if (goal_id) query = query.eq('goal_id', goal_id as string);
  if (milestone_id) query = query.eq('milestone_id', milestone_id as string);
  if (status) query = query.eq('status', status as string);

  const { data: tasks, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  const result = (tasks || []).map(t => ({
    ...t,
    goal_title: (t.goals as Record<string, unknown> | null)?.title ?? null,
    goals: undefined,
    milestone_title: (t.milestones as Record<string, unknown> | null)?.title ?? null,
    milestone_type: (t.milestones as Record<string, unknown> | null)?.type ?? null,
    milestones: undefined,
  }));
  res.json(result);
});

tasksRouter.get('/blockers', async (req, res) => {
  const { data: tasks, error } = await supabase
    .from('tasks')
    .select('*, goals(title), milestones(title, type)')
    .or('status.eq.blocked,and(blockers.not.is.null,blockers.neq.)')
    .order('updated_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });

  const result = (tasks || []).map(t => ({
    ...t,
    goal_title: (t.goals as Record<string, unknown> | null)?.title ?? null,
    goals: undefined,
    milestone_title: (t.milestones as Record<string, unknown> | null)?.title ?? null,
    milestone_type: (t.milestones as Record<string, unknown> | null)?.type ?? null,
    milestones: undefined,
  }));
  res.json(result);
});

tasksRouter.post('/', async (req, res) => {
  const { goal_id, milestone_id, title, description, status, percent_complete, notes, blockers, due_date } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  const id = uuidv4();
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      id,
      goal_id: goal_id || null,
      milestone_id: milestone_id || null,
      title,
      description: description || null,
      status: status || 'todo',
      percent_complete: percent_complete || 0,
      notes: notes || null,
      blockers: blockers || null,
      due_date: due_date || null,
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

tasksRouter.put('/:id', async (req, res) => {
  const { goal_id, milestone_id, title, description, status, percent_complete, notes, blockers, due_date } = req.body;

  // Fetch current task to decide completed_at
  const { data: current } = await supabase.from('tasks').select('status, completed_at').eq('id', req.params.id).single();
  const completed_at = status === 'completed'
    ? (current?.completed_at || new Date().toISOString())
    : null;

  const { data, error } = await supabase
    .from('tasks')
    .update({
      goal_id,
      milestone_id,
      title,
      description,
      status,
      percent_complete,
      notes,
      blockers,
      due_date,
      completed_at,
      updated_at: new Date().toISOString(),
    })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

tasksRouter.delete('/:id', async (req, res) => {
  const { error } = await supabase.from('tasks').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});
