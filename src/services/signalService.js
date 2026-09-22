import Signal from '../models/Signal.js';
import User from '../models/User.js';
import bot from '../config/bot.js';
import { hasAccessToPlan } from './courseService.js';
import logger from '../utils/errorHandler.js';

const DIRECTION_LABEL = {
  tg: { long: '📈 ЛОНГ (харид)', short: '📉 ШОРТ (фурӯш)' },
  ru: { long: '📈 ЛОНГ (покупка)', short: '📉 ШОРТ (продажа)' },
  en: { long: '📈 LONG (buy)', short: '📉 SHORT (sell)' },
};

const DISCLAIMER = {
  tg: '⚠️ Ин сигнал танҳо барои мақсадҳои таълимист, на маслиҳати молиявӣ. Хатари гум кардани маблағ вуҷуд дорад.',
  ru: '⚠️ Этот сигнал носит образовательный характер и не является финансовой рекомендацией. Существует риск потери средств.',
  en: '⚠️ This signal is for educational purposes only and is not financial advice. There is a risk of losing funds.',
};

export function formatSignalMessage(signal, lang = 'tg') {
  const dir = DIRECTION_LABEL[lang]?.[signal.direction] || DIRECTION_LABEL.tg[signal.direction];
  const desc = signal.description?.get?.(lang) || signal.description?.[lang] || '';
  return (
    `🔔 *Сигнали нав / Новый сигнал*\n\n` +
    `💱 Пара: *${signal.pair}*\n` +
    `${dir}\n` +
    `⏱ Timeframe: ${signal.timeframe}\n\n` +
    `🎯 Entry: ${signal.entryPrice}\n` +
    `🛑 Stop-Loss: ${signal.stopLoss}\n` +
    `✅ Take-Profit: ${signal.takeProfit.join(', ')}\n\n` +
    `${desc ? desc + '\n\n' : ''}` +
    `${DISCLAIMER[lang] || DISCLAIMER.tg}`
  );
}

/** Создаёт сигнал и рассылает его всем пользователям с достаточным тарифом. */
export async function createAndBroadcastSignal(signalData, adminId) {
  const signal = await Signal.create({ ...signalData, createdBy: adminId });

  const eligibleUsers = await User.find({
    isBanned: false,
  }).select('telegramId language subscription.plan');

  let sent = 0;
  for (const user of eligibleUsers) {
    if (!hasAccessToPlan(user.subscription.plan, signal.requiredPlan)) continue;
    try {
      await bot.telegram.sendMessage(user.telegramId, formatSignalMessage(signal, user.language), {
        parse_mode: 'Markdown',
      });
      sent += 1;
    } catch (err) {
      logger.warn(`Не удалось отправить сигнал пользователю ${user.telegramId}: ${err.message}`);
    }
  }

  logger.info(`📊 Сигнал ${signal.pair} разослан ${sent}/${eligibleUsers.length} пользователям`);
  return { signal, sent };
}

/** Список активных сигналов, доступных пользователю по его тарифу. */
export async function getActiveSignalsForUser(userPlan) {
  const signals = await Signal.find({ status: 'active' }).sort({ createdAt: -1 }).limit(10).lean();
  return signals.filter((s) => hasAccessToPlan(userPlan, s.requiredPlan));
}

export default { createAndBroadcastSignal, getActiveSignalsForUser, formatSignalMessage };
