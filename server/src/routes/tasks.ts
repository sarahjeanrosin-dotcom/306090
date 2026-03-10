import { Router } from 'express';
import { db } from '../db';
import { v4 as uuidv4 } from 'uuid';

export const tasksRouter = Router();

tasksRouter.get('/', (req, res) => {
  const { goal_id, milestone_id, status } = req.query;
  let query = `
    SELECT t.*,
      g.title as goal_title,
      m.title as milestone_title,
      m.type as milestone_type
    FROM tasks t
    LEFT JOIN goals g ON g.id = t.goal_id
    LEFT JOIN milestones m ON m.id = t.milestone_id
    WHERE 1=1
  `;
  const params: string[] = [];
  if (goal_id) { query += ' AND t.goal_id = ?'; params.push(goal_id as string); }
  if (milestone_id) { query += ' AND t.milestone_id = ?'; params.push(milestone_id as string); }
  if (status) { query += ' AND t.status = ?'; params.push(status as string); }
  query += ' ORDER BY t.updated_at DESC';
  res.json(db.prepare(query).all(...params));
});

tasksRouter.get('/blockers', (req, res) => {
  const tasks = db.prepare(`
    SELECT t.*, g.title as goal_title, m.title as milestone_title, m.type as milestone_type
    FROM tasks t
    LEFT JOIN goals g ON g.id = t.goal_id
    LEFT JOIN milestones m ON m.id = t.milestone_id
    WHERE t.status = 'blocked' OR (t.blockers IS NOT NULL AND t.blockers != '')
    ORDER BY t.updated_at DESC
  `).all();
  res.json(tasks);
});

tasksRouter.post('/', (req, res) => {
  const { goal_id, milestone_id, title, description, status, percent_complete, notes, blockers, due_date } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });
  const id = uuidv4();
  db.prepare(`
    INSERT INTO tasks (id, goal_id, milestone_id, title, description, status, percent_complete, notes, blockers, due_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, goal_id || null, milestone_id || null, title, description || null,
    status || 'todo', percent_complete || 0, notes || null, blockers || null, due_date || null);
  res.status(201).json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(id));
});

tasksRouter.put('/:id', (req, res) => {
  const { goal_id, milestone_id, title, description, status, percent_complete, notes, blockers, due_date } = req.body;
  const completed_at = status === 'completed' ? "datetime('now')" : 'NULL';
  db.prepare(`
    UPDATE tasks SET goal_id=?, milestone_id=?, title=?, description=?, status=?,
      percent_complete=?, notes=?, blockers=?, due_date=?,
      completed_at = CASE WHEN ? = 'completed' THEN datetime('now') ELSE completed_at END,
      updated_at=datetime('now')
    WHERE id=?
  `).run(goal_id, milestone_id, title, description, status, percent_complete, notes, blockers, due_date, status, req.params.id);
  res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id));
});

tasksRouter.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.status(204).send();
});
