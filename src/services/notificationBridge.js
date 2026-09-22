import redisClient from '../config/redis.js';
import logger from '../utils/errorHandler.js';

export const ADMIN_NOTIFICATIONS_CHANNEL = 'admin:notifications';

export async function publishAdminNotification(type, payload) {
  try {
    await redisClient.publish(
      ADMIN_NOTIFICATIONS_CHANNEL,
      JSON.stringify({ type, payload, timestamp: new Date().toISOString() }),
    );
  } catch (err) {
    logger.warn(`Не удалось опубликовать уведомление для админки: ${err.message}`);
  }
}

export default { publishAdminNotification, ADMIN_NOTIFICATIONS_CHANNEL };
