import { Router } from 'express';
import { db } from '../db';
import { v4 as uuidv4 } from 'uuid';

export const milestonesRouter = Router();

milestonesRouter.get('/', (req, res) => {
  const { goal_id, type } = req.query;
  let query = `
    SELECT m.*, g.title as goal_title, g.start_date,
      (SELECT COUNT(*) FROM tasks WHERE milestone_id = m.id) as task_count,
      (SELECT COUNT(*) FROM tasks WHERE milestone_id = m.id AND status = 'completed') as completed_task_count,
      COALESCE((SELECT AVG(percent_complete) FROM tasks WHERE milestone_id = m.id), 0) as avg_progress
    FROM milestones m
    JOIN goals g ON g.id = m.goal_id
    WHERE 1=1
  `;
  const params: (string | number)[] = [];
  if (goal_id) { query += ' AND m.goal_id = ?'; params.push(goal_id as string); }
  if (type) { query += ' AND m.type = ?'; params.push(Number(type)); }
  query += ' ORDER BY m.type, m.created_at';
  res.json(db.prepare(query).all(...params));
});

milestonesRouter.post('/', (req, res) => {
  const { goal_id, type, title, description, target_date } = req.body;
  if (!goal_id || !type || !title) return res.status(400).json({ error: 'goal_id, type, title required' });
  const id = uuidv4();
  db.prepare(`INSERT INTO milestones (id, goal_id, type, title, description, target_date) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(id, goal_id, type, title, description || null, target_date || null);
  res.status(201).json(db.prepare('SELECT * FROM milestones WHERE id = ?').get(id));
});

milestonesRouter.put('/:id', (req, res) => {
  const { title, description, target_date, status } = req.body;
  db.prepare(`UPDATE milestones SET title=?, description=?, target_date=?, status=?, updated_at=datetime('now') WHERE id=?`)
    .run(title, description, target_date, status, req.params.id);
  res.json(db.prepare('SELECT * FROM milestones WHERE id = ?').get(req.params.id));
});

milestonesRouter.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM milestones WHERE id = ?').run(req.params.id);
  res.status(204).send();
});
