import api from './api';
import { API_TIMEOUT } from '../utils/constants';

export const agentService = {
  async getStatus() { return api.get('/agent/status'); },

  // Query AI agent
  async queryAgent(query, threadId = 'default_thread') {
    return api.post('/agent/query', {
      query,
      thread_id: threadId,
    }, { timeout: API_TIMEOUT.AI });
  },

  async queryMarketBrief(pulse, regime, headlines = []) {
    return api.post('/agent/market-brief', { pulse, regime, headlines }, { timeout: API_TIMEOUT.AI });
  },

};




