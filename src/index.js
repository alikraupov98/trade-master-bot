import 'dotenv/config';
import express from 'express';
import bot from './config/bot.js';
import { connectDatabase } from './config/database.js';
import redisClient from './config/redis.js';
import logger from './utils/errorHandler.js';
import { authMiddleware } from './middleware/auth.js';
import { registerStartHandler } from './handlers/start.js';
import { registerAIChatHandler } from './handlers/aiChat.js';
import { registerAIAnalysisHandler } from './handlers/aiAnalysis.js';
import { registerCoursesHandler } from './handlers/courses.js';
import { registerLessonsHandler } from './handlers/lessons.js';
import { registerSubscriptionHandler } from './handlers/subscription.js';
import { registerPaymentHandler } from './handlers/payment.js';
import { registerSignalsHandler } from './handlers/signals.js';
import { registerQuizHandler } from './handlers/quiz.js';
import { registerReferralsHandler } from './handlers/referrals.js';
import { registerSupportHandler } from './handlers/support.js';
import { registerCalculatorHandler } from './handlers/calculator.js';
import { registerGlossaryHandler } from './handlers/glossary.js';
import { registerProfileHandler } from './handlers/profile.js';
import { registerAIVisionHandler } from './handlers/aiVision.js';
import { registerAIVoiceHandler } from './handlers/aiVoice.js';
import { registerGamificationHandler } from './handlers/gamification.js';
import { startCronJobs } from './jobs/index.js';

const HEALTH_PORT = Number(process.env.HEALTH_PORT || 3001);

/**
 * Глобальная защита от краша всего процесса. Сторонние библиотеки (например, msedge-tts) иногда
 * бросают исключения из внутренних callback'ов асинхронных потоков — такие ошибки НЕ попадают
 * в обычный try/catch вызывающего кода и по умолчанию убивают весь Node-процесс (а значит и бот
 * для ВСЕХ пользователей сразу). Логируем и продолжаем работу вместо падения.
 */
function installCrashGuards() {
  process.on('uncaughtException', (err) => {
    logger.error(`❌ Необработанное исключение (процесс продолжает работу): ${err?.message || err}`, err);
  });
  process.on('unhandledRejection', (reason) => {
    const err = reason instanceof Error ? reason : new Error(String(reason));
    logger.error(`❌ Необработанный отказ промиса (процесс продолжает работу): ${err.message}`, err);
  });
}

/**
 * Поднимает мини Express-сервер только для health-check (используется Docker/оркестратором).
 */
function startHealthCheckServer() {
  const app = express();

  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  });

  const server = app.listen(HEALTH_PORT, () => {
    logger.info(`✅ Health-check сервер запущен на порту ${HEALTH_PORT}`);
  });

  return server;
}

async function bootstrap() {
  try {
    logger.info('🚀 Запуск TradeMaster AI TJ Bot...');

    installCrashGuards();

    await connectDatabase();
    logger.info('✅ Подключение к MongoDB установлено');

    await redisClient.ping();
    logger.info('✅ Подключение к Redis установлено');

    // Middleware
    bot.use(authMiddleware());

    // Регистрация хендлеров
    registerStartHandler(bot);
    registerAIChatHandler(bot);
    registerAIAnalysisHandler(bot);
    registerCoursesHandler(bot);
    registerLessonsHandler(bot);
    registerSubscriptionHandler(bot);
    registerPaymentHandler(bot);
    registerSignalsHandler(bot);
    registerQuizHandler(bot);
    registerReferralsHandler(bot);
    registerSupportHandler(bot);
    registerCalculatorHandler(bot);
    registerGlossaryHandler(bot);
    registerProfileHandler(bot);
    registerAIVisionHandler(bot);
    registerAIVoiceHandler(bot);
    registerGamificationHandler(bot);

    // TODO: по мере готовности подключить остальные хендлеры:
    // registerSettingsHandler(bot), registerCallbacksHandler(bot), registerAINewsHandler(bot)

    startCronJobs();

    const healthServer = startHealthCheckServer();

    await bot.launch();
    logger.info('🤖 Telegram-бот запущен и слушает обновления');

    // Graceful shutdown
    const shutdown = async (signal) => {
      logger.info(`⏹ Получен сигнал ${signal}, останавливаем бота...`);
      bot.stop(signal);
      healthServer.close();
      await redisClient.quit().catch(() => {});
      process.exit(0);
    };

    process.once('SIGINT', () => shutdown('SIGINT'));
    process.once('SIGTERM', () => shutdown('SIGTERM'));
  } catch (err) {
    logger.error('❌ Критическая ошибка при запуске:', err);
    process.exit(1);
  }
}

bootstrap();
