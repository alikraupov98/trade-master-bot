import { getAIResponse } from './aiProviderService.js';
import { translateText } from './aiTranslationService.js';
import { buildCourseOutlinePrompt, buildLessonContentPrompt, buildQuizGenerationPrompt } from '../ai/prompts/courseAuthor.js';
import Course from '../models/Course.js';
import Lesson from '../models/Lesson.js';
import Quiz from '../models/Quiz.js';
import logger from '../utils/errorHandler.js';

function extractJSON(text) {
  const cleaned = text.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const startArr = cleaned.indexOf('[');
    const from = start === -1 ? startArr : startArr === -1 ? start : Math.min(start, startArr);
    const endBrace = cleaned.lastIndexOf('}');
    const endBracket = cleaned.lastIndexOf(']');
    const to = Math.max(endBrace, endBracket);
    if (from === -1 || to === -1) throw new Error('AI_JSON_PARSE_FAILED');
    return JSON.parse(cleaned.slice(from, to + 1));
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getPaceDelayMs() {
  const rpm = Number(process.env.GROQ_RATE_LIMIT_RPM || 30);
  const minDelay = 60000 / rpm;
  return Math.ceil(minDelay * 1.4);
}

async function callAIStrict(messages) {
  const result = await getAIResponse({ messages, language: 'ru', useCache: false, skipRateLimit: true });
  if (result.provider === 'none') {
    throw new Error('AI_UNAVAILABLE');
  }
  return result;
}

async function withRetry(fn, { retries = 2, label = 'операция' } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      if (attempt > 0) {
        const backoff = getPaceDelayMs() * (attempt + 1);
        logger.warn(`Повтор попытки ${attempt}/${retries} для "${label}" через ${backoff}мс...`);
        await sleep(backoff);
      }
      return await fn();
    } catch (err) {
      lastErr = err;
      logger.warn(`Попытка ${attempt + 1} для "${label}" не удалась: ${err.message}`);
    }
  }
  throw lastErr;
}

async function toAllLanguages(ruText) {
  const tg = await withRetry(() => translateText(ruText, 'tg', { skipRateLimit: true }), { retries: 1, label: 'перевод на tg' }).catch(
    () => ruText,
  );
  await sleep(getPaceDelayMs());
  const en = await withRetry(() => translateText(ruText, 'en', { skipRateLimit: true }), { retries: 1, label: 'перевод на en' }).catch(
    () => ruText,
  );
  await sleep(getPaceDelayMs());
  return { tg, ru: ruText, en };
}

async function generateAndSaveLesson({ courseId, courseTitle, outlineLesson, order, totalInBatch, indexInBatch }) {
  const contentResult = await withRetry(
    () =>
      callAIStrict([
        {
          role: 'user',
          content: buildLessonContentPrompt({
            courseTitle,
            lessonTitle: outlineLesson.title,
            lessonSummary: outlineLesson.summary,
            lessonNumber: indexInBatch + 1,
            totalLessons: totalInBatch,
          }),
        },
      ]),
    { retries: 2, label: `текст урока "${outlineLesson.title}"` },
  );

  await sleep(getPaceDelayMs());
  const titleLangs = await toAllLanguages(outlineLesson.title);
  const contentLangs = await toAllLanguages(contentResult.content);

  const lesson = await Lesson.create({
    course: courseId,
    title: titleLangs,
    content: contentLangs,
    type: 'text',
    order,
    generatedByAI: true,
  });

  try {
    await sleep(getPaceDelayMs());
    const quizResult = await withRetry(
      () => callAIStrict([{ role: 'user', content: buildQuizGenerationPrompt({ lessonTitle: outlineLesson.title, lessonContent: contentResult.content }) }]),
      { retries: 1, label: `квиз для "${outlineLesson.title}"` },
    );
    const quizData = extractJSON(quizResult.content);

    const optionsAll = [];
    for (const opt of quizData.options) {
      optionsAll.push(await toAllLanguages(opt));
    }
    const questionLangs = await toAllLanguages(quizData.question);

    await Quiz.create({
      lesson: lesson._id,
      questions: [{ text: questionLangs, options: optionsAll, correctIndex: quizData.correctIndex }],
      generatedByAI: true,
    });
  } catch (quizErr) {
    logger.warn(`Не удалось сгенерировать квиз для урока "${outlineLesson.title}" (урок всё равно сохранён): ${quizErr.message}`);
  }

  return lesson._id;
}

