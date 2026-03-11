import { Router } from 'express';
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export const aiRouter = Router();

async function callClaude(prompt: string, maxTokens = 4096): Promise<string> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  });
  return response.content
    .filter(block => block.type === 'text')
    .map(block => (block as { type: 'text'; text: string }).text)
    .join('');
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

  try {
    const fullText = await callClaude(prompt);
    const jsonMatch = fullText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'No JSON in AI response' });
    res.json({ type: 'complete', data: JSON.parse(jsonMatch[0]) });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'AI request failed' });
  }
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

  try {
    const fullText = await callClaude(prompt);
    const jsonMatch = fullText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'No JSON in AI response' });
    res.json({ type: 'complete', data: JSON.parse(jsonMatch[0]) });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'AI request failed' });
  }
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

  try {
    const summary = await callClaude(prompt, 1024);
    res.json({ type: 'complete', data: { summary } });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'AI request failed' });
  }
});
