import { Router } from 'express';
import { supabase } from '../db';
import { v4 as uuidv4 } from 'uuid';

export const goalsRouter = Router();

goalsRouter.get('/', async (req, res) => {
  const { data: goals, error } = await supabase
    .from('goals')
    .select('*, topics(name, color)')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });

  const ids = (goals || []).map(g => g.id);
  const { data: tasks } = await supabase.from('tasks').select('goal_id, status, percent_complete').in('goal_id', ids);
  const { data: milestones } = await supabase.from('milestones').select('goal_id').in('goal_id', ids);

  const result = (goals || []).map(g => {
    const gTasks = (tasks || []).filter(t => t.goal_id === g.id);
    const gMilestones = (milestones || []).filter(m => m.goal_id === g.id);
    const avgProgress = gTasks.length > 0
      ? gTasks.reduce((s, t) => s + t.percent_complete, 0) / gTasks.length
      : 0;
    return {
      ...g,
      topic_name: g.topics?.name ?? null,
      topic_color: g.topics?.color ?? null,
      topics: undefined,
      milestone_count: gMilestones.length,
      task_count: gTasks.length,
      completed_task_count: gTasks.filter(t => t.status === 'completed').length,
      avg_progress: avgProgress,
    };
  });
  res.json(result);
});

goalsRouter.get('/:id', async (req, res) => {
  const { data: goal, error } = await supabase
    .from('goals')
    .select('*, topics(name, color)')
    .eq('id', req.params.id)
    .single();
  if (error || !goal) return res.status(404).json({ error: 'Not found' });

  const [{ data: milestoneRows }, { data: taskRows }] = await Promise.all([
    supabase.from('milestones').select('*').eq('goal_id', req.params.id).order('type'),
    supabase.from('tasks').select('*, milestones(type, title)').eq('goal_id', req.params.id).order('created_at', { ascending: false }),
  ]);

  const allTasks = taskRows || [];

  const milestones = (milestoneRows || []).map(m => {
    const mTasks = allTasks.filter(t => t.milestone_id === m.id);
    const avgProgress = mTasks.length > 0
      ? mTasks.reduce((s, t) => s + t.percent_complete, 0) / mTasks.length
      : 0;
    return {
      ...m,
      task_count: mTasks.length,
      completed_task_count: mTasks.filter(t => t.status === 'completed').length,
      avg_progress: avgProgress,
    };
  });

  const tasks = allTasks.map(t => ({
    ...t,
    milestone_type: t.milestones?.type ?? null,
    milestone_title: t.milestones?.title ?? null,
    milestones: undefined,
  }));

  res.json({
    ...goal,
    topic_name: goal.topics?.name ?? null,
    topic_color: goal.topics?.color ?? null,
    topics: undefined,
    milestones,
    tasks,
  });
});

goalsRouter.post('/', async (req, res) => {
  const { title, description, topic_id, success_criteria, start_date, target_end_date } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  const id = uuidv4();
  const { data, error } = await supabase
    .from('goals')
    .insert({
      id,
      title,
      description: description || null,
      topic_id: topic_id || null,
      success_criteria: success_criteria || null,
      start_date: start_date || new Date().toISOString().split('T')[0],
      target_end_date: target_end_date || null,
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

goalsRouter.put('/:id', async (req, res) => {
  const { title, description, topic_id, success_criteria, start_date, target_end_date, status } = req.body;
  const { data, error } = await supabase
    .from('goals')
    .update({
      title,
      description,
      topic_id,
      success_criteria,
      start_date,
      target_end_date,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

goalsRouter.delete('/:id', async (req, res) => {
  const { error } = await supabase.from('goals').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});
