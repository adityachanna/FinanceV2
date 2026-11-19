import { config } from '../config/env.js';
import logger from '../utils/logger.js';

// Database-free TTL cache for the local demo. A future hosted version can swap this
// implementation for Redis or a persistent store without changing controller APIs.
const stockCache = new Map();
let marketRegimeCache = null;

const isFresh = (entry) => entry && entry.expiresAt > Date.now();
const stockKey = (ticker, endpoint) => `${ticker.toUpperCase()}:${endpoint}`;

export const cacheService = {
  async getStockCache(ticker, endpoint) {
    const key = stockKey(ticker, endpoint);
    const cached = stockCache.get(key);
    if (isFresh(cached)) {
      logger.debug(`Cache HIT: ${key}`);
      return { success: true, data: cached.data, cached: true, expiresAt: new Date(cached.expiresAt) };
    }
    if (cached) stockCache.delete(key);
    return { success: false, cached: false };
  },

  async setStockCache(ticker, endpoint, data) {
    const ttl = endpoint === 'analysis'
      ? config.cache.stockAnalysisTtl
      : endpoint === 'news' || endpoint.startsWith('news:')
        ? config.cache.marketNewsTtl
        : 300;
    const expiresAt = Date.now() + ttl * 1000;
    stockCache.set(stockKey(ticker, endpoint), { data, expiresAt });
    return { success: true, expiresAt: new Date(expiresAt) };
  },

  async getMarketRegimeCache() {
    if (isFresh(marketRegimeCache)) {
      return { success: true, data: marketRegimeCache.data, cached: true, expiresAt: new Date(marketRegimeCache.expiresAt) };
    }
    marketRegimeCache = null;
    return { success: false, cached: false };
  },

  async setMarketRegimeCache(regimeData) {
    const expiresAt = Date.now() + config.cache.marketRegimeTtl * 1000;
    marketRegimeCache = { data: regimeData, expiresAt };
    return { success: true, expiresAt: new Date(expiresAt) };
  },

  async clearStockCache(ticker) {
    const prefix = `${ticker.toUpperCase()}:`;
    for (const key of stockCache.keys()) if (key.startsWith(prefix)) stockCache.delete(key);
    return { success: true };
  },

  async clearExpiredCache() {
    let deleted = 0;
    for (const [key, entry] of stockCache.entries()) {
      if (!isFresh(entry)) { stockCache.delete(key); deleted += 1; }
    }
    if (marketRegimeCache && !isFresh(marketRegimeCache)) { marketRegimeCache = null; deleted += 1; }
    return { success: true, deleted };
  },

  async clearMarketRegimeCache() {
    const deleted = marketRegimeCache ? 1 : 0;
    marketRegimeCache = null;
    return { success: true, deleted };
  },
};

export default cacheService;