export async function generateFullCourse({ category, lessonCount = 5, requiredPlan = 'free' }) {
  logger.info(`🤖 Начинаю AI-генерацию курса: категория=${category}, уроков=${lessonCount}`);

  const outlineResult = await withRetry(
    () => callAIStrict([{ role: 'user', content: buildCourseOutlinePrompt({ category, lessonCount }) }]),
    { retries: 2, label: 'структура курса' },
  );
  const outline = extractJSON(outlineResult.content);

  if (!outline?.lessons?.length) {
    throw new Error('AI_COURSE_OUTLINE_EMPTY');
  }

  const existingCount = await Course.countDocuments({ category });

  await sleep(getPaceDelayMs());
  const titleAll = await toAllLanguages(outline.title);
  const descAll = await toAllLanguages(outline.description || '');

  const course = await Course.create({
    title: titleAll,
    description: descAll,
    category,
    requiredPlan,
    order: existingCount + 1,
    isPublished: true,
    generatedByAI: true,
  });

  const lessonIds = [];
  for (let i = 0; i < outline.lessons.length; i += 1) {
    try {
      await sleep(getPaceDelayMs());
      const lessonId = await withRetry(
        () =>
          generateAndSaveLesson({
            courseId: course._id,
            courseTitle: outline.title,
            outlineLesson: outline.lessons[i],
            order: i + 1,
            totalInBatch: outline.lessons.length,
            indexInBatch: i,
          }),
        { retries: 1, label: `урок ${i + 1} "${outline.lessons[i].title}"` },
      );
      lessonIds.push(lessonId);
      logger.info(`✅ Урок ${i + 1}/${outline.lessons.length} готов: "${outline.lessons[i].title}"`);
    } catch (lessonErr) {
      logger.error(`❌ Урок ${i + 1} "${outline.lessons[i].title}" не удалось сгенерировать даже после повторов: ${lessonErr.message}`);
    }
  }

  course.lessons = lessonIds;
  await course.save();

  if (lessonIds.length < outline.lessons.length) {
    logger.warn(`⚠️ Курс "${outline.title}" создан НЕПОЛНОСТЬЮ: ${lessonIds.length}/${outline.lessons.length} уроков. Можно дозагрузить остальные через "Добавить ещё уроки".`);
  } else {
    logger.info(`🎉 AI-курс "${outline.title}" полностью готов: ${lessonIds.length}/${outline.lessons.length} уроков`);
  }
  return course;
}

export async function generateMoreLessons({ courseId, lessonCount = 5 }) {
  const course = await Course.findById(courseId);
  if (!course) throw new Error('COURSE_NOT_FOUND');

  const existingLessons = await Lesson.find({ course: courseId }).sort({ order: 1 }).lean();
  const startOrder = existingLessons.length ? Math.max(...existingLessons.map((l) => l.order || 0)) + 1 : 1;
  const existingTitles = existingLessons.map((l) => l.title?.ru || l.title?.tg || '').filter(Boolean);

  logger.info(`🤖 Дополняю курс "${course.title.get('ru')}": +${lessonCount} уроков, начиная с №${startOrder}`);

  const outlineResult = await withRetry(
    () =>
      callAIStrict([
        { role: 'user', content: buildCourseOutlinePrompt({ category: course.category, lessonCount, existingLessonTitles: existingTitles }) },
      ]),
    { retries: 2, label: 'структура доп. уроков' },
  );
  const outline = extractJSON(outlineResult.content);

  if (!outline?.lessons?.length) {
    throw new Error('AI_COURSE_OUTLINE_EMPTY');
  }

  const courseTitleRu = course.title.get('ru');
  const newLessonIds = [];

  for (let i = 0; i < outline.lessons.length; i += 1) {
    try {
      await sleep(getPaceDelayMs());
      const lessonId = await withRetry(
        () =>
          generateAndSaveLesson({
            courseId: course._id,
            courseTitle: courseTitleRu,
            outlineLesson: outline.lessons[i],
            order: startOrder + i,
            totalInBatch: outline.lessons.length,
            indexInBatch: i,
          }),
        { retries: 1, label: `доп. урок ${i + 1} "${outline.lessons[i].title}"` },
      );
      newLessonIds.push(lessonId);
      logger.info(`✅ Дополнительный урок ${i + 1}/${outline.lessons.length} готов: "${outline.lessons[i].title}"`);
    } catch (lessonErr) {
      logger.error(`❌ Доп. урок ${i + 1} "${outline.lessons[i].title}" не удалось сгенерировать даже после повторов: ${lessonErr.message}`);
    }
  }

  course.lessons = [...course.lessons, ...newLessonIds];
  await course.save();

  logger.info(`🎉 Курс "${courseTitleRu}" дополнен: +${newLessonIds.length}/${outline.lessons.length} уроков (начиная с №${startOrder})`);
  return { course, addedCount: newLessonIds.length, requestedCount: outline.lessons.length };
}

export default { generateFullCourse, generateMoreLessons };
