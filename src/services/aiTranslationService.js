import { buildTranslatorSystemPrompt } from '../ai/prompts/translator.js';
import { getAIResponse } from './aiProviderService.js';
import logger from '../utils/errorHandler.js';

export async function translateText(text, targetLanguage = 'tg', { skipRateLimit = false } = {}) {
  if (!text?.trim()) return '';

  const result = await getAIResponse({
    messages: [
      { role: 'system', content: buildTranslatorSystemPrompt({ targetLanguage }) },
      { role: 'user', content: text },
    ],
    language: targetLanguage,
    useCache: true,
    skipRateLimit,
  });

  if (result.provider === 'none') {
    throw new Error('AI_UNAVAILABLE');
  }

  return result.content.trim();
}

export async function translateMultilingualField(field, { sourceLanguage = 'ru' } = {}) {
  const source = field?.[sourceLanguage];
  if (!source?.trim()) {
    logger.warn('translateMultilingualField: исходный текст пуст, перевод пропущен');
    return field;
  }

  const targets = ['tg', 'ru', 'en'].filter((lang) => lang !== sourceLanguage && !field[lang]?.trim());
  const translations = { ...field };

  for (const lang of targets) {
    try {
      translations[lang] = await translateText(source, lang);
    } catch (err) {
      logger.error(`Ошибка перевода на ${lang}:`, err);
    }
  }

  return translations;
}

export default { translateText, translateMultilingualField };
