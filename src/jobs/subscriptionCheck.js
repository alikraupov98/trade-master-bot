import User from '../models/User.js';
import bot from '../config/bot.js';
import logger from '../utils/errorHandler.js';

const NOTICE_TEXT = {
  tg: (plan, days) => `⏰ Тарифи "${plan}"-и шумо баъд аз ${days} рӯз тамом мешавад. Барои идомаи дастрасӣ: /обуна`,
  ru: (plan, days) => `⏰ Ваш тариф "${plan}" истекает через ${days} дн. Продлите доступ: /обуна`,
  en: (plan, days) => `⏰ Your "${plan}" plan expires in ${days} days. Renew access: /subscription`,
};

const EXPIRED_TEXT = {
  tg: '⚠️ Мӯҳлати обунаи шумо тамом шуд. Тарифи шумо ба "Бепул" гузашт. Барои идома: /обуна',
  ru: '⚠️ Срок вашей подписки истёк. Тариф изменён на "Бесплатный". Чтобы продлить: /обуна',
  en: '⚠️ Your subscription has expired. Your plan has been reset to "Free". To renew: /subscription',
};

/**
 * Ежедневная проверка подписок: предупреждает за 3 дня до истечения, сбрасывает истёкшие на free.
 */
export async function runSubscriptionCheck() {
  const now = new Date();
  const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  // Предупреждение об истечении через ~3 дня
  const expiringSoon = await User.find({
    'subscription.expiresAt': { $gte: now, $lte: in3Days },
    'subscription.plan': { $ne: 'free' },
  });

  for (const user of expiringSoon) {
    const daysLeft = Math.ceil((user.subscription.expiresAt - now) / (24 * 60 * 60 * 1000));
    const text = (NOTICE_TEXT[user.language] || NOTICE_TEXT.tg)(user.subscription.plan, daysLeft);
    try {
      await bot.telegram.sendMessage(user.telegramId, text);
    } catch (err) {
      logger.warn(`Не удалось отправить напоминание о подписке ${user.telegramId}: ${err.message}`);
    }
  }

  // Сброс истёкших подписок на free
  const expired = await User.find({
    'subscription.expiresAt': { $lt: now },
    'subscription.plan': { $ne: 'free' },
  });

  for (const user of expired) {
    user.subscription.plan = 'free';
    user.subscription.expiresAt = null;
    await user.save();
    try {
      await bot.telegram.sendMessage(user.telegramId, EXPIRED_TEXT[user.language] || EXPIRED_TEXT.tg);
    } catch (err) {
      logger.warn(`Не удалось уведомить об истечении подписки ${user.telegramId}: ${err.message}`);
    }
  }

  logger.info(`✅ Проверка подписок: ${expiringSoon.length} предупреждений, ${expired.length} сброшено на free`);
}

export default runSubscriptionCheck;
