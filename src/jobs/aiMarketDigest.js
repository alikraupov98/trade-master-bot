import User from '../models/User.js';
import bot from '../config/bot.js';
import { generateMarketAnalysis } from '../services/aiMarketService.js';
import logger from '../utils/errorHandler.js';

const TOP_PAIRS = ['BTCUSDT', 'ETHUSDT'];

const HEADER = {
  tg: '🌅 *AI-хулосаи бозори субҳ*',
  ru: '🌅 *Утренний AI-обзор рынка*',
  en: '🌅 *Morning AI market digest*',
};

/**
 * Раз в день генерирует AI-разбор топовых инструментов и рассылает пользователям
 * с тарифом Gold/Diamond (у них есть доступ к расширенной аналитике).
 */
export async function runDailyMarketDigest() {
  const analyses = {};
  for (const pair of TOP_PAIRS) {
    try {
      analyses[pair] = await generateMarketAnalysis({ pair, language: 'ru' });
    } catch (err) {
      logger.warn(`Не удалось сгенерировать дайджест для ${pair}: ${err.message}`);
    }
  }

  const users = await User.find({ 'subscription.plan': { $in: ['gold', 'diamond'] } }).select('telegramId language');
  let sent = 0;

  for (const user of users) {
    const lines = TOP_PAIRS.filter((p) => analyses[p]).map(
      (p) => `\n💱 *${p}*\n${analyses[p].content.slice(0, 400)}`,
    );
    if (!lines.length) continue;

    try {
      await bot.telegram.sendMessage(user.telegramId, `${HEADER[user.language] || HEADER.ru}\n${lines.join('\n')}`, {
        parse_mode: 'Markdown',
      });
      sent += 1;
    } catch (err) {
      logger.warn(`Не удалось отправить дайджест пользователю ${user.telegramId}: ${err.message}`);
    }
  }

  logger.info(`📰 Ежедневный AI-дайджест рынка отправлен ${sent}/${users.length} пользователям`);
}

export default runDailyMarketDigest;
