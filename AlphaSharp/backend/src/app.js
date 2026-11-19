import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/env.js';
import { requestLogger } from './middlewares/requestLogger.js';
import { errorHandler, notFound } from './middlewares/errorHandler.js';
import { generalLimiter } from './middlewares/rateLimiter.js';

import stockRoutes from './routes/stockRoutes.js';
import marketRoutes from './routes/marketRoutes.js';
import agentRoutes from './routes/agentRoutes.js';
import yahooRoutes from './routes/yahooRoutes.js';
import researchRoutes from './routes/researchRoutes.js';

const app = express();

app.use(helmet());
app.use(cors({
  origin: [config.frontendUrl, 'http://localhost:5173', 'http://localhost:5174', 'http://127.0.0.1:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);
app.use('/api', generalLimiter);

app.get('/', (req, res) => {
  res.json({ success: true, message: 'AlphaSharp API Server', version: '1.0.0', status: 'online', timestamp: new Date().toISOString() });
});

app.get('/health', (req, res) => {
  res.json({ success: true, status: 'healthy', uptime: process.uptime(), timestamp: new Date().toISOString() });
});

// The demo keeps identity and watchlists in the browser. These routes are intentionally data-only.
app.use('/api/stocks', stockRoutes);
app.use('/api/market', marketRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/yahoo', yahooRoutes);
app.use('/api/research', researchRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
