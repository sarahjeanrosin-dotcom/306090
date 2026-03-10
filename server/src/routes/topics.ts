import { Router } from 'express';
import { db } from '../db';
import { v4 as uuidv4 } from 'uuid';

export const topicsRouter = Router();

topicsRouter.get('/', (req, res) => {
  const topics = db.prepare(`
    SELECT t.*, COUNT(DISTINCT g.id) as goal_count
    FROM topics t
    LEFT JOIN goals g ON g.topic_id = t.id
    GROUP BY t.id
    ORDER BY t.name
  `).all();
  res.json(topics);
});

topicsRouter.post('/', (req, res) => {
  const { name, color, description } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  const id = uuidv4();
  db.prepare('INSERT INTO topics (id, name, color, description) VALUES (?, ?, ?, ?)')
    .run(id, name, color || '#6366f1', description || null);
  res.status(201).json(db.prepare('SELECT * FROM topics WHERE id = ?').get(id));
});

topicsRouter.put('/:id', (req, res) => {
  const { name, color, description } = req.body;
  db.prepare('UPDATE topics SET name = ?, color = ?, description = ? WHERE id = ?')
    .run(name, color, description, req.params.id);
  res.json(db.prepare('SELECT * FROM topics WHERE id = ?').get(req.params.id));
});

topicsRouter.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM topics WHERE id = ?').run(req.params.id);
  res.status(204).send();
});
