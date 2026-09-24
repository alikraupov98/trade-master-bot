import mongoose from 'mongoose';
import logger from '../utils/errorHandler.js';

// Подключение к MongoDB с автоматическим переподключением
export async function connectDatabase() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/trademaster_ai_tj';

  mongoose.set('strictQuery', true);

  mongoose.connection.on('connected', () => {
    logger.info('✅ MongoDB подключена');
  });

  mongoose.connection.on('error', (err) => {
    logger.error('❌ Ошибка MongoDB:', err);
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('⚠️ MongoDB отключена, повторное подключение...');
  });

  await mongoose.connect(uri, {
    maxPoolSize: 20,
    serverSelectionTimeoutMS: 10000,
    tlsAllowInvalidCertificates: true,
    ssl: true,
  });

  return mongoose.connection;
}

export default mongoose;
