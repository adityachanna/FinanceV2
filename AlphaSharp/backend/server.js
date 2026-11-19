import app from './src/app.js';
import { config } from './src/config/env.js';
import logger from './src/utils/logger.js';

process.on('uncaughtException', (err) => {
  logger.error(`UNCAUGHT EXCEPTION! Shutting down...`);
  logger.error(`${err.name}: ${err.message}`);
  logger.error(err.stack);
  process.exit(1);
});

const server = app.listen(config.port, () => {
  logger.info(`Server running in ${config.nodeEnv} mode on port ${config.port}`);
  logger.info(`Frontend URL: ${config.frontendUrl}`);
  logger.info(`Python API URL: ${config.pythonApi.url}`);
  logger.info('Demo mode: browser-local identity and in-memory API cache');
});

process.on('unhandledRejection', (err) => {
  logger.error(`UNHANDLED REJECTION! Shutting down...`);
  logger.error(`${err.name}: ${err.message}`);
  logger.error(err.stack);
  server.close(() => process.exit(1));
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  server.close(() => logger.info('Process terminated!'));
});
