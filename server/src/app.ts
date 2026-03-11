import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { topicsRouter } from './routes/topics';
import { goalsRouter } from './routes/goals';
import { milestonesRouter } from './routes/milestones';
import { tasksRouter } from './routes/tasks';
import { deliverablesRouter } from './routes/deliverables';
import { updatesRouter } from './routes/updates';
import { aiRouter } from './routes/ai';
import { dashboardRouter } from './routes/dashboard';

dotenv.config();

export const app = express();

app.use(cors({ origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173', 'http://localhost:3000'] }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/topics', topicsRouter);
app.use('/api/goals', goalsRouter);
app.use('/api/milestones', milestonesRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/deliverables', deliverablesRouter);
app.use('/api/updates', updatesRouter);
app.use('/api/ai', aiRouter);
app.use('/api/dashboard', dashboardRouter);

app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));
