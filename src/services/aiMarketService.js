import { getMarketSnapshot } from './marketDataService.js';
import { getAIResponse } from './aiProviderService.js';
import { buildAnalystSystemPrompt } from '../ai/prompts/analyst.js';
import { languageReminderMessage } from '../ai/prompts/shared.js';
import AIMarketAnalysis from '../models/AIMarketAnalysis.js';
import logger from '../utils/errorHandler.js';

const NO_DATA_NOTICE = {
  tg: 'Маълумоти нархи зинда барои ин ҷуфт дастрас нест. Таҳлил бар асоси принсипҳои умумӣ хоҳад буд.',
  ru: 'Данные о текущей цене для этой пары недоступны. Разбор будет основан на общих принципах анализа.',
  en: 'Live price data for this pair is unavailable. The breakdown will be based on general analysis principles.',
};

/**
 * Генерирует AI-разбор рынка по указанной паре: подтягивает снапшот цены (если доступен)
 * и просит AI дать образовательный (не финансовый) анализ.
 */
export async function generateMarketAnalysis({ pair, userId, language = 'tg' }) {
  const snapshot = await getMarketSnapshot(pair).catch((err) => {
    logger.warn(`Не удалось получить снапшот рынка для ${pair}:`, err.message);
    return null;
  });

  const dataBlock = snapshot
    ? `Пара: ${snapshot.pair}\nЦена: $${snapshot.price}\nИзменение за 24ч: ${snapshot.change24h?.toFixed(2)}%\nОбъём за 24ч: $${Math.round(snapshot.volume24h || 0).toLocaleString()}`
    : `Пара: ${pair}\n${NO_DATA_NOTICE[language] || NO_DATA_NOTICE.tg}`;

  const messages = [
    { role: 'system', content: buildAnalystSystemPrompt({ language }) },
    languageReminderMessage(language),
    { role: 'user', content: `Дай образовательный разбор по паре ${pair}.\n\nДанные:\n${dataBlock}` },
  ];

  const result = await getAIResponse({ messages, language, useCache: true });

  // Сохраняем результат для админ-статистики и истории
  try {
    await AIMarketAnalysis.create({
      pair,
      user: userId || null,
      snapshot: snapshot || null,
      analysisText: result.content,
      provider: result.provider,
      tokensUsed: result.tokensUsed || 0,
    });
  } catch (err) {
    logger.warn('Не удалось сохранить AIMarketAnalysis:', err.message);
  }

  return { ...result, snapshot };
}

export default { generateMarketAnalysis };
