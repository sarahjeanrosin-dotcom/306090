import { Router } from 'express';
import { db } from '../db';
import { v4 as uuidv4 } from 'uuid';

export const goalsRouter = Router();

goalsRouter.get('/', (req, res) => {
  const goals = db.prepare(`
    SELECT g.*, t.name as topic_name, t.color as topic_color,
      (SELECT COUNT(*) FROM milestones WHERE goal_id = g.id) as milestone_count,
      (SELECT COUNT(*) FROM tasks WHERE goal_id = g.id) as task_count,
      (SELECT COUNT(*) FROM tasks WHERE goal_id = g.id AND status = 'completed') as completed_task_count,
      COALESCE((SELECT AVG(percent_complete) FROM tasks WHERE goal_id = g.id), 0) as avg_progress
    FROM goals g
    LEFT JOIN topics t ON t.id = g.topic_id
    ORDER BY g.created_at DESC
  `).all();
  res.json(goals);
});

goalsRouter.get('/:id', (req, res) => {
  const goal = db.prepare(`
    SELECT g.*, t.name as topic_name, t.color as topic_color
    FROM goals g LEFT JOIN topics t ON t.id = g.topic_id
    WHERE g.id = ?
  `).get(req.params.id);
  if (!goal) return res.status(404).json({ error: 'Not found' });

  const milestones = db.prepare(`
    SELECT m.*,
      (SELECT COUNT(*) FROM tasks WHERE milestone_id = m.id) as task_count,
      (SELECT COUNT(*) FROM tasks WHERE milestone_id = m.id AND status = 'completed') as completed_task_count,
      COALESCE((SELECT AVG(percent_complete) FROM tasks WHERE milestone_id = m.id), 0) as avg_progress
    FROM milestones m WHERE m.goal_id = ? ORDER BY m.type
  `).all(req.params.id);

  const tasks = db.prepare(`
    SELECT t.*, m.type as milestone_type, m.title as milestone_title
    FROM tasks t
    LEFT JOIN milestones m ON m.id = t.milestone_id
    WHERE t.goal_id = ?
    ORDER BY t.created_at DESC
  `).all(req.params.id);

  res.json({ ...goal as object, milestones, tasks });
});

goalsRouter.post('/', (req, res) => {
  const { title, description, topic_id, success_criteria, start_date, target_end_date } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  const id = uuidv4();
  db.prepare(`
    INSERT INTO goals (id, title, description, topic_id, success_criteria, start_date, target_end_date)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, title, description || null, topic_id || null, success_criteria || null,
    start_date || new Date().toISOString().split('T')[0], target_end_date || null);
  res.status(201).json(db.prepare('SELECT * FROM goals WHERE id = ?').get(id));
});

goalsRouter.put('/:id', (req, res) => {
  const { title, description, topic_id, success_criteria, start_date, target_end_date, status } = req.body;
  db.prepare(`
    UPDATE goals SET title = ?, description = ?, topic_id = ?, success_criteria = ?,
      start_date = ?, target_end_date = ?, status = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(title, description, topic_id, success_criteria, start_date, target_end_date, status, req.params.id);
  res.json(db.prepare('SELECT * FROM goals WHERE id = ?').get(req.params.id));
});

goalsRouter.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM goals WHERE id = ?').run(req.params.id);
  res.status(204).send();
});
