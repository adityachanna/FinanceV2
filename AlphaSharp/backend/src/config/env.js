import dotenv from 'dotenv';

dotenv.config();

export const config = {
  // Server
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Frontend
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  
  // Python API
  pythonApi: {
    url: process.env.PYTHON_API_URL || 'http://127.0.0.1:4000',
    timeout: parseInt(process.env.PYTHON_API_TIMEOUT) || 60000,
    aiTimeout: parseInt(process.env.PYTHON_AI_TIMEOUT) || 180000,
  },
  
  // Cache TTL (in seconds)
  cache: {
    stockAnalysisTtl: parseInt(process.env.CACHE_STOCK_ANALYSIS_TTL) || 300,
    marketNewsTtl: parseInt(process.env.CACHE_MARKET_NEWS_TTL) || 600,
    marketRegimeTtl: parseInt(process.env.CACHE_MARKET_REGIME_TTL) || 3600,
    forecastTtl: parseInt(process.env.CACHE_FORECAST_TTL) || 3600,
  },
  
  // Keep-Alive
  keepAlive: {
    enabled: process.env.ENABLE_KEEP_ALIVE === 'true',
    intervalMinutes: parseInt(process.env.KEEP_ALIVE_INTERVAL) || 13,
  },
  
  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000,
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 500,
  },
};


