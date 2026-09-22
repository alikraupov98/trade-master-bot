import Referral from '../models/Referral.js';
import User from '../models/User.js';
import bot from '../config/bot.js';
import logger from '../utils/errorHandler.js';

const SIGNUP_BONUS_DAYS = 3;
const FIRST_PAYMENT_BONUS_DAYS = 7;

const NOTIFY_TEXT = {
  tg: (days) => `🎁 Дӯсти шумо ба бот пайваст шуд! Шумо ${days} рӯзи бонусии обунаро гирифтед.`,
  ru: (days) => `🎁 Ваш друг присоединился к боту! Вы получили ${days} бонусных дней подписки.`,
  en: (days) => `🎁 Your friend joined the bot! You received ${days} bonus subscription days.`,
};

/** Начисляет бонус рефереру при регистрации нового пользователя по его ссылке. */
export async function creditSignupBonus(referredUserId) {
  const referredUser = await User.findById(referredUserId);
  if (!referredUser?.referral?.referredBy) return null;

  const referrer = await User.findById(referredUser.referral.referredBy);
  if (!referrer) return null;

  await Referral.create({
    referrer: referrer._id,
    referredUser: referredUser._id,
    rewardType: 'bonus_days',
    rewardAmount: SIGNUP_BONUS_DAYS,
    triggeredBy: 'signup',
    status: 'credited',
  });

  await extendSubscriptionByDays(referrer._id, SIGNUP_BONUS_DAYS);

  try {
    await bot.telegram.sendMessage(referrer.telegramId, NOTIFY_TEXT[referrer.language](SIGNUP_BONUS_DAYS));
  } catch (err) {
    logger.warn(`Не удалось уведомить реферера ${referrer.telegramId}: ${err.message}`);
  }

  return { referrer, days: SIGNUP_BONUS_DAYS };
}

/** Начисляет более крупный бонус рефереру при первой оплате приглашённого. */
export async function creditFirstPaymentBonus(referredUserId, paymentId) {
  const referredUser = await User.findById(referredUserId);
  if (!referredUser?.referral?.referredBy) return null;

  const alreadyCredited = await Referral.findOne({
    referredUser: referredUserId,
    triggeredBy: 'first_payment',
  });
  if (alreadyCredited) return null;

  const referrer = await User.findById(referredUser.referral.referredBy);
  if (!referrer) return null;

  await Referral.create({
    referrer: referrer._id,
    referredUser: referredUser._id,
    rewardType: 'bonus_days',
    rewardAmount: FIRST_PAYMENT_BONUS_DAYS,
    triggeredBy: 'first_payment',
    payment: paymentId,
    status: 'credited',
  });

  await extendSubscriptionByDays(referrer._id, FIRST_PAYMENT_BONUS_DAYS);

  try {
    await bot.telegram.sendMessage(referrer.telegramId, NOTIFY_TEXT[referrer.language](FIRST_PAYMENT_BONUS_DAYS));
  } catch (err) {
    logger.warn(`Не удалось уведомить реферера ${referrer.telegramId}: ${err.message}`);
  }

  return { referrer, days: FIRST_PAYMENT_BONUS_DAYS };
}

async function extendSubscriptionByDays(userId, days) {
  const user = await User.findById(userId);
  if (!user) return;

  const now = new Date();
  const base = user.subscription.expiresAt && user.subscription.expiresAt > now ? user.subscription.expiresAt : now;
  const newExpiry = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);

  // Если у пользователя ещё нет платного тарифа, бонусные дни дают базовый silver-доступ
  if (user.subscription.plan === 'free') {
    user.subscription.plan = 'silver';
  }
  user.subscription.expiresAt = newExpiry;
  await user.save();
}

/** Возвращает сводку по рефералам пользователя для профиля/раздела "Реферал". */
export async function getReferralStats(userId) {
  const [count, referrals] = await Promise.all([
    Referral.countDocuments({ referrer: userId }),
    Referral.find({ referrer: userId }).sort({ createdAt: -1 }).limit(10).lean(),
  ]);
  const totalBonusDays = referrals.reduce((sum, r) => sum + (r.rewardAmount || 0), 0);
  return { count, totalBonusDays, recent: referrals };
}

export default { creditSignupBonus, creditFirstPaymentBonus, getReferralStats };
