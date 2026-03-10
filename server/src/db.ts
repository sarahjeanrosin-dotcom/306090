import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

const DB_PATH = path.join(DB_DIR, 'tracker.db');
export const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS topics (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL DEFAULT '#6366f1',
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      topic_id TEXT REFERENCES topics(id) ON DELETE SET NULL,
      success_criteria TEXT,
      start_date TEXT NOT NULL DEFAULT (date('now')),
      target_end_date TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed','paused')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS milestones (
      id TEXT PRIMARY KEY,
      goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
      type INTEGER NOT NULL CHECK(type IN (30, 60, 90)),
      title TEXT NOT NULL,
      description TEXT,
      target_date TEXT,
      status TEXT NOT NULL DEFAULT 'not_started' CHECK(status IN ('not_started','in_progress','completed')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      goal_id TEXT REFERENCES goals(id) ON DELETE SET NULL,
      milestone_id TEXT REFERENCES milestones(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo','in_progress','blocked','completed')),
      percent_complete INTEGER NOT NULL DEFAULT 0 CHECK(percent_complete BETWEEN 0 AND 100),
      notes TEXT,
      blockers TEXT,
      due_date TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS deliverables (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL CHECK(type IN ('file','link')),
      file_path TEXT,
      file_name TEXT,
      file_size INTEGER,
      mime_type TEXT,
      url TEXT,
      upload_date TEXT NOT NULL DEFAULT (datetime('now')),
      include_in_updates INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS deliverable_goals (
      deliverable_id TEXT NOT NULL REFERENCES deliverables(id) ON DELETE CASCADE,
      goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
      PRIMARY KEY (deliverable_id, goal_id)
    );

    CREATE TABLE IF NOT EXISTS deliverable_tasks (
      deliverable_id TEXT NOT NULL REFERENCES deliverables(id) ON DELETE CASCADE,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      PRIMARY KEY (deliverable_id, task_id)
    );

    CREATE TABLE IF NOT EXISTS deliverable_topics (
      deliverable_id TEXT NOT NULL REFERENCES deliverables(id) ON DELETE CASCADE,
      topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
      PRIMARY KEY (deliverable_id, topic_id)
    );

    CREATE TABLE IF NOT EXISTS weekly_updates (
      id TEXT PRIMARY KEY,
      week_start TEXT NOT NULL,
      week_end TEXT NOT NULL,
      content TEXT NOT NULL,
      edited_content TEXT,
      generated_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS task_completions (
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      deliverable_id TEXT NOT NULL REFERENCES deliverables(id) ON DELETE CASCADE,
      PRIMARY KEY (task_id, deliverable_id)
    );
  `);

  // Seed default topics if none exist
  const count = db.prepare('SELECT COUNT(*) as c FROM topics').get() as { c: number };
  if (count.c === 0) {
    const insert = db.prepare('INSERT INTO topics (id, name, color, description) VALUES (?, ?, ?, ?)');
    const seed = db.transaction(() => {
      insert.run('t1', 'Technical Skills', '#6366f1', 'Learning and applying technical knowledge');
      insert.run('t2', 'Stakeholder Relations', '#ec4899', 'Building relationships with key stakeholders');
      insert.run('t3', 'Process & Operations', '#f59e0b', 'Understanding and improving processes');
      insert.run('t4', 'Team Integration', '#10b981', 'Integrating with the team and culture');
      insert.run('t5', 'Strategic Initiatives', '#3b82f6', 'Contributing to strategic projects');
    });
    seed();
  }
}
