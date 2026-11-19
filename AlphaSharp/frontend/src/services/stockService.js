import api from './api';

import { API_TIMEOUT } from '../utils/constants';

export const stockService = {
  async getStockAnalysis(ticker) { return api.get(`/stocks/${ticker}/analysis`); },
  async getStockNews(ticker, maxNews = 5, refresh = false) {
    return api.get(`/stocks/${ticker}/news`, { params: { max_news: maxNews, refresh } });
  },
  async getHistoricalPrices(ticker, period = '3mo') {
    return api.get(`/stocks/${ticker}/history`, { params: { period } });
  },
  async explain(ticker) { return api.post(`/stocks/${ticker}/explain`, {}, { timeout: API_TIMEOUT.AI }); },
  async searchTicker(query) { return api.get('/stocks/search', { params: { q: query } }); },
  async searchStock(query) { return this.searchTicker(query); },
  async getSearchHistory(limit = 10) {
    try {
      return JSON.parse(localStorage.getItem('alphasharp_search_history') || '[]').slice(0, limit);
    } catch {
      return [];
    }
  },
};
