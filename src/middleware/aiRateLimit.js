import { SUBSCRIPTION_PLANS } from '../config/constants.js';
import User from '../models/User.js';

/**
 * Проверяет, не исчерпал ли пользователь дневной лимит AI-запросов по своему тарифу.
 * Сбрасывает счётчик при смене календарного дня.
 * Возвращает { allowed: boolean, remaining: number|'∞' }
 */
export async function checkUserAILimit(userDoc) {
  if (!userDoc || !userDoc.aiUsage) {
    // Защита от краша: если пользователь по какой-то причине не был загружен (сбой БД,
    // гонка при создании и т.п.) — не роняем бота, а просто блокируем запрос.
    return { allowed: false, remaining: 0 };
  }

  const today = new Date().toISOString().slice(0, 10);

  if (userDoc.aiUsage.lastResetDate !== today) {
    userDoc.aiUsage.requestsToday = 0;
    userDoc.aiUsage.lastResetDate = today;
    await userDoc.save(); // сохраняем сброс, иначе он потеряется и лимит не будет обнуляться корректно
  }

  const planKey = userDoc.subscription.plan.toUpperCase();
  const plan = SUBSCRIPTION_PLANS[planKey] || SUBSCRIPTION_PLANS.FREE;
  const limit = plan.aiRequestsPerDay;

  if (limit === -1) {
    return { allowed: true, remaining: '∞' };
  }

  if (userDoc.aiUsage.requestsToday >= limit) {
    return { allowed: false, remaining: 0 };
  }

  return { allowed: true, remaining: limit - userDoc.aiUsage.requestsToday };
}

/**
 * Инкрементирует счётчик использования AI после успешного ответа.
 */
export async function incrementUserAIUsage(userId, tokensUsed = 0) {
  await User.updateOne(
    { _id: userId },
    {
      $inc: { 'aiUsage.requestsToday': 1, 'aiUsage.totalRequests': 1, 'aiUsage.totalTokensUsed': tokensUsed },
    },
  );
}

// Telegraf middleware-обёртка для использования перед AI-хендлерами
export function aiRateLimitMiddleware() {
  return async (ctx, next) => {
    if (!ctx.state.user) return next();

    const { allowed, remaining } = await checkUserAILimit(ctx.state.user);
    if (!allowed) {
      const lang = ctx.state.user?.language || 'tg';
      const msg = {
        tg: '🚫 Лимити рӯзонаи AI-и шумо тамом шуд. Барои дастрасии бештар тарифро баланд кунед: /обуна',
        ru: '🚫 Ваш дневной лимит AI исчерпан. Повысьте тариф для большего доступа: /обуна',
        en: '🚫 Your daily AI limit is reached. Upgrade your plan for more access: /subscription',
      };
      await ctx.reply(msg[lang] || msg.tg);
      return;
    }

    ctx.state.aiRemaining = remaining;
    return next();
  };
}

export default { checkUserAILimit, incrementUserAIUsage, aiRateLimitMiddleware };
