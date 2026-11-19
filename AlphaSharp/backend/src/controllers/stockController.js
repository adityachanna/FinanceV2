import pythonApiService from '../services/pythonApiService.js';
import yahooFinanceService from '../services/yahooFinanceService.js';
import cacheService from '../services/cacheService.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';
import logger from '../utils/logger.js';

// @desc    Get stock analysis
// @route   GET /api/stocks/:ticker/analysis
// @access  Public (optionalAuth for search history)
export const getStockAnalysis = async (req, res) => {
  try {
    const { ticker } = req.params;

    // Check cache first
    const cached = await cacheService.getStockCache(ticker, 'analysis');
    
    if (cached.success && cached.cached) {

      return successResponse(res, {
        ...cached.data,
        _cached: true,
        _expiresAt: cached.expiresAt,
      }, 'Stock analysis retrieved from cache');
    }

    // Fetch from Python API
    const result = await pythonApiService.getStockAnalysis(ticker);

    if (!result.success) {
      return errorResponse(res, result.error, 500);
    }

    // Cache the result (historical data fetching is optional and handled separately)
    await cacheService.setStockCache(ticker, 'analysis', result.data);

    successResponse(res, {
      ...result.data,
      _cached: false,
    }, 'Stock analysis retrieved successfully');
  } catch (error) {
    logger.error(`Get stock analysis error: ${error.message}`);
    errorResponse(res, 'Failed to fetch stock analysis', 500);
  }
};

// @desc    Get stock news
// @route   GET /api/stocks/:ticker/news
// @access  Public
export const getStockNews = async (req, res) => {
  try {
    const { ticker } = req.params;
    const { max_news = 5 } = req.query;
    const limit = Number(max_news);
    if (!Number.isInteger(limit) || limit < 1 || limit > 20) {
      return errorResponse(res, 'Request between 1 and 20 news articles', 400);
    }
    const newsKey = `news:${limit}`;

    // Check cache
    const cached = req.query.refresh === 'true' ? { success: false } : await cacheService.getStockCache(ticker, newsKey);
    
    if (cached.success && cached.cached) {
      return successResponse(res, {
        ...cached.data,
        _cached: true,
        _expiresAt: cached.expiresAt,
      }, 'Stock news retrieved from cache');
    }

    // Fetch from Python API
    const result = await pythonApiService.getStockNews(ticker, limit);

    if (!result.success) {
      return errorResponse(res, result.error, result.status || 502);
    }

    // Cache the result
    if (result.data.news_data?.length) await cacheService.setStockCache(ticker, newsKey, result.data);

    successResponse(res, {
      ...result.data,
      _cached: false,
    }, 'Stock news retrieved successfully');
  } catch (error) {
    logger.error(`Get stock news error: ${error.message}`);
    errorResponse(res, 'Failed to fetch stock news', 500);
  }
};

// @desc    Search ticker
// @route   GET /api/stocks/search
// @access  Public
export const searchTicker = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length === 0) {
      return errorResponse(res, 'Search query is required', 400);
    }

    const result = await pythonApiService.searchTicker(q);

    if (!result.success) {
      return errorResponse(res, result.error, 500);
    }

    successResponse(res, result.data, 'Search results retrieved successfully');
  } catch (error) {
    logger.error(`Search ticker error: ${error.message}`);
    errorResponse(res, 'Failed to search tickers', 500);
  }
};

// @desc    Get historical stock prices (Yahoo Finance)
// @route   GET /api/stocks/:ticker/history
// @access  Public
export const getHistoricalPrices = async (req, res) => {
  try {
    const { ticker } = req.params;
    const { period = '3mo', interval = '1d' } = req.query;

    // Check cache first
    const historyKey = `history:${period}:${interval}`;
    const cached = await cacheService.getStockCache(ticker, historyKey);
    
    if (cached.success && cached.cached) {
      return successResponse(res, {
        ...cached.data,
        _cached: true,
        _expiresAt: cached.expiresAt,
      }, 'Historical prices retrieved from cache');
    }

    // Fetch from Yahoo Finance directly
    const result = await yahooFinanceService.getHistoricalData(ticker, period, interval);

    if (!result.success) {
      return errorResponse(res, result.error, 500);
    }

    // Cache the result (1 hour TTL for historical data)
    await cacheService.setStockCache(ticker, historyKey, result.data);

    successResponse(res, {
      ...result.data,
      _cached: false,
    }, 'Historical prices retrieved successfully');
  } catch (error) {
    logger.error(`Get historical prices error: ${error.message}`);
    errorResponse(res, 'Failed to fetch historical prices', 500);
  }
};

