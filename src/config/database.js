import mongoose from 'mongoose';
import logger from '../utils/errorHandler.js';

export async function connectDatabase() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/trademaster_ai_tj';

  mongoose.set('strictQuery', true);

  mongoose.connection.on('connected', () => {
    logger.info('✅ MongoDB подключена');
  });

  mongoose.connection.on('error', (err) => {
    logger.error(`❌ Ошибка MongoDB: ${err?.message || err}`, err);
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('⚠️ MongoDB отключена, повторное подключение...');
  });

  let attempt = 0;
  while (true) {
    attempt += 1;
    try {
      await mongoose.connect(uri, {
        maxPoolSize: 20,
        serverSelectionTimeoutMS: 10000,
      });
      return mongoose.connection;
    } catch (err) {
      const delay = Math.min(30_000, 2_000 * attempt);
      logger.error(
        `❌ Не удалось подключиться к MongoDB (попытка ${attempt}): ${err?.message || err}. Повтор через ${Math.round(delay / 1000)}с...`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

export default mongoose;
