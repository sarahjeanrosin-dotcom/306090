import { Router, Request } from 'express';
import { supabase } from '../db';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'path';

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

export const deliverablesRouter = Router();

async function enrichDeliverables(deliverables: Record<string, unknown>[]) {
  if (!deliverables.length) return deliverables;
  const ids = deliverables.map(d => d.id as string);
  const [{ data: dGoals }, { data: dTasks }, { data: dTopics }] = await Promise.all([
    supabase.from('deliverable_goals').select('deliverable_id, goals(id, title)').in('deliverable_id', ids),
    supabase.from('deliverable_tasks').select('deliverable_id, tasks(id, title)').in('deliverable_id', ids),
    supabase.from('deliverable_topics').select('deliverable_id, topics(id, name, color)').in('deliverable_id', ids),
  ]);
  return deliverables.map(d => ({
    ...d,
    goals: (dGoals || []).filter(r => r.deliverable_id === d.id).map(r => r.goals),
    tasks: (dTasks || []).filter(r => r.deliverable_id === d.id).map(r => r.tasks),
    topics: (dTopics || []).filter(r => r.deliverable_id === d.id).map(r => r.topics),
  }));
}

deliverablesRouter.get('/', async (req, res) => {
  const { goal_id, include_in_updates } = req.query;

  let query = supabase.from('deliverables').select('*').order('upload_date', { ascending: false });
  if (include_in_updates) query = query.eq('include_in_updates', true);

  let deliverables: Record<string, unknown>[];
  if (goal_id) {
    const { data: dg, error } = await supabase
      .from('deliverable_goals')
      .select('deliverable_id')
      .eq('goal_id', goal_id as string);
    if (error) return res.status(500).json({ error: error.message });
    const dIds = (dg || []).map(r => r.deliverable_id);
    if (!dIds.length) return res.json([]);
    const { data, error: e2 } = await supabase.from('deliverables').select('*').in('id', dIds).order('upload_date', { ascending: false });
    if (e2) return res.status(500).json({ error: e2.message });
    deliverables = (data || []) as Record<string, unknown>[];
  } else {
    const { data, error } = await query;
    if (error) return res.status(500).json({ error: error.message });
    deliverables = (data || []) as Record<string, unknown>[];
  }

  res.json(await enrichDeliverables(deliverables));
});

deliverablesRouter.get('/:id', async (req, res) => {
  const { data: d, error } = await supabase.from('deliverables').select('*').eq('id', req.params.id).single();
  if (error || !d) return res.status(404).json({ error: 'Not found' });
  const enriched = await enrichDeliverables([d as Record<string, unknown>]);
  res.json(enriched[0]);
});

// Request a signed URL so the client can upload directly to Supabase Storage
deliverablesRouter.post('/request-upload', async (req, res) => {
  const { fileName, mimeType } = req.body;
  if (!fileName) return res.status(400).json({ error: 'fileName is required' });

  const ext = path.extname(fileName);
  const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;

  const { data, error } = await supabase.storage
    .from('deliverables')
    .createSignedUploadUrl(uniqueName);

  if (error || !data) return res.status(500).json({ error: error?.message || 'Failed to create signed URL' });

  res.json({ signedUrl: data.signedUrl, filePath: uniqueName });
});

