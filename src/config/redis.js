import Redis from 'ioredis';
import logger from '../utils/errorHandler.js';

// Единый Redis-клиент для кэша, rate-limit, сессий и очередей
const redisClient = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT || 6379),
  password: process.env.REDIS_PASSWORD || undefined,
  db: Number(process.env.REDIS_DB || 0),
  maxRetriesPerRequest: null, // требование BullMQ
});

redisClient.on('connect', () => logger.info('✅ Redis подключён'));
redisClient.on('error', (err) => logger.error('❌ Ошибка Redis:', err));

// Отдельная конфигурация подключения для BullMQ (нужен отдельный объект)
export const bullConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT || 6379),
  password: process.env.REDIS_PASSWORD || undefined,
  db: Number(process.env.REDIS_DB || 0),
  maxRetriesPerRequest: null,
};

export default redisClient;
