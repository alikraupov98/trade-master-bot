import { SUBSCRIPTION_PLANS } from '../config/constants.js';

const TEXT = {
  tg: (u, limit) =>
    `👤 *Профили шумо*\n\n` +
    `Ном: ${u.firstName}\n` +
    `Тариф: *${u.subscription.plan}*${u.subscription.expiresAt ? `\nМӯҳлат то: ${new Date(u.subscription.expiresAt).toLocaleDateString()}` : ''}\n\n` +
    `🏆 Сатҳ: ${u.progress.level} (${u.progress.xp} XP)\n` +
    `📚 Дарсҳои хатмшуда: ${u.progress.completedLessons.length}\n\n` +
    `🤖 AI-дархостҳо имрӯз: ${u.aiUsage.requestsToday}/${limit === Infinity ? '∞' : limit}`,
  ru: (u, limit) =>
    `👤 *Ваш профиль*\n\n` +
    `Имя: ${u.firstName}\n` +
    `Тариф: *${u.subscription.plan}*${u.subscription.expiresAt ? `\nДействует до: ${new Date(u.subscription.expiresAt).toLocaleDateString()}` : ''}\n\n` +
    `🏆 Уровень: ${u.progress.level} (${u.progress.xp} XP)\n` +
    `📚 Уроков пройдено: ${u.progress.completedLessons.length}\n\n` +
    `🤖 AI-запросов сегодня: ${u.aiUsage.requestsToday}/${limit === Infinity ? '∞' : limit}`,
  en: (u, limit) =>
    `👤 *Your profile*\n\n` +
    `Name: ${u.firstName}\n` +
    `Plan: *${u.subscription.plan}*${u.subscription.expiresAt ? `\nValid until: ${new Date(u.subscription.expiresAt).toLocaleDateString()}` : ''}\n\n` +
    `🏆 Level: ${u.progress.level} (${u.progress.xp} XP)\n` +
    `📚 Lessons completed: ${u.progress.completedLessons.length}\n\n` +
    `🤖 AI requests today: ${u.aiUsage.requestsToday}/${limit === Infinity ? '∞' : limit}`,
};

export function registerProfileHandler(bot) {
  const showProfile = async (ctx) => {
    const lang = ctx.state.user?.language || 'tg';
    const user = ctx.state.user;
    const planConfig = SUBSCRIPTION_PLANS[user.subscription.plan.toUpperCase()] || SUBSCRIPTION_PLANS.FREE;
    const limit = planConfig.aiRequestsPerDay === -1 ? Infinity : planConfig.aiRequestsPerDay;
    await ctx.replyWithMarkdown((TEXT[lang] || TEXT.tg)(user, limit));
  };

  bot.command('profile', showProfile);
  bot.hears(['👤 Профил', '👤 Профиль', '👤 Profile'], showProfile);
}

export default registerProfileHandler;
