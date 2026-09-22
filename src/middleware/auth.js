import User from '../models/User.js';
import logger from '../utils/errorHandler.js';
import { creditSignupBonus } from '../services/referralService.js';

/**
 * Генерирует уникальный реферальный код на основе telegramId.
 */
function generateReferralCode(telegramId) {
  return `TM${telegramId.toString(36).toUpperCase()}`;
}

/**
 * Middleware: находит пользователя по telegramId или создаёт нового.
 * Кладёт документ пользователя в ctx.state.user.
 * Обновляет язык сессии из сохранённого языка пользователя (при первом сообщении в сессии).
 */
export function authMiddleware() {
  return async (ctx, next) => {
    try {
      const from = ctx.from;
      if (!from) return next();

      let user = await User.findOne({ telegramId: from.id });

      if (!user) {
        // Проверяем реферальный код в /start payload, если есть
        let referredBy = null;
        const startPayload = ctx.message?.text?.match(/^\/start\s+(.+)/)?.[1];
        if (startPayload && startPayload.startsWith('ref_')) {
          const refCode = startPayload.replace('ref_', '');
          const referrer = await User.findOne({ 'referral.code': refCode });
          if (referrer) {
            referredBy = referrer._id;
            referrer.referral.referralCount += 1;
            await referrer.save();
          }
        }

        try {
          user = await User.create({
            telegramId: from.id,
            username: from.username || null,
            firstName: from.first_name || '',
            lastName: from.last_name || '',
            language: 'tg',
            referral: {
              code: generateReferralCode(from.id),
              referredBy,
            },
          });
          ctx.state.isNewUser = true;
          if (referredBy) {
            creditSignupBonus(user._id).catch((err) => logger.warn('Ошибка начисления реферального бонуса:', err.message));
          }
        } catch (createErr) {
          // Гонка: два апдейта (например, два быстрых тапа) почти одновременно создают одного
          // и того же пользователя — второй падает на уникальном индексе telegramId.
          // В этом случае просто читаем уже созданного первым апдейтом пользователя.
          if (createErr.code === 11000) {
            user = await User.findOne({ telegramId: from.id });
            ctx.state.isNewUser = false;
          } else {
            throw createErr;
          }
        }
      } else {
        user.lastActiveAt = new Date();
        if (from.username && from.username !== user.username) user.username = from.username;
        await user.save();
        ctx.state.isNewUser = false;
      }

      if (user.isBanned) {
        const lang = user.language || 'tg';
        const msg = {
          tg: '🚫 Шумо аз бот манъ карда шудаед.',
          ru: '🚫 Вы заблокированы в боте.',
          en: '🚫 You are banned from this bot.',
        };
        await ctx.reply(msg[lang] || msg.tg);
        return;
      }

      ctx.state.user = user;

      // Синхронизируем язык сессии с сохранённым языком пользователя
      if (ctx.session && ctx.session.language !== user.language) {
        ctx.session.language = user.language;
      }

      return next();
    } catch (err) {
      logger.error('Ошибка authMiddleware:', err);
      // ВАЖНО: не вызываем next() без ctx.state.user — иначе AI-хендлеры упадут на
      // "Cannot read properties of undefined". Лучше вежливо попросить повторить попытку.
      const lang = user.language || 'tg';
      const msg = {
        tg: '⚠️ Хатогии муваққатӣ. Лутфан амалро такрор кунед.',
        ru: '⚠️ Временная ошибка. Пожалуйста, повторите действие.',
        en: '⚠️ Temporary error. Please try again.',
      };
      await ctx.reply(msg[lang] || msg.tg).catch(() => {});
      return;
    }
  };
}

export default authMiddleware;
