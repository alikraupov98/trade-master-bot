import { Achievement, GameBattle } from '../models/Achievement.js';
import User from '../models/User.js';
import { QuizAttempt } from '../models/Quiz.js';
import { getReferralStats } from './referralService.js';
import { getMarketSnapshot } from './marketDataService.js';
import bot from '../config/bot.js';
import logger from '../utils/errorHandler.js';

const ACHIEVEMENT_CATALOG = {
  first_lesson: {
    icon: '🎓',
    title: { tg: 'Қадами аввал', ru: 'Первый шаг', en: 'First step' },
    description: { tg: 'Дарси якумро хатм кардед', ru: 'Завершили первый урок', en: 'Completed your first lesson' },
  },
  level_5: {
    icon: '⭐',
    title: { tg: 'Донишҷӯи фаъол', ru: 'Активный ученик', en: 'Active learner' },
    description: { tg: 'Ба сатҳи 5 расидед', ru: 'Достигли 5 уровня', en: 'Reached level 5' },
  },
  quiz_perfect: {
    icon: '💯',
    title: { tg: 'Санҷиши беҳтарин', ru: 'Идеальный тест', en: 'Perfect quiz' },
    description: { tg: 'Санҷишро бе хато гузаштед', ru: 'Прошли тест без единой ошибки', en: 'Passed a quiz with no mistakes' },
  },
  referral_5: {
    icon: '🎁',
    title: { tg: 'Дӯсти хуб', ru: 'Хороший друг', en: 'Great friend' },
    description: { tg: '5 нафарро даъват кардед', ru: 'Пригласили 5 человек', en: 'Invited 5 people' },
  },
  battle_winner: {
    icon: '🥊',
    title: { tg: 'Ғолиби AI-баттл', ru: 'Победитель AI-баттла', en: 'AI battle winner' },
    description: { tg: 'Дар AI-баттл бурдед', ru: 'Выиграли AI-баттл', en: 'Won an AI battle' },
  },
};

const UNLOCK_NOTICE = {
  tg: (icon, title) => `🏆 Дастоварди нав кушода шуд!\n\n${icon} *${title}*`,
  ru: (icon, title) => `🏆 Новое достижение открыто!\n\n${icon} *${title}*`,
  en: (icon, title) => `🏆 New achievement unlocked!\n\n${icon} *${title}*`,
};

async function unlockAchievement(user, code) {
  const def = ACHIEVEMENT_CATALOG[code];
  if (!def) return;

  const existing = await Achievement.findOne({ user: user._id, code });
  if (existing) return;

  await Achievement.create({
    user: user._id,
    code,
    title: def.title,
    description: def.description,
    icon: def.icon,
  });

  try {
    const title = def.title[user.language] || def.title.ru;
    await bot.telegram.sendMessage(user.telegramId, (UNLOCK_NOTICE[user.language] || UNLOCK_NOTICE.ru)(def.icon, title), {
      parse_mode: 'Markdown',
    });
  } catch (err) {
    logger.warn(`Не удалось уведомить о достижении ${user.telegramId}: ${err.message}`);
  }
}

/** Проверяет условия всех достижений для пользователя и открывает новые при выполнении. */
export async function checkAchievements(userId) {
  const user = await User.findById(userId);
  if (!user) return;

  if (user.progress.completedLessons.length >= 1) await unlockAchievement(user, 'first_lesson');
  if (user.progress.level >= 5) await unlockAchievement(user, 'level_5');

  const perfectQuiz = await QuizAttempt.findOne({
    user: userId,
    $expr: { $eq: ['$score', '$totalQuestions'] },
  });
  if (perfectQuiz) await unlockAchievement(user, 'quiz_perfect');

  const referralStats = await getReferralStats(userId);
  if (referralStats.count >= 5) await unlockAchievement(user, 'referral_5');
}

/** Список открытых достижений пользователя (для профиля). */
export async function getUserAchievements(userId) {
  return Achievement.find({ user: userId }).sort({ unlockedAt: -1 }).lean();
}

// ============================================================
// AI-БАТТЛ: пользователь угадывает движение цены за 5 минут
// ============================================================
const BATTLE_DURATION_MS = 5 * 60 * 1000;
const BATTLE_XP_REWARD = 15;

export async function startBattle({ userId, pair, guess }) {
  const snapshot = await getMarketSnapshot(pair);
  if (!snapshot) throw new Error('PRICE_UNAVAILABLE');

  const battle = await GameBattle.create({
    user: userId,
    pair,
    startPrice: snapshot.price,
    userGuess: guess,
    resolvesAt: new Date(Date.now() + BATTLE_DURATION_MS),
  });

  return battle;
}

const BATTLE_RESULT_TEXT = {
  tg: (win, pair, xp) => (win ? `🎉 Шумо бурдед! Нархи ${pair} дуруст ҳадс зада шуд. +${xp} XP` : `😔 Мутаассифона, шумо нобурд шудед. Ҳадси нарх нодуруст буд.`),
  ru: (win, pair, xp) => (win ? `🎉 Вы выиграли! Движение цены ${pair} угадано верно. +${xp} XP` : `😔 К сожалению, вы проиграли. Движение цены угадано неверно.`),
  en: (win, pair, xp) => (win ? `🎉 You won! ${pair} price movement guessed correctly. +${xp} XP` : `😔 Unfortunately, you lost. Price movement was guessed incorrectly.`),
};

/** Разрешает все "созревшие" баттлы: сравнивает текущую цену со стартовой, начисляет XP победителям. */
export async function resolvePendingBattles() {
  const now = new Date();
  const battles = await GameBattle.find({ result: 'pending', resolvesAt: { $lte: now } }).populate('user');

  for (const battle of battles) {
    try {
      const snapshot = await getMarketSnapshot(battle.pair);
      if (!snapshot) continue;

      const actualDirection = snapshot.price >= battle.startPrice ? 'up' : 'down';
      const won = actualDirection === battle.userGuess;

      battle.endPrice = snapshot.price;
      battle.result = won ? 'win' : 'lose';
      await battle.save();

      if (won && battle.user) {
        battle.user.progress.xp += BATTLE_XP_REWARD;
        battle.user.progress.level = Math.floor(battle.user.progress.xp / 100) + 1;
        await battle.user.save();
        await unlockAchievement(battle.user, 'battle_winner');
      }

      if (battle.user) {
        const lang = battle.user.language;
        await bot.telegram.sendMessage(
          battle.user.telegramId,
          (BATTLE_RESULT_TEXT[lang] || BATTLE_RESULT_TEXT.ru)(won, battle.pair, BATTLE_XP_REWARD),
        );
      }
    } catch (err) {
      logger.warn(`Не удалось разрешить баттл ${battle._id}: ${err.message}`);
    }
  }

  return battles.length;
}

export default { checkAchievements, getUserAchievements, startBattle, resolvePendingBattles, ACHIEVEMENT_CATALOG };
