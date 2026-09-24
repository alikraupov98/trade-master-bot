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

  try {
    await mongoose.connect(uri, {
      maxPoolSize: 20,
      serverSelectionTimeoutMS: 15000, // Увеличен таймаут ожидания ответа сервера
      socketTimeoutMS: 45000,          // Таймаут сокета
      
      // 🔥 ГЛАВНОЕ ИСПРАВЛЕНИЕ ДЛЯ FLY.IO + ATLAS SSL ERROR 80
      // Позволяет игнорировать проблемы с цепочкой сертификатов в контейнеризованной среде
      tlsAllowInvalidCertificates: true, 
      
      // Дополнительно: принудительно включаем TLS, если он не указан в URI явно
      ssl: true,
    });
    
    return mongoose.connection;
  } catch (error) {
    logger.error(`💥 Критическая ошибка при первичном подключении к MongoDB: ${error.message}`);
    throw error;
  }
}

export default mongoose;