// Save metadata after client has uploaded file directly to Supabase Storage
deliverablesRouter.post('/from-storage', async (req, res) => {
  const { title, description, filePath, fileName, fileSize, mimeType, goal_ids, task_ids, topic_ids, mark_tasks_complete, include_in_updates } = req.body;
  if (!filePath) return res.status(400).json({ error: 'filePath is required' });

  const { data: { publicUrl } } = supabase.storage.from('deliverables').getPublicUrl(filePath);

  const id = uuidv4();
  const { data, error } = await supabase
    .from('deliverables')
    .insert({
      id,
      title: title || fileName || filePath,
      description: description || null,
      type: 'file',
      file_path: publicUrl,
      file_name: fileName || filePath,
      file_size: fileSize || null,
      mime_type: mimeType || null,
      include_in_updates: include_in_updates === false || include_in_updates === 'false' ? false : true,
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  await linkRelated(id, goal_ids, task_ids, topic_ids, mark_tasks_complete);
  res.status(201).json(data);
});

// File upload (local dev fallback)
deliverablesRouter.post('/upload', upload.single('file'), async (req: Request, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'No file provided' });

  const { title, description, goal_ids, task_ids, topic_ids, mark_tasks_complete, include_in_updates } = req.body;

  const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(file.originalname)}`;

  const { error: uploadError } = await supabase.storage
    .from('deliverables')
    .upload(uniqueName, file.buffer, { contentType: file.mimetype, upsert: false });

  if (uploadError) return res.status(500).json({ error: uploadError.message });

  const { data: { publicUrl } } = supabase.storage.from('deliverables').getPublicUrl(uniqueName);

  const id = uuidv4();
  const { data, error } = await supabase
    .from('deliverables')
    .insert({
      id,
      title: title || file.originalname,
      description: description || null,
      type: 'file',
      file_path: publicUrl,
      file_name: file.originalname,
      file_size: file.size,
      mime_type: file.mimetype,
      include_in_updates: include_in_updates === 'false' ? false : true,
    })
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  await linkRelated(id, goal_ids, task_ids, topic_ids, mark_tasks_complete);
  res.status(201).json(data);
});

// Link upload
deliverablesRouter.post('/link', async (req, res) => {
  const { title, description, url, goal_ids, task_ids, topic_ids, mark_tasks_complete, include_in_updates } = req.body;
  if (!url) return res.status(400).json({ error: 'url is required' });
  const id = uuidv4();
  const { data, error } = await supabase
    .from('deliverables')
    .insert({
      id,
      title: title || url,
      description: description || null,
      type: 'link',
      url,
      include_in_updates: include_in_updates === false ? false : true,
    })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  await linkRelated(id, goal_ids, task_ids, topic_ids, mark_tasks_complete);
  res.status(201).json(data);
});

deliverablesRouter.put('/:id', async (req, res) => {
  const { title, description, include_in_updates, goal_ids, task_ids, topic_ids } = req.body;
  const { data, error } = await supabase
    .from('deliverables')
    .update({ title, description, include_in_updates: !!include_in_updates })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });

  // Relink
  await Promise.all([
    supabase.from('deliverable_goals').delete().eq('deliverable_id', req.params.id),
    supabase.from('deliverable_tasks').delete().eq('deliverable_id', req.params.id),
    supabase.from('deliverable_topics').delete().eq('deliverable_id', req.params.id),
  ]);
  await linkRelated(req.params.id, goal_ids, task_ids, topic_ids, false);

  res.json(data);
});

deliverablesRouter.delete('/:id', async (req, res) => {
  const { data: d } = await supabase.from('deliverables').select('type, file_path').eq('id', req.params.id).single();

  if (d?.type === 'file' && d.file_path) {
    try {
      const url = new URL(d.file_path);
      const parts = url.pathname.split('/object/public/deliverables/');
      if (parts[1]) {
        await supabase.storage.from('deliverables').remove([parts[1]]);
      }
    } catch {
      // If URL parsing fails, continue with DB delete
    }
  }

  const { error } = await supabase.from('deliverables').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).send();
});

// Download/redirect to file
deliverablesRouter.get('/file/:id', async (req, res) => {
  const { data: d } = await supabase.from('deliverables').select('file_path, file_name').eq('id', req.params.id).single();
  if (!d?.file_path) return res.status(404).json({ error: 'File not found' });
  res.redirect(d.file_path);
});

async function linkRelated(
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

  const ops: Promise<unknown>[] = [];
  if (gIds.length) ops.push(supabase.from('deliverable_goals').upsert(gIds.map(id => ({ deliverable_id: deliverableId, goal_id: id }))));
  if (tIds.length) ops.push(supabase.from('deliverable_tasks').upsert(tIds.map(id => ({ deliverable_id: deliverableId, task_id: id }))));
  if (tpIds.length) ops.push(supabase.from('deliverable_topics').upsert(tpIds.map(id => ({ deliverable_id: deliverableId, topic_id: id }))));

  if (markTasksComplete === true || markTasksComplete === 'true') {
    for (const id of tIds) {
      ops.push(supabase.from('tasks').update({
        status: 'completed',
        percent_complete: 100,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', id));
    }
  }

  await Promise.all(ops);
}
