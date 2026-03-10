import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import { initDb } from './db';
import { topicsRouter } from './routes/topics';
import { goalsRouter } from './routes/goals';
import { milestonesRouter } from './routes/milestones';
import { tasksRouter } from './routes/tasks';
import { deliverablesRouter } from './routes/deliverables';
import { updatesRouter } from './routes/updates';
import { aiRouter } from './routes/ai';
import { dashboardRouter } from './routes/dashboard';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize database
initDb();

// Middleware
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:3000'] }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// API Routes
app.use('/api/topics', topicsRouter);
app.use('/api/goals', goalsRouter);
app.use('/api/milestones', milestonesRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/deliverables', deliverablesRouter);
app.use('/api/updates', updatesRouter);
app.use('/api/ai', aiRouter);
app.use('/api/dashboard', dashboardRouter);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
