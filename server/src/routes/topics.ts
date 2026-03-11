import { Router } from 'express';
import { supabase } from '../db';
import { v4 as uuidv4 } from 'uuid';

export const topicsRouter = Router();

topicsRouter.get('/', async (req, res) => {
  const { data: topics, error } = await supabase
    .from('topics')
    .select('*, goals(id)')
    .order('name');
  if (error) return res.status(500).json({ error: error.message });

  // Add goal_count to match original shape
  const result = (topics || []).map(t => ({
    ...t,
    goal_count: Array.isArray(t.goals) ? t.goals.length : 0,
    goals: undefined,
  }));
  res.json(result);
});

topicsRouter.post('/', async (req, res) => {
  const { name, color, description } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const id = uuidv4();
  const { data, error } = await supabase
    .from('topics')
    .insert({ id, name, color: color || '#6366f1', description: description || null })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

topicsRouter.put('/:id', async (req, res) => {
  const { name, color, description } = req.body;
  const { data, error } = await supabase
    .from('topics')
    .update({ name, color, description })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

topicsRouter.delete('/:id', async (req, res) => {
  const { error } = await supabase.from('topics').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});
