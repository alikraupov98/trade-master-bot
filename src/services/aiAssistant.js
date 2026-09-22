import AIChat from '../models/AIChat.js';
import AITemplate from '../models/AITemplate.js';
import { buildMentorSystemPrompt } from '../ai/prompts/mentor.js';
import { languageReminderMessage } from '../ai/prompts/shared.js';
import { getRagContext } from './ragService.js';
import { getAIResponseStream } from './aiProviderService.js';
import { AI_CONTEXT_MESSAGE_LIMIT } from '../config/constants.js';
import logger from '../utils/errorHandler.js';

/**
 * Находит (или создаёт) активный чат-документ AI-наставника для пользователя.
 */
async function getOrCreateChat(userId, role = 'mentor') {
  let chat = await AIChat.findOne({ user: userId, role }).sort({ updatedAt: -1 });
  if (!chat) {
    chat = await AIChat.create({ user: userId, role, messages: [] });
  }
  return chat;
}

/**
 * Основная функция диалога с AI-наставником, со стримингом ответа.
 * onChunk(partialText) вызывается по мере генерации — для editMessageText в Telegram.
 */
export async function askMentorStream({ user, userMessage, language = 'tg', onChunk }) {
  const chat = await getOrCreateChat(user._id, 'mentor');

  // Достаём релевантный контекст из базы знаний (RAG)
  const ragContext = await getRagContext(userMessage, { language }).catch((err) => {
    logger.warn('RAG-поиск не удался, продолжаем без контекста:', err.message);
    return '';
  });

  const systemPromptOverride = await AITemplate.findOne({ role: 'mentor', language, isActive: true })
    .sort({ updatedAt: -1 })
    .lean()
    .catch(() => null);

  const systemPrompt = buildMentorSystemPrompt({
    language,
    ragContext,
    userLevel: user.progress?.level || 1,
    overrideText: systemPromptOverride?.promptText || null,
  });

  // Берём последние N сообщений диалога для контекста
  const recentHistory = chat.messages.slice(-AI_CONTEXT_MESSAGE_LIMIT).map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const messages = [
    { role: 'system', content: systemPrompt },
    ...recentHistory,
    languageReminderMessage(language),
    { role: 'user', content: userMessage },
  ];

  const result = await getAIResponseStream({ messages, language, onChunk });

  // Сохраняем оба сообщения (пользователя и AI) в историю
  chat.messages.push({ role: 'user', content: userMessage });
  chat.messages.push({
    role: 'assistant',
    content: result.content,
    tokensUsed: result.tokensUsed || 0,
    provider: result.provider,
  });
  await chat.save();

  return result;
}

/**
 * Помечает последний ответ AI как хороший/плохой (для админ-аналитики и улучшения промптов).
 */
export async function rateLastResponse(userId, isGood) {
  const chat = await AIChat.findOne({ user: userId, role: 'mentor' }).sort({ updatedAt: -1 });
  if (!chat || chat.messages.length === 0) return false;

  const lastAssistantMsg = [...chat.messages].reverse().find((m) => m.role === 'assistant');
  if (!lastAssistantMsg) return false;

  lastAssistantMsg.ratedGood = isGood;
  await chat.save();
  return true;
}

/**
 * Возвращает текст последнего ответа AI-наставника (для кнопки "Озвучить").
 */
export async function getLastAssistantMessage(userId) {
  const chat = await AIChat.findOne({ user: userId, role: 'mentor' }).sort({ updatedAt: -1 }).lean();
  if (!chat || chat.messages.length === 0) return null;

  const lastAssistantMsg = [...chat.messages].reverse().find((m) => m.role === 'assistant');
  return lastAssistantMsg?.content || null;
}

export default { askMentorStream, rateLastResponse, getLastAssistantMessage };
