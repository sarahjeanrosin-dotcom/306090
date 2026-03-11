import axios from 'axios';
import type { Goal, Milestone, Task, Deliverable, WeeklyUpdate, Topic, DashboardData } from '../types';

const api = axios.create({ baseURL: '/api' });

// Topics
export const getTopics = () => api.get<Topic[]>('/topics').then(r => r.data);
export const createTopic = (data: Partial<Topic>) => api.post<Topic>('/topics', data).then(r => r.data);
export const updateTopic = (id: string, data: Partial<Topic>) => api.put<Topic>(`/topics/${id}`, data).then(r => r.data);
export const deleteTopic = (id: string) => api.delete(`/topics/${id}`);

// Goals
export const getGoals = () => api.get<Goal[]>('/goals').then(r => r.data);
export const getGoal = (id: string) => api.get<Goal>(`/goals/${id}`).then(r => r.data);
export const createGoal = (data: Partial<Goal>) => api.post<Goal>('/goals', data).then(r => r.data);
export const updateGoal = (id: string, data: Partial<Goal>) => api.put<Goal>(`/goals/${id}`, data).then(r => r.data);
export const deleteGoal = (id: string) => api.delete(`/goals/${id}`);

// Milestones
export const getMilestones = (params?: { goal_id?: string; type?: number }) =>
  api.get<Milestone[]>('/milestones', { params }).then(r => r.data);
export const createMilestone = (data: Partial<Milestone>) => api.post<Milestone>('/milestones', data).then(r => r.data);
export const updateMilestone = (id: string, data: Partial<Milestone>) => api.put<Milestone>(`/milestones/${id}`, data).then(r => r.data);
export const deleteMilestone = (id: string) => api.delete(`/milestones/${id}`);

// Tasks
export const getTasks = (params?: { goal_id?: string; milestone_id?: string; status?: string }) =>
  api.get<Task[]>('/tasks', { params }).then(r => r.data);
export const createTask = (data: Partial<Task>) => api.post<Task>('/tasks', data).then(r => r.data);
export const updateTask = (id: string, data: Partial<Task>) => api.put<Task>(`/tasks/${id}`, data).then(r => r.data);
export const deleteTask = (id: string) => api.delete(`/tasks/${id}`);

// Deliverables
export const getDeliverables = (params?: { goal_id?: string; include_in_updates?: boolean }) =>
  api.get<Deliverable[]>('/deliverables', { params }).then(r => r.data);
export const getDeliverable = (id: string) => api.get<Deliverable>(`/deliverables/${id}`).then(r => r.data);
export const uploadDeliverable = async (formData: FormData): Promise<Deliverable> => {
  const file = formData.get('file') as File;
  if (!file) throw new Error('No file provided');

  // Step 1: get a signed upload URL from the backend
  const { data: { signedUrl, filePath } } = await api.post<{ signedUrl: string; filePath: string }>(
    '/deliverables/request-upload',
    { fileName: file.name, mimeType: file.type }
  );

  // Step 2: upload the file directly to Supabase Storage (bypasses Netlify function size limits)
  const uploadRes = await fetch(signedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!uploadRes.ok) throw new Error(`Storage upload failed: ${uploadRes.statusText}`);

  // Step 3: save metadata via backend
  return api.post<Deliverable>('/deliverables/from-storage', {
    filePath,
    fileName: file.name,
    fileSize: file.size,
    mimeType: file.type,
    title: formData.get('title') as string,
    description: formData.get('description') as string,
    goal_ids: JSON.parse((formData.get('goal_ids') as string) || '[]'),
    task_ids: JSON.parse((formData.get('task_ids') as string) || '[]'),
    topic_ids: JSON.parse((formData.get('topic_ids') as string) || '[]'),
    mark_tasks_complete: formData.get('mark_tasks_complete') === 'true',
    include_in_updates: formData.get('include_in_updates') !== 'false',
  }).then(r => r.data);
};
export const createLinkDeliverable = (data: Record<string, unknown>) =>
  api.post<Deliverable>('/deliverables/link', data).then(r => r.data);
export const updateDeliverable = (id: string, data: Partial<Deliverable>) =>
  api.put<Deliverable>(`/deliverables/${id}`, data).then(r => r.data);
export const deleteDeliverable = (id: string) => api.delete(`/deliverables/${id}`);

// Weekly Updates
export const getUpdates = () => api.get<WeeklyUpdate[]>('/updates').then(r => r.data);
export const getUpdate = (id: string) => api.get<WeeklyUpdate>(`/updates/${id}`).then(r => r.data);
export const createUpdate = (data: Partial<WeeklyUpdate>) => api.post<WeeklyUpdate>('/updates', data).then(r => r.data);
export const updateUpdate = (id: string, data: Partial<WeeklyUpdate>) => api.put<WeeklyUpdate>(`/updates/${id}`, data).then(r => r.data);
export const deleteUpdate = (id: string) => api.delete(`/updates/${id}`);
export const getWeekContext = (weekStart: string, weekEnd: string) =>
  api.get(`/updates/context/${weekStart}/${weekEnd}`).then(r => r.data);

// Dashboard
export const getDashboard = () => api.get<DashboardData>('/dashboard').then(r => r.data);
