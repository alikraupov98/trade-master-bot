import Redis from 'ioredis';
import logger from '../utils/errorHandler.js';

// Проверяем, есть ли полная строка подключения (например, от Upstash для облака)
const redisUrl = process.env.REDIS_URL;

let redisConfig;
if (redisUrl) {
  // ioredis отлично понимает строки вида redis://default:password@host:port
  redisConfig = redisUrl;
} else {
  // Фолбэк для локальной разработки (Termux)
  redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT || 6379),
    password: process.env.REDIS_PASSWORD || undefined,
    db: Number(process.env.REDIS_DB || 0),
    maxRetriesPerRequest: null, // требование BullMQ
  };
}

const redisClient = new Redis(redisConfig);

redisClient.on('connect', () => logger.info('✅ Redis подключён'));
redisClient.on('error', (err) => logger.error('❌ Ошибка Redis:', err));

// Отдельная конфигурация подключения для BullMQ
export const bullConnection = redisUrl ? redisUrl : {
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT || 6379),
  password: process.env.REDIS_PASSWORD || undefined,
  db: Number(process.env.REDIS_DB || 0),
  maxRetriesPerRequest: null,
};

export default redisClient;
