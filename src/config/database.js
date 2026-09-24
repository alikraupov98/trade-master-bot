import mongoose from 'mongoose';
import logger from '../utils/errorHandler.js';

export async function connectDatabase() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/trademaster_ai_tj';

  // Настройки подключения для Fly.io + MongoDB Atlas
  const options = {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
    
    // 🔥 КРИТИЧЕСКИ ВАЖНО ДЛЯ ОБХОДА SSL ALERT NUMBER 80
    
    // Включаем TLS (Atlas требует этого)
    ssl: true, 
    
    // Игнорируем ошибки верификации цепочки сертификатов
    tlsAllowInvalidCertificates: true, 
    
    // Игнорируем несоответствие имени хоста в сертификате
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
