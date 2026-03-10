import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const aiRouter = Router();

async function streamWithThinking(prompt: string, maxTokens = 4096) {
  // Use adaptive thinking via type cast since older SDK typings may not include it
  return (client.messages as unknown as {
    stream: (p: Record<string, unknown>) => AsyncIterable<Record<string, unknown>>;
  }).stream({
    model: 'claude-opus-4-6',
    max_tokens: maxTokens,
    thinking: { type: 'adaptive' },
    messages: [{ role: 'user', content: prompt }],
  });
}

function writeSSE(res: import('express').Response, data: unknown) {
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function setSSEHeaders(res: import('express').Response) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
}

async function collectStream(stream: AsyncIterable<Record<string, unknown>>, res: import('express').Response) {
  let fullText = '';
  for await (const event of stream) {
    if (event['type'] === 'content_block_delta') {
      const delta = event['delta'] as Record<string, unknown>;
      if (delta['type'] === 'text_delta') {
        const text = String(delta['text'] || '');
        fullText += text;
        writeSSE(res, { type: 'text', text });
      }
    }
  }
  return fullText;
}

// Convert a goal into milestones and tasks
aiRouter.post('/generate-milestones', async (req, res) => {
  const { goal } = req.body;
  if (!goal?.title) return res.status(400).json({ error: 'goal with title required' });

  const prompt = `You are helping someone plan their first 90 days in a new job.

Given this 90-day goal:
Title: ${goal.title}
Description: ${goal.description || 'N/A'}
Success Criteria: ${goal.success_criteria || 'N/A'}
Topic/Category: ${goal.topic_name || 'General'}

Generate a structured 30/60/90 day plan. Return ONLY valid JSON in this exact format:
{
  "milestones": [
    {
      "type": 30,
      "title": "30-day milestone title",
      "description": "What success looks like at 30 days"
    },
    {
      "type": 60,
      "title": "60-day milestone title",
      "description": "What success looks like at 60 days"
    },
    {
      "type": 90,
      "title": "90-day milestone title",
      "description": "What success looks like at 90 days (the full goal)"
    }
  ],
  "tasks": [
    {
      "title": "Task title",
      "description": "Task description",
      "milestone_type": 30,
      "notes": "Any helpful context"
    }
  ]
}

Generate 3-5 concrete, actionable tasks per milestone (9-15 total). Focus on practical steps a new employee can take.`;

  setSSEHeaders(res);
  try {
    const stream = await streamWithThinking(prompt);
    const fullText = await collectStream(stream, res);

    const jsonMatch = fullText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        writeSSE(res, { type: 'complete', data: JSON.parse(jsonMatch[0]) });
      } catch {
        writeSSE(res, { type: 'error', error: 'Failed to parse AI response' });
      }
    }
  } catch (error) {
    writeSSE(res, { type: 'error', error: error instanceof Error ? error.message : 'AI request failed' });
  }
  res.end();
});

// Summarize weekly progress
aiRouter.post('/summarize-week', async (req, res) => {
  const { weekStart, weekEnd, completedTasks, deliverables, blockers, goals } = req.body;

  const prompt = `You are helping someone write a professional Friday progress update for their supervisor.

Week: ${weekStart} to ${weekEnd}

ACTIVE GOALS (with progress):
${goals?.map((g: Record<string, unknown>) => `- ${g.title}: ${Math.round(Number(g.avg_progress))}% complete (${g.completed_tasks}/${g.task_count} tasks done)`).join('\n') || 'No active goals'}

COMPLETED THIS WEEK:
${completedTasks?.map((t: Record<string, unknown>) => `- [${t.milestone_type || 'General'}] ${t.title}${t.goal_title ? ` (Goal: ${t.goal_title})` : ''}`).join('\n') || 'No tasks completed this week'}

DELIVERABLES PRODUCED:
${deliverables?.map((d: Record<string, unknown>) => `- ${d.title}: ${d.description || ''}`).join('\n') || 'No deliverables this week'}

BLOCKERS & RISKS:
${blockers?.map((b: Record<string, unknown>) => `- ${b.title}: ${b.blockers}`).join('\n') || 'No blockers'}

Write a professional, concise Friday progress email update. Return ONLY valid JSON:
{
  "subject": "Email subject line",
  "sections": {
    "accomplishments": "2-4 bullet points of what was accomplished",
    "deliverables": "Deliverables produced (or 'None this week')",
    "progress": "Overall progress toward 90-day goals",
    "blockers": "Blockers or risks (or 'No blockers at this time')",
    "next_week": "2-3 focus areas for next week"
  },
  "full_email": "Complete formatted email text ready to copy and send"
}`;

  setSSEHeaders(res);
  try {
    const stream = await streamWithThinking(prompt);
    const fullText = await collectStream(stream, res);

    const jsonMatch = fullText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        writeSSE(res, { type: 'complete', data: JSON.parse(jsonMatch[0]) });
      } catch {
        writeSSE(res, { type: 'error', error: 'Failed to parse AI response' });
      }
    }
  } catch (error) {
    writeSSE(res, { type: 'error', error: error instanceof Error ? error.message : 'AI request failed' });
  }
  res.end();
});

// Generate a shareable summary
aiRouter.post('/shareable-summary', async (req, res) => {
  const { goals, deliverables, period } = req.body;

  const prompt = `Create a professional shareable progress summary for a new employee's ${period || '30/60/90 day'} plan.

GOALS AND PROGRESS:
${goals?.map((g: Record<string, unknown>) => `- ${g.title}: ${Math.round(Number(g.avg_progress))}% complete`).join('\n') || 'No goals'}

KEY DELIVERABLES:
${deliverables?.map((d: Record<string, unknown>) => `- ${d.title}: ${d.description || ''}`).join('\n') || 'No deliverables'}

Write a concise, professional summary (2-3 paragraphs) suitable for sharing with stakeholders. Highlight progress, key outputs, and momentum. Return just the plain text summary.`;

  setSSEHeaders(res);
  try {
    const stream = client.messages.stream({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    });

    let fullText = '';
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        fullText += event.delta.text;
        writeSSE(res, { type: 'text', text: event.delta.text });
      }
    }
    writeSSE(res, { type: 'complete', data: { summary: fullText } });
  } catch (error) {
    writeSSE(res, { type: 'error', error: error instanceof Error ? error.message : 'AI request failed' });
  }
  res.end();
});
