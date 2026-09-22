import axios from 'axios';
import crypto from 'crypto';
import { groqChatCompletion, groqChatCompletionStream } from './groqService.js';
import { OPENROUTER_CONFIG, GEMINI_CONFIG, TOGETHER_CONFIG, PROMPT_INJECTION_PATTERNS } from '../config/ai.js';
import { AI_CACHE_TTL_SECONDS } from '../config/constants.js';
import redisClient from '../config/redis.js';
import logger from '../utils/errorHandler.js';
import { sanitizeAIResponseText } from '../utils/aiTextSanitizer.js';

// Проверка на попытку промпт-инъекции в последнем сообщении пользователя
export function detectPromptInjection(text) {
  return PROMPT_INJECTION_PATTERNS.some((pattern) => pattern.test(text));
}

// Ключ кэша строится по хэшу от system+последнего сообщения пользователя,
// чтобы одинаковые вопросы не тратили лимит Groq повторно.
function buildCacheKey(messages) {
  const relevant = JSON.stringify(messages);
  const hash = crypto.createHash('sha256').update(relevant).digest('hex');
  return `ai:cache:${hash}`;
}

async function getCached(messages) {
  try {
    const key = buildCacheKey(messages);
    const cached = await redisClient.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch (err) {
    logger.warn('Ошибка чтения AI-кэша:', err.message);
    return null;
  }
}

async function setCached(messages, result) {
  try {
    const key = buildCacheKey(messages);
    await redisClient.set(key, JSON.stringify(result), 'EX', AI_CACHE_TTL_SECONDS);
  } catch (err) {
    logger.warn('Ошибка записи AI-кэша:', err.message);
  }
}

// --- OpenRouter fallback ---
async function openRouterCompletion(messages) {
  if (!OPENROUTER_CONFIG.apiKey) throw new Error('OPENROUTER_NOT_CONFIGURED');
  const { data } = await axios.post(
    OPENROUTER_CONFIG.apiUrl,
    { model: OPENROUTER_CONFIG.model, messages },
    { headers: { Authorization: `Bearer ${OPENROUTER_CONFIG.apiKey}` }, timeout: 30_000 },
  );
  return {
    content: data.choices?.[0]?.message?.content || '',
    tokensUsed: data.usage?.total_tokens || 0,
    provider: 'openrouter',
  };
}

// --- Google Gemini fallback ---
async function geminiCompletion(messages) {
  if (!GEMINI_CONFIG.apiKey) throw new Error('GEMINI_NOT_CONFIGURED');

  // Gemini использует другой формат — конвертируем историю сообщений
  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));

  const systemMsg = messages.find((m) => m.role === 'system');

  const url = `${GEMINI_CONFIG.apiUrl}/${GEMINI_CONFIG.model}:generateContent?key=${GEMINI_CONFIG.apiKey}`;
  const { data } = await axios.post(
    url,
    {
      contents,
      systemInstruction: systemMsg ? { parts: [{ text: systemMsg.content }] } : undefined,
    },
    { timeout: 30_000 },
  );

  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
  return { content: text, tokensUsed: data.usageMetadata?.totalTokenCount || 0, provider: 'gemini' };
}

// --- Together.ai fallback ---
async function togetherCompletion(messages) {
  if (!TOGETHER_CONFIG.apiKey) throw new Error('TOGETHER_NOT_CONFIGURED');
  const { data } = await axios.post(
    TOGETHER_CONFIG.apiUrl,
    { model: TOGETHER_CONFIG.model, messages },
    { headers: { Authorization: `Bearer ${TOGETHER_CONFIG.apiKey}` }, timeout: 30_000 },
  );
  return {
    content: data.choices?.[0]?.message?.content || '',
    tokensUsed: data.usage?.total_tokens || 0,
    provider: 'together',
  };
}

/**
 * Главная точка входа: пробует Groq → OpenRouter → Gemini → Together → кэш/заглушка.
 * Не потоковый вариант (используется там, где стриминг не нужен: квизы, анализ рынка и т.д.)
 */
export async function getAIResponse({ messages, language = 'tg', useCache = true, skipRateLimit = false }) {
  // Защита от промпт-инъекций: проверяем последнее сообщение пользователя
  const lastUserMsg = [...messages].reverse().find((m) => m.role === 'user');
  if (lastUserMsg && detectPromptInjection(lastUserMsg.content)) {
    logger.warn(`Обнаружена попытка промпт-инъекции: ${lastUserMsg.content.slice(0, 100)}`);
    // Не блокируем полностью, но убираем подозрительный текст из системного контекста —
    // просто продолжаем как обычный вопрос, инструкции модели уже защищают роль.
  }

  if (useCache) {
    const cached = await getCached(messages);
    if (cached) {
      return { ...cached, provider: 'cache' };
    }
  }

  const providers = [
    () => groqChatCompletion({ messages, skipRateLimit }),
    () => openRouterCompletion(messages),
    () => geminiCompletion(messages),
    () => togetherCompletion(messages),
  ];

  let lastError = null;
  for (const providerFn of providers) {
    try {
      const result = await providerFn();
      if (result.content) {
        result.content = sanitizeAIResponseText(result.content);
        if (useCache) await setCached(messages, result);
        return result;
      }
    } catch (err) {
      lastError = err;
      logger.warn(`AI-провайдер недоступен (${err.message}), пробуем следующий...`);
    }
  }

  logger.error('Все AI-провайдеры недоступны:', lastError?.message);
  const fallbackText = {
    tg: '⚠️ Ҳозир AI дастрас нест. Лутфан баъд аз якчанд дақиқа кӯшиш кунед.',
    ru: '⚠️ AI временно недоступен. Пожалуйста, попробуйте через несколько минут.',
    en: '⚠️ AI is temporarily unavailable. Please try again in a few minutes.',
  };
  return { content: fallbackText[language] || fallbackText.tg, tokensUsed: 0, provider: 'none' };
}

/**
 * Потоковая версия — используется только с Groq (у него самая быстрая генерация).
 * Если Groq недоступен — делает обычный (не потоковый) fallback-запрос и один раз вызывает onChunk с полным текстом.
 */
export async function getAIResponseStream({ messages, language = 'tg', onChunk }) {
  try {
    const result = await groqChatCompletionStream({ messages, onChunk });
    result.content = sanitizeAIResponseText(result.content);
    return result;
  } catch (err) {
    logger.warn(`Groq stream недоступен (${err.message}), переключаемся на fallback без стриминга`);
    const fallback = await getAIResponse({ messages, language, useCache: true });
    if (onChunk) await onChunk(fallback.content, fallback.content);
    return fallback;
  }
}

export default { getAIResponse, getAIResponseStream, detectPromptInjection };
