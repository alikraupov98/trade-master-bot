import mongoose from 'mongoose';
import logger from '../utils/errorHandler.js';

export async function connectDatabase() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/trademaster_ai_tj';

  // Настройки подключения
  const options = {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    
    // 🔥 КРИТИЧЕСКИ ВАЖНО ДЛЯ FLY.IO + ATLAS SSL ERROR 80
    // Игнорируем ошибки проверки сертификатов в контейнеризованной среде
    tlsAllowInvalidCertificates: true, 
    
    // Явно указываем использовать TLS (Atlas требует этого)
    ssl: true,
    
    // Отключаем строгую проверку имени хоста, если есть проблемы с DNS/SNI
    tlsAllowInvalidHostnames: true,
  };

  try {
    await mongoose.connect(uri, options);
    logger.info('✅ MongoDB подключена успешно');
    return mongoose.connection;
  } catch (error) {
    logger.error(`❌ Ошибка подключения к MongoDB: ${error.message}`);
    throw error;
  }
}

export default mongoose;
