import { Router, Request } from 'express';
import { db } from '../db';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

export const deliverablesRouter = Router();

deliverablesRouter.get('/', (req, res) => {
  const { goal_id, topic_id, include_in_updates } = req.query;
  let deliverables: Record<string, unknown>[];

  if (goal_id) {
    deliverables = db.prepare(`
      SELECT d.* FROM deliverables d
      JOIN deliverable_goals dg ON dg.deliverable_id = d.id
      WHERE dg.goal_id = ?
      ORDER BY d.upload_date DESC
    `).all(goal_id as string) as Record<string, unknown>[];
  } else {
    deliverables = db.prepare(`
      SELECT d.* FROM deliverables d
      ${include_in_updates ? "WHERE d.include_in_updates = 1" : ""}
      ORDER BY d.upload_date DESC
    `).all() as Record<string, unknown>[];
  }

  // Enrich with related entities
  const enriched = deliverables.map((d) => ({
    ...d,
    goals: db.prepare(`
      SELECT g.id, g.title FROM goals g
      JOIN deliverable_goals dg ON dg.goal_id = g.id
      WHERE dg.deliverable_id = ?
    `).all(d.id as string),
    tasks: db.prepare(`
      SELECT t.id, t.title FROM tasks t
      JOIN deliverable_tasks dt ON dt.task_id = t.id
      WHERE dt.deliverable_id = ?
    `).all(d.id as string),
    topics: db.prepare(`
      SELECT tp.id, tp.name, tp.color FROM topics tp
      JOIN deliverable_topics dtp ON dtp.topic_id = tp.id
      WHERE dtp.deliverable_id = ?
    `).all(d.id as string),
  }));

  res.json(enriched);
});

deliverablesRouter.get('/:id', (req, res) => {
  const d = db.prepare('SELECT * FROM deliverables WHERE id = ?').get(req.params.id) as Record<string, unknown> | undefined;
  if (!d) return res.status(404).json({ error: 'Not found' });
  res.json({
    ...d,
    goals: db.prepare(`SELECT g.id, g.title FROM goals g JOIN deliverable_goals dg ON dg.goal_id = g.id WHERE dg.deliverable_id = ?`).all(req.params.id),
    tasks: db.prepare(`SELECT t.id, t.title FROM tasks t JOIN deliverable_tasks dt ON dt.task_id = t.id WHERE dt.deliverable_id = ?`).all(req.params.id),
    topics: db.prepare(`SELECT tp.id, tp.name, tp.color FROM topics tp JOIN deliverable_topics dtp ON dtp.topic_id = tp.id WHERE dtp.deliverable_id = ?`).all(req.params.id),
  });
});

// File upload
deliverablesRouter.post('/upload', upload.single('file'), (req: Request, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file provided' });

  const { title, description, goal_ids, task_ids, topic_ids, mark_tasks_complete, include_in_updates } = req.body;
  const id = uuidv4();

  db.prepare(`
    INSERT INTO deliverables (id, title, description, type, file_path, file_name, file_size, mime_type, include_in_updates)
    VALUES (?, ?, ?, 'file', ?, ?, ?, ?, ?)
  `).run(id, title || file.originalname, description || null, file.path,
    file.originalname, file.size, file.mimetype, include_in_updates === 'false' ? 0 : 1);

  linkRelated(id, goal_ids, task_ids, topic_ids, mark_tasks_complete);
  res.status(201).json(db.prepare('SELECT * FROM deliverables WHERE id = ?').get(id));
});

// Link upload
deliverablesRouter.post('/link', (req, res) => {
  const { title, description, url, goal_ids, task_ids, topic_ids, mark_tasks_complete, include_in_updates } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });
  const id = uuidv4();
  db.prepare(`
    INSERT INTO deliverables (id, title, description, type, url, include_in_updates)
    VALUES (?, ?, ?, 'link', ?, ?)
  `).run(id, title || url, description || null, url, include_in_updates === false ? 0 : 1);

  linkRelated(id, goal_ids, task_ids, topic_ids, mark_tasks_complete);
  res.status(201).json(db.prepare('SELECT * FROM deliverables WHERE id = ?').get(id));
});

deliverablesRouter.put('/:id', (req, res) => {
  const { title, description, include_in_updates, goal_ids, task_ids, topic_ids } = req.body;
  db.prepare(`UPDATE deliverables SET title=?, description=?, include_in_updates=? WHERE id=?`)
    .run(title, description, include_in_updates ? 1 : 0, req.params.id);

  // Relink
  db.prepare('DELETE FROM deliverable_goals WHERE deliverable_id=?').run(req.params.id);
  db.prepare('DELETE FROM deliverable_tasks WHERE deliverable_id=?').run(req.params.id);
  db.prepare('DELETE FROM deliverable_topics WHERE deliverable_id=?').run(req.params.id);
  linkRelated(req.params.id, goal_ids, task_ids, topic_ids, false);

  res.json(db.prepare('SELECT * FROM deliverables WHERE id = ?').get(req.params.id));
});

deliverablesRouter.delete('/:id', (req, res) => {
  const d = db.prepare('SELECT * FROM deliverables WHERE id = ?').get(req.params.id) as { type: string; file_path?: string } | undefined;
  if (d?.type === 'file' && d.file_path && fs.existsSync(d.file_path)) {
    fs.unlinkSync(d.file_path);
  }
  db.prepare('DELETE FROM deliverables WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

// Serve uploaded files
deliverablesRouter.get('/file/:id', (req, res) => {
  const d = db.prepare('SELECT * FROM deliverables WHERE id = ?').get(req.params.id) as { file_path?: string; file_name?: string } | undefined;
  if (!d?.file_path || !fs.existsSync(d.file_path)) return res.status(404).json({ error: 'File not found' });
  res.download(d.file_path, d.file_name || 'download');
});

function linkRelated(
  deliverableId: string,
  goalIds: string | string[] | undefined,
  taskIds: string | string[] | undefined,
  topicIds: string | string[] | undefined,
  markTasksComplete: boolean | string
) {
  const parseIds = (val: string | string[] | undefined): string[] => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    try { return JSON.parse(val); } catch { return [val]; }
  };

  const gIds = parseIds(goalIds);
  const tIds = parseIds(taskIds);
  const tpIds = parseIds(topicIds);

  const insGoal = db.prepare('INSERT OR IGNORE INTO deliverable_goals (deliverable_id, goal_id) VALUES (?, ?)');
  const insTask = db.prepare('INSERT OR IGNORE INTO deliverable_tasks (deliverable_id, task_id) VALUES (?, ?)');
  const insTopic = db.prepare('INSERT OR IGNORE INTO deliverable_topics (deliverable_id, topic_id) VALUES (?, ?)');

  db.transaction(() => {
    gIds.forEach(id => insGoal.run(deliverableId, id));
    tIds.forEach(id => insTask.run(deliverableId, id));
    tpIds.forEach(id => insTopic.run(deliverableId, id));

    if (markTasksComplete === true || markTasksComplete === 'true') {
      const updateTask = db.prepare(`UPDATE tasks SET status='completed', percent_complete=100, completed_at=datetime('now'), updated_at=datetime('now') WHERE id=?`);
      tIds.forEach(id => updateTask.run(id));
    }
  })();
}
