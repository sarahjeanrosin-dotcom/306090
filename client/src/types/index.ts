export interface Topic {
  id: string;
  name: string;
  color: string;
  description?: string;
  goal_count?: number;
  created_at: string;
}

export interface Goal {
  id: string;
  title: string;
  description?: string;
  topic_id?: string;
  topic_name?: string;
  topic_color?: string;
  success_criteria?: string;
  start_date: string;
  target_end_date?: string;
  status: 'active' | 'completed' | 'paused';
  created_at: string;
  updated_at: string;
  milestone_count?: number;
  task_count?: number;
  completed_task_count?: number;
  avg_progress?: number;
  milestones?: Milestone[];
  tasks?: Task[];
}

export interface Milestone {
  id: string;
  goal_id: string;
  goal_title?: string;
  type: 30 | 60 | 90;
  title: string;
  description?: string;
  target_date?: string;
  status: 'not_started' | 'in_progress' | 'completed';
  created_at: string;
  updated_at: string;
  task_count?: number;
  completed_task_count?: number;
  avg_progress?: number;
}

export interface Task {
  id: string;
  goal_id?: string;
  goal_title?: string;
  milestone_id?: string;
  milestone_title?: string;
  milestone_type?: 30 | 60 | 90;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'blocked' | 'completed';
  percent_complete: number;
  notes?: string;
  blockers?: string;
  due_date?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface Deliverable {
  id: string;
  title: string;
  description?: string;
  type: 'file' | 'link';
  file_path?: string;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
  url?: string;
  upload_date: string;
  include_in_updates: number;
  created_at: string;
  goals?: { id: string; title: string }[];
  tasks?: { id: string; title: string }[];
  topics?: { id: string; name: string; color: string }[];
}

export interface WeeklyUpdate {
  id: string;
  week_start: string;
  week_end: string;
  content: string;
  edited_content?: string;
  generated_at: string;
  updated_at: string;
}

export interface DashboardData {
  overallProgress: number;
  goals: Goal[];
  milestoneProgress: { type: number; total: number; completed: number; avg_progress: number }[];
  topicProgress: { id: string; name: string; color: string; goal_count: number; avg_progress: number }[];
  recentDeliverables: Deliverable[];
  recentCompletedTasks: Task[];
  blockers: Task[];
  stats: {
    active_goals: number;
    open_tasks: number;
    completed_tasks: number;
    total_deliverables: number;
    blocked_tasks: number;
    completed_milestones: number;
    total_milestones: number;
  };
}

export interface AIMilestoneResult {
  milestones: { type: 30 | 60 | 90; title: string; description: string }[];
  tasks: { title: string; description: string; milestone_type: 30 | 60 | 90; notes?: string }[];
}

export interface AIWeeklyUpdate {
  subject: string;
  sections: {
    accomplishments: string;
    deliverables: string;
    progress: string;
    blockers: string;
    next_week: string;
  };
  full_email: string;
}
