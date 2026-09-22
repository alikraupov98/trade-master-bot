import { buildInteractiveLessonPrompt } from '../ai/prompts/teacher.js';
import { languageReminderMessage } from '../ai/prompts/shared.js';
import { getAIResponse } from './aiProviderService.js';
import Lesson from '../models/Lesson.js';
import logger from '../utils/errorHandler.js';

const COMPLETE_MARKER = '[LESSON_COMPLETE]';
const MAX_HISTORY_MESSAGES = 12;

/**
 * Генерирует следующее сообщение AI-учителя в интерактивном уроке.
 * history — массив [{role, content}] диалога (без system-сообщения).
 * Если ученик ещё не отвечал — history пустой, и AI сам начинает урок.
 * Возвращает { content, isComplete } — isComplete=true, если урок пройден (маркер найден и убран из текста).
 */
export async function generateInteractiveLessonTurn({ lessonId, language, history = [] }) {
  const lesson = await Lesson.findById(lessonId).lean();
  if (!lesson) throw new Error('LESSON_NOT_FOUND');

  const lessonTitle = lesson.title?.[language] || lesson.title?.tg || '';
  const lessonContent = lesson.content?.[language] || lesson.content?.tg || '';

  const systemPrompt = buildInteractiveLessonPrompt({
    language,
    lessonTitle,
    lessonContent,
    customPrompt: lesson.aiInteractivePrompt,
  });

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history.slice(-MAX_HISTORY_MESSAGES),
    languageReminderMessage(language),
  ];

  // Если это самое первое сообщение — просим AI начать урок явной командой
  if (history.length === 0) {
    messages.push({ role: 'user', content: '(Начни урок)' });
  }

  const result = await getAIResponse({ messages, language, useCache: false });

  const isComplete = result.content.includes(COMPLETE_MARKER);
  const cleanContent = result.content.replace(COMPLETE_MARKER, '').trim();

  return { content: cleanContent, isComplete, tokensUsed: result.tokensUsed, provider: result.provider };
}

export default { generateInteractiveLessonTurn };
