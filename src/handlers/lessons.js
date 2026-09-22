import { Markup } from 'telegraf';
import Lesson from '../models/Lesson.js';
import Course from '../models/Course.js';
import { completeLessonAndCheckAchievements } from '../services/courseService.js';
import { generateInteractiveLessonTurn } from '../services/aiInteractiveLessonService.js';
import { checkUserAILimit, incrementUserAIUsage } from '../middleware/aiRateLimit.js';
import { isMenuButtonText } from '../utils/keyboards.js';
import { COURSE_CATEGORIES } from '../config/constants.js';

const NAV_LABELS = {
  tg: { next: '➡️ Дарси навбатӣ', finish: '✅ Хатм кардани курс', completed: (xp) => `✅ Дарс анҷом ёфт! +${xp} XP` },
  ru: { next: '➡️ Следующий урок', finish: '✅ Завершить курс', completed: (xp) => `✅ Урок завершён! +${xp} XP` },
  en: { next: '➡️ Next lesson', finish: '✅ Finish course', completed: (xp) => `✅ Lesson completed! +${xp} XP` },
};

const AI_LESSON_TEXT = {
  tg: { thinking: '🤖 Муаллим омода мешавад...', limit: '🚫 Лимити рӯзонаи AI-и шумо тамом шуд. Барои дастрасии бештар: /обуна', error: '⚠️ Хатогӣ. Лутфан баъдтар кӯшиш кунед.' },
  ru: { thinking: '🤖 Учитель готовится...', limit: '🚫 Ваш дневной лимит AI исчерпан. Для увеличения лимита: /обуна', error: '⚠️ Ошибка. Попробуйте позже.' },
  en: { thinking: '🤖 Teacher is preparing...', limit: '🚫 Your daily AI limit is reached. To get more: /subscription', error: '⚠️ Error. Please try again later.' },
};

async function sendLesson(ctx, courseId, lessonIndex) {
  const lang = ctx.state.user?.language || 'tg';
  const t = NAV_LABELS[lang] || NAV_LABELS.tg;

  const lessons = await Lesson.find({ course: courseId }).sort({ order: 1 }).lean();
  const lesson = lessons[lessonIndex];

  if (!lesson) {
    await ctx.reply(t.finish);
    return;
  }

  if (lesson.type === 'ai_interactive') {
    await startInteractiveLesson(ctx, { courseId, lessonIndex, lesson, isLast: lessonIndex >= lessons.length - 1 });
    return;
  }

  const content = lesson.content?.[lang] || lesson.content?.tg || '';
  const title = lesson.title?.[lang] || lesson.title?.tg || '';
  const isLast = lessonIndex >= lessons.length - 1;

  const navButton = isLast
    ? Markup.button.callback(t.finish, `lesson_finish_${courseId}`)
    : Markup.button.callback(t.next, `lesson_start_${courseId}_${lessonIndex + 1}`);

  const caption = `📖 *${title}*\n\n${content}`;

  try {
    if (lesson.type === 'photo' && lesson.mediaUrls?.length) {
      if (lesson.mediaUrls.length === 1) {
        await ctx.replyWithPhoto(lesson.mediaUrls[0], { caption, parse_mode: 'Markdown' });
      } else {
        await ctx.replyWithMediaGroup(
          lesson.mediaUrls.map((url, i) => ({
            type: 'photo',
            media: url,
            caption: i === 0 ? caption : undefined,
            parse_mode: i === 0 ? 'Markdown' : undefined,
          })),
        );
      }
      await ctx.reply('⬇️', Markup.inlineKeyboard([[navButton]]));
    } else if (lesson.type === 'video' && lesson.mediaUrls?.[0]) {
      await ctx.replyWithVideo(lesson.mediaUrls[0], { caption, parse_mode: 'Markdown' });
      await ctx.reply('⬇️', Markup.inlineKeyboard([[navButton]]));
    } else if (lesson.type === 'voice' && lesson.mediaUrls?.[0]) {
      await ctx.replyWithVoice(lesson.mediaUrls[0], { caption, parse_mode: 'Markdown' });
      await ctx.reply('⬇️', Markup.inlineKeyboard([[navButton]]));
    } else if (lesson.type === 'pdf' && lesson.mediaUrls?.[0]) {
      await ctx.replyWithDocument(lesson.mediaUrls[0], { caption, parse_mode: 'Markdown' });
      await ctx.reply('⬇️', Markup.inlineKeyboard([[navButton]]));
    } else {
      await ctx.replyWithMarkdown(caption, Markup.inlineKeyboard([[navButton]]));
    }
  } catch (err) {
    await ctx.replyWithMarkdown(caption, Markup.inlineKeyboard([[navButton]]));
  }

  const { xp } = await completeLessonAndCheckAchievements(ctx.state.user._id, lesson._id);
  ctx.session.tempData = { ...ctx.session.tempData, lastXpGain: xp };
}

async function startInteractiveLesson(ctx, { courseId, lessonIndex, lesson, isLast }) {
  const lang = ctx.state.user?.language || 'tg';
  const t = AI_LESSON_TEXT[lang] || AI_LESSON_TEXT.ru;
  const user = ctx.state.user;

  const { allowed } = await checkUserAILimit(user);
  if (!allowed) {
    await ctx.reply(t.limit);
    return;
  }

  const statusMsg = await ctx.reply(t.thinking);

  try {
    const turn = await generateInteractiveLessonTurn({ lessonId: lesson._id, language: lang, history: [] });

    ctx.session.step = 'ai_lesson_dialog';
    ctx.session.tempData = {
      ...ctx.session.tempData,
      aiLesson: {
        courseId,
        lessonIndex,
        lessonId: lesson._id.toString(),
        isLast,
        history: [{ role: 'assistant', content: turn.content }],
      },
    };

    await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, undefined, `👨‍🏫 ${turn.content}`);
    await incrementUserAIUsage(user._id, turn.tokensUsed);

    if (turn.isComplete) {
      await finishInteractiveLesson(ctx);
    }
  } catch (err) {
    await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, undefined, t.error).catch(() => {});
  }
}

