import { Router } from 'express';
import { db } from '../db';

export const dashboardRouter = Router();

dashboardRouter.get('/', (req, res) => {
  const goals = db.prepare(`
    SELECT g.*, t.name as topic_name, t.color as topic_color,
      COALESCE((SELECT AVG(percent_complete) FROM tasks WHERE goal_id = g.id), 0) as avg_progress,
      (SELECT COUNT(*) FROM tasks WHERE goal_id = g.id) as task_count,
      (SELECT COUNT(*) FROM tasks WHERE goal_id = g.id AND status = 'completed') as completed_tasks,
      (SELECT COUNT(*) FROM milestones WHERE goal_id = g.id) as milestone_count,
      (SELECT COUNT(*) FROM milestones WHERE goal_id = g.id AND status = 'completed') as completed_milestones
    FROM goals g
    LEFT JOIN topics t ON t.id = g.topic_id
    WHERE g.status = 'active'
    ORDER BY g.created_at
  `).all();

  const overallProgress = goals.length > 0
    ? (goals as Record<string, unknown>[]).reduce((sum, g) => sum + Number(g.avg_progress), 0) / goals.length
    : 0;

  const milestoneProgress = db.prepare(`
    SELECT m.type,
      COUNT(*) as total,
      SUM(CASE WHEN m.status = 'completed' THEN 1 ELSE 0 END) as completed,
      COALESCE(AVG((SELECT AVG(percent_complete) FROM tasks WHERE milestone_id = m.id)), 0) as avg_progress
    FROM milestones m
    JOIN goals g ON g.id = m.goal_id
    WHERE g.status = 'active'
    GROUP BY m.type
    ORDER BY m.type
  `).all();

  const topicProgress = db.prepare(`
    SELECT t.id, t.name, t.color,
      COUNT(DISTINCT g.id) as goal_count,
      COALESCE(AVG(COALESCE((SELECT AVG(percent_complete) FROM tasks WHERE goal_id = g.id), 0)), 0) as avg_progress
    FROM topics t
    JOIN goals g ON g.topic_id = t.id
    WHERE g.status = 'active'
    GROUP BY t.id
    ORDER BY t.name
  `).all();

  const recentDeliverables = db.prepare(`
    SELECT d.* FROM deliverables d
    ORDER BY d.upload_date DESC
    LIMIT 10
  `).all();

  const recentCompletedTasks = db.prepare(`
    SELECT t.*, g.title as goal_title, m.title as milestone_title, m.type as milestone_type
    FROM tasks t
    LEFT JOIN goals g ON g.id = t.goal_id
    LEFT JOIN milestones m ON m.id = t.milestone_id
    WHERE t.status = 'completed'
    ORDER BY t.completed_at DESC
    LIMIT 10
  `).all();

  const blockers = db.prepare(`
    SELECT t.*, g.title as goal_title FROM tasks t
    LEFT JOIN goals g ON g.id = t.goal_id
    WHERE (t.status = 'blocked' OR (t.blockers IS NOT NULL AND t.blockers != ''))
    AND t.status != 'completed'
    ORDER BY t.updated_at DESC
  `).all();

  const stats = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM goals WHERE status = 'active') as active_goals,
      (SELECT COUNT(*) FROM tasks WHERE status != 'completed') as open_tasks,
      (SELECT COUNT(*) FROM tasks WHERE status = 'completed') as completed_tasks,
      (SELECT COUNT(*) FROM deliverables) as total_deliverables,
      (SELECT COUNT(*) FROM tasks WHERE status = 'blocked') as blocked_tasks,
      (SELECT COUNT(*) FROM milestones WHERE status = 'completed') as completed_milestones,
      (SELECT COUNT(*) FROM milestones) as total_milestones
  `).get();

  res.json({
    overallProgress,
    goals,
    milestoneProgress,
    topicProgress,
    recentDeliverables,
    recentCompletedTasks,
    blockers,
    stats,
  });
});
