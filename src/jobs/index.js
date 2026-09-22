import cron from 'node-cron';
import { runSubscriptionCheck } from './subscriptionCheck.js';
import { runDailyMarketDigest } from './aiMarketDigest.js';
import { resolvePendingBattles } from '../services/gamificationService.js';
import { runAutoCourseGeneration } from './aiCourseAutoGenerator.js';
import logger from '../utils/errorHandler.js';

/**
 * Запускает все периодические задачи бота. Расписание задаётся в таймзоне Душанбе (Asia/Dushanbe).
 */
export function startCronJobs() {
  const timezone = process.env.TIMEZONE || 'Asia/Dushanbe';

  // Каждый день в 09:00 — проверка истекающих/истёкших подписок
  cron.schedule(
    '0 9 * * *',
    () => {
      runSubscriptionCheck().catch((err) => logger.error('Ошибка runSubscriptionCheck:', err));
    },
    { timezone },
  );

  // Каждый день в 08:00 — AI-дайджест рынка для Gold/Diamond
  cron.schedule(
    '0 8 * * *',
    () => {
      runDailyMarketDigest().catch((err) => logger.error('Ошибка runDailyMarketDigest:', err));
    },
    { timezone },
  );

  // Каждую минуту — разрешение "созревших" AI-баттлов (сравнение цены и начисление XP)
  cron.schedule(
    '* * * * *',
    () => {
      resolvePendingBattles().catch((err) => logger.error('Ошибка resolvePendingBattles:', err));
    },
    { timezone },
  );

  cron.schedule(
    '0 10 * * *',
    () => {
      runAutoCourseGeneration().catch((err) => logger.error('Ошибка runAutoCourseGeneration:', err));
    },
    { timezone },
  );

  logger.info(`⏰ Cron-задачи запланированы (таймзона: ${timezone})`);
}

export default startCronJobs;
