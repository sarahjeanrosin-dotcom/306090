import { Router } from 'express';
import { db } from '../db';
import { v4 as uuidv4 } from 'uuid';

export const updatesRouter = Router();

updatesRouter.get('/', (req, res) => {
  const updates = db.prepare('SELECT * FROM weekly_updates ORDER BY week_start DESC').all();
  res.json(updates);
});

updatesRouter.get('/:id', (req, res) => {
  const update = db.prepare('SELECT * FROM weekly_updates WHERE id = ?').get(req.params.id);
  if (!update) return res.status(404).json({ error: 'Not found' });
  res.json(update);
});

updatesRouter.post('/', (req, res) => {
  const { week_start, week_end, content, edited_content } = req.body;
  if (!week_start || !week_end || !content) {
    return res.status(400).json({ error: 'week_start, week_end, content required' });
  }
  const id = uuidv4();
  db.prepare(`INSERT INTO weekly_updates (id, week_start, week_end, content, edited_content) VALUES (?, ?, ?, ?, ?)`)
    .run(id, week_start, week_end, content, edited_content || null);
  res.status(201).json(db.prepare('SELECT * FROM weekly_updates WHERE id = ?').get(id));
});

updatesRouter.put('/:id', (req, res) => {
  const { edited_content, content } = req.body;
  db.prepare(`UPDATE weekly_updates SET edited_content=?, content=?, updated_at=datetime('now') WHERE id=?`)
    .run(edited_content, content, req.params.id);
  res.json(db.prepare('SELECT * FROM weekly_updates WHERE id = ?').get(req.params.id));
});

updatesRouter.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM weekly_updates WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

// Get context data for a given week range
updatesRouter.get('/context/:weekStart/:weekEnd', (req, res) => {
  const { weekStart, weekEnd } = req.params;

  const completedTasks = db.prepare(`
    SELECT t.*, g.title as goal_title, m.title as milestone_title, m.type as milestone_type
    FROM tasks t
    LEFT JOIN goals g ON g.id = t.goal_id
    LEFT JOIN milestones m ON m.id = t.milestone_id
    WHERE t.completed_at BETWEEN ? AND ?
    ORDER BY t.completed_at DESC
  `).all(weekStart, weekEnd + 'T23:59:59');

  const deliverables = db.prepare(`
    SELECT d.* FROM deliverables d
    WHERE d.upload_date BETWEEN ? AND ? AND d.include_in_updates = 1
    ORDER BY d.upload_date DESC
  `).all(weekStart, weekEnd + 'T23:59:59');

  const blockers = db.prepare(`
    SELECT t.*, g.title as goal_title FROM tasks t
    LEFT JOIN goals g ON g.id = t.goal_id
    WHERE (t.status = 'blocked' OR (t.blockers IS NOT NULL AND t.blockers != ''))
    AND t.status != 'completed'
  `).all();

  const goals = db.prepare(`
    SELECT g.*, t.name as topic_name,
      COALESCE((SELECT AVG(percent_complete) FROM tasks WHERE goal_id = g.id), 0) as avg_progress,
      (SELECT COUNT(*) FROM tasks WHERE goal_id = g.id) as task_count,
      (SELECT COUNT(*) FROM tasks WHERE goal_id = g.id AND status = 'completed') as completed_tasks
    FROM goals g
    LEFT JOIN topics t ON t.id = g.topic_id
    WHERE g.status = 'active'
    ORDER BY g.created_at
  `).all();

  res.json({ completedTasks, deliverables, blockers, goals });
});