async function continueInteractiveLesson(ctx) {
  const lang = ctx.state.user?.language || 'tg';
  const t = AI_LESSON_TEXT[lang] || AI_LESSON_TEXT.ru;
  const user = ctx.state.user;
  const state = ctx.session.tempData?.aiLesson;

  if (!state) {
    ctx.session.step = null;
    return;
  }

  const { allowed } = await checkUserAILimit(user);
  if (!allowed) {
    await ctx.reply(t.limit);
    return;
  }

  const statusMsg = await ctx.reply(t.thinking);
  const history = [...state.history, { role: 'user', content: ctx.message.text }];

  try {
    const turn = await generateInteractiveLessonTurn({ lessonId: state.lessonId, language: lang, history });
    history.push({ role: 'assistant', content: turn.content });

    ctx.session.tempData.aiLesson = { ...state, history };

    await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, undefined, `👨‍🏫 ${turn.content}`);
    await incrementUserAIUsage(user._id, turn.tokensUsed);

    if (turn.isComplete) {
      await finishInteractiveLesson(ctx);
    }
  } catch (err) {
    await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, undefined, t.error).catch(() => {});
  }
}

async function finishInteractiveLesson(ctx) {
  const lang = ctx.state.user?.language || 'tg';
  const t = NAV_LABELS[lang] || NAV_LABELS.tg;
  const state = ctx.session.tempData?.aiLesson;
  if (!state) return;

  const { xp } = await completeLessonAndCheckAchievements(ctx.state.user._id, state.lessonId, 15);

  const navButton = state.isLast
    ? Markup.button.callback(t.finish, `lesson_finish_${state.courseId}`)
    : Markup.button.callback(t.next, `lesson_start_${state.courseId}_${state.lessonIndex + 1}`);

  ctx.session.step = null;
  ctx.session.tempData = { ...ctx.session.tempData, aiLesson: null };

  await ctx.reply(t.completed(xp), Markup.inlineKeyboard([[navButton]]));
}

export function registerLessonsHandler(bot) {
  bot.action(/^lesson_start_(.+)_(\d+)$/, async (ctx) => {
    const [, courseId, indexStr] = ctx.match;
    await ctx.answerCbQuery();
    await sendLesson(ctx, courseId, Number(indexStr));
  });

  bot.on('text', async (ctx, next) => {
    if (ctx.session?.step !== 'ai_lesson_dialog') return next();
    if (ctx.message.text.startsWith('/')) return next();

    if (isMenuButtonText(ctx.message.text)) {
      ctx.session.step = null;
      ctx.session.tempData = { ...ctx.session.tempData, aiLesson: null };
      return next();
    }

    await continueInteractiveLesson(ctx);
  });

  bot.action(/^lesson_finish_(.+)$/, async (ctx) => {
    const courseId = ctx.match[1];
    const lang = ctx.state.user?.language || 'tg';
    await ctx.answerCbQuery();

    const course = await Course.findById(courseId).lean();
    const title = course?.title?.[lang] || course?.title?.tg || '';
    const msg = {
      tg: `🎉 Табрик! Шумо курси "${title}"-ро хатм кардед!`,
      ru: `🎉 Поздравляем! Вы завершили курс "${title}"!`,
      en: `🎉 Congratulations! You've completed the "${title}" course!`,
    };

    const nextCourse = await findNextCourse(course);

    if (!nextCourse) {
      await ctx.reply(msg[lang] || msg.tg);
      return;
    }

    const nextTitle = nextCourse.title?.[lang] || nextCourse.title?.tg || '';
    const nextPrompt = {
      tg: `\n\n➡️ Курси навбатӣ барои шумо тайёр аст: *${nextTitle}*`,
      ru: `\n\n➡️ Для вас уже готов следующий курс: *${nextTitle}*`,
      en: `\n\n➡️ Your next course is ready: *${nextTitle}*`,
    };
    const buttonLabel = { tg: '▶️ Идома додан', ru: '▶️ Продолжить обучение', en: '▶️ Continue learning' };

    await ctx.replyWithMarkdown(
      `${msg[lang] || msg.tg}${nextPrompt[lang] || nextPrompt.ru}`,
      Markup.inlineKeyboard([[Markup.button.callback(buttonLabel[lang] || buttonLabel.ru, `course_view_${nextCourse._id}`)]]),
    );
  });
}

async function findNextCourse(finishedCourse) {
  if (!finishedCourse) return null;

  const sameCategory = await Course.findOne({
    category: finishedCourse.category,
    order: { $gt: finishedCourse.order },
    isPublished: true,
  })
    .sort({ order: 1 })
    .lean();
  if (sameCategory) return sameCategory;

  const categoryIndex = COURSE_CATEGORIES.indexOf(finishedCourse.category);
  for (let i = categoryIndex + 1; i < COURSE_CATEGORIES.length; i += 1) {
    const nextInCategory = await Course.findOne({ category: COURSE_CATEGORIES[i], isPublished: true })
      .sort({ order: 1 })
      .lean();
    if (nextInCategory) return nextInCategory;
  }

  return null;
}

export default registerLessonsHandler;
