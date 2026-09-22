import { Router } from 'express';
import User from '../../src/models/User.js';
import bot from '../../src/config/bot.js';
import Notification from '../../src/models/Notification.js';
import { requireAdminAuth } from './authGuard.js';
import logger from '../../src/utils/errorHandler.js';

const router = Router();

router.get('/broadcasts', requireAdminAuth, async (req, res) => {
  const recentBroadcasts = await Notification.aggregate([
    { $match: { type: 'broadcast' } },
    { $group: { _id: '$text', sentAt: { $max: '$sentAt' }, count: { $sum: 1 } } },
    { $sort: { sentAt: -1 } },
    { $limit: 10 },
  ]);

  res.render('broadcasts', { recentBroadcasts, result: null });
});

/**
 * Отправляет рассылку сегменту пользователей. Выполняется с троттлингом (Telegram лимит ~30 msg/sec),
 * поэтому для больших баз рекомендуется запускать через очередь (BullMQ) — здесь простая реализация
 * с задержкой между отправками, подходящая для баз до нескольких тысяч пользователей.
 */
router.post('/broadcasts/send', requireAdminAuth, async (req, res) => {
  const { text, segment } = req.body;

  const query = { isBanned: false };
  if (segment && segment !== 'all') {
    query['subscription.plan'] = segment;
  }

  const users = await User.find(query).select('telegramId');
  let sent = 0;
  let failed = 0;

  for (const user of users) {
    try {
      await bot.telegram.sendMessage(user.telegramId, text, { parse_mode: 'Markdown' });
      await Notification.create({ user: user._id, type: 'broadcast', text, delivered: true });
      sent += 1;
    } catch (err) {
      failed += 1;
      logger.warn(`Не удалось отправить рассылку пользователю ${user.telegramId}: ${err.message}`);
    }
    // Небольшая задержка, чтобы не упереться в лимиты Telegram (≈30 сообщений/сек)
    await new Promise((resolve) => setTimeout(resolve, 35));
  }

  const recentBroadcasts = await Notification.aggregate([
    { $match: { type: 'broadcast' } },
    { $group: { _id: '$text', sentAt: { $max: '$sentAt' }, count: { $sum: 1 } } },
    { $sort: { sentAt: -1 } },
    { $limit: 10 },
  ]);

  res.render('broadcasts', { recentBroadcasts, result: { sent, failed, total: users.length } });
});

export default router;
