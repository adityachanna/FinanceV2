import express from 'express';
import { queryAgent, queryMarketBrief, getAiStatus } from '../controllers/agentController.js';
import { apiLimiter } from '../middlewares/rateLimiter.js';

const router = express.Router();

router.get('/status', getAiStatus);
router.post('/query', apiLimiter, queryAgent);
router.post('/market-brief', apiLimiter, queryMarketBrief);

export default router;

