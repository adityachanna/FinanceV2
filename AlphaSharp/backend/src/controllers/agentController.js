import pythonApiService from '../services/pythonApiService.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';
import logger from '../utils/logger.js';
import yahooFinanceService from '../services/yahooFinanceService.js';

export const queryAgent = async (req, res) => {
  try {
    const { query, thread_id = 'default_thread' } = req.body;
    if (!query || query.trim().length === 0) return errorResponse(res, 'Query is required', 400);
    const result = await pythonApiService.queryAgent(query, thread_id);
    if (!result.success) return errorResponse(res, result.error, 500);
    successResponse(res, { ...result.data, thread_id }, 'Agent query processed successfully');
  } catch (error) {
    logger.error(`Query agent error: ${error.message}`);
    errorResponse(res, 'Failed to query AI agent', 500);
  }
};

export const queryMarketBrief = async (req, res) => {
  try {
    const [pulse, condition] = await Promise.all([yahooFinanceService.getMacroPulse(), pythonApiService.getMarketCondition()]);
    if (!condition.success) return errorResponse(res, condition.error, 502);
    const result = await pythonApiService.queryMarketBrief(pulse, condition.data, []);
    if (!result.success) return errorResponse(res, result.error, 502);
    successResponse(res, result.data, 'AI Market Brief generated');
  } catch (error) {
    logger.error(`Market brief proxy error: ${error.message}`);
    errorResponse(res, 'Failed to generate AI Market Brief', 502);
  }
};

export const getAiStatus = async (req, res) => {
  const result = await pythonApiService.getAiStatus();
  if (!result.success) return errorResponse(res, result.error, 502);
  successResponse(res, result.data, 'AI configuration status');
};

