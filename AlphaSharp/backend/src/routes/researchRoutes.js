import express from 'express';
import axios from 'axios';
import { config } from '../config/env.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

const router = express.Router();
const client = axios.create({ baseURL: config.pythonApi.url, timeout: config.pythonApi.timeout });
for (const endpoint of ['snapshot', 'replay', 'evaluation']) {
  router.get(`/${endpoint}`, async (req, res) => {
    try {
      const response = await client.get(`/api/research/${endpoint}`, { params: req.query });
      successResponse(res, response.data);
    } catch (error) {
      errorResponse(res, error.response?.data?.detail || 'The research service is unavailable', error.response?.status || 502);
    }
  });
}
router.post('/brief', async (req, res) => {
  try {
    const response = await client.post('/api/research/brief', req.body, { timeout: config.pythonApi.aiTimeout });
    successResponse(res, response.data);
  } catch (error) {
    errorResponse(res, error.response?.data?.detail || 'The explanation could not be generated', error.response?.status || 502);
  }
});
export default router;
