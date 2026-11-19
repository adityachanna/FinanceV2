import express from 'express';
import {
  getStockAnalysis,
  getStockNews,
  searchTicker,
  getHistoricalPrices,
} from '../controllers/stockController.js';
import { apiLimiter } from '../middlewares/rateLimiter.js';
import axios from 'axios';
import { config } from '../config/env.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

const router = express.Router();

router.get('/search', apiLimiter, searchTicker);
router.get('/:ticker/analysis', apiLimiter, getStockAnalysis);
router.get('/:ticker/news', apiLimiter, getStockNews);
router.get('/:ticker/history', apiLimiter, getHistoricalPrices);
router.post('/:ticker/explain', apiLimiter, async (req, res) => {
  try {
    const result = await axios.post(`${config.pythonApi.url}/api/stock/${encodeURIComponent(req.params.ticker)}/explain`, {}, { timeout: config.pythonApi.aiTimeout });
    successResponse(res, result.data);
  } catch (error) {
    errorResponse(res, error.response?.data?.detail || 'The explanation could not be generated', error.response?.status || 502);
  }
});

export default router;
