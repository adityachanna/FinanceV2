import express from 'express';
import {
  getMarketCondition,
  getRegimeForecast,
  getShortTermPrediction,
  getAllRegimes,
  getRegimeHistory,
  getApiStatus,
  getMacroPulse,
} from '../controllers/marketController.js';
import { apiLimiter } from '../middlewares/rateLimiter.js';

const router = express.Router();

// All market routes are public
router.get('/condition', apiLimiter, getMarketCondition);
router.get('/forecast', apiLimiter, getRegimeForecast);
router.get('/forecast/short-term', apiLimiter, getShortTermPrediction);
router.get('/regimes', apiLimiter, getAllRegimes);
router.get('/history', apiLimiter, getRegimeHistory);
router.get('/status', getApiStatus);
router.get('/macro-pulse', apiLimiter, getMacroPulse);

export default router;



