import { Markup } from 'telegraf';
import { listCourses, hasAccessToPlan } from '../services/courseService.js';
import Course from '../models/Course.js';

const CATEGORY_LABELS = {
  tg: {
    basics: '🎯 Асосҳои трейдинг', forex: '💱 Forex бозор', crypto: '₿ Криптовалюта',
    technical_analysis: '📊 Техникӣ таҳлил', fundamental_analysis: '📰 Фундаменталӣ таҳлил',
    psychology: '🧠 Психология', risk_management: '🛡 Идоракунии хавф', ai_trading: '🤖 AI ва трейдинг',
  },
  ru: {
    basics: '🎯 Основы трейдинга', forex: '💱 Forex рынок', crypto: '₿ Криптовалюта',
    technical_analysis: '📊 Технический анализ', fundamental_analysis: '📰 Фундаментальный анализ',
    psychology: '🧠 Психология', risk_management: '🛡 Управление рисками', ai_trading: '🤖 AI и трейдинг',
  },
  en: {
    basics: '🎯 Trading basics', forex: '💱 Forex market', crypto: '₿ Cryptocurrency',
    technical_analysis: '📊 Technical analysis', fundamental_analysis: '📰 Fundamental analysis',
    psychology: '🧠 Psychology', risk_management: '🛡 Risk management', ai_trading: '🤖 AI and trading',
  },
};

const TEXT = {
  tg: { title: '📚 *Курсҳо*\n\nКатегорияро интихоб кунед:', empty: 'Ҳоло курсҳо дастрас нестанд.', locked: (plan) => `🔒 Ин курс тарифи "${plan}"-ро талаб мекунад.` },
  ru: { title: '📚 *Курсы*\n\nВыберите категорию:', empty: 'Курсы пока недоступны.', locked: (plan) => `🔒 Этот курс требует тариф "${plan}".` },
  en: { title: '📚 *Courses*\n\nChoose a category:', empty: 'No courses available yet.', locked: (plan) => `🔒 This course requires the "${plan}" plan.` },
};

export function registerCoursesHandler(bot) {
  const showCategories = async (ctx) => {
    const lang = ctx.state.user?.language || 'tg';
    const labels = CATEGORY_LABELS[lang] || CATEGORY_LABELS.tg;
    const t = TEXT[lang] || TEXT.tg;

    const buttons = Object.entries(labels).map(([key, label]) => [
      Markup.button.callback(label, `course_cat_${key}`),
    ]);

    await ctx.replyWithMarkdown(t.title, Markup.inlineKeyboard(buttons));
  };

  bot.command('courses', showCategories);
  bot.hears(['📚 Курсҳо', '📚 Курсы', '📚 Courses'], showCategories);

  bot.action(/^course_cat_(.+)$/, async (ctx) => {
    const category = ctx.match[1];
    const lang = ctx.state.user?.language || 'tg';
    const t = TEXT[lang] || TEXT.tg;
    await ctx.answerCbQuery();

    const courses = await listCourses({ category });
    if (!courses.length) {
      await ctx.reply(t.empty);
      return;
    }

    const buttons = courses.map((c) => [
      Markup.button.callback(`${c.title?.[lang] || c.title?.tg || 'Course'}`, `course_view_${c._id}`),
    ]);
    await ctx.reply(t.title.replace(/\*/g, ''), Markup.inlineKeyboard(buttons));
  });

  bot.action(/^course_view_(.+)$/, async (ctx) => {
    const courseId = ctx.match[1];
    const lang = ctx.state.user?.language || 'tg';
    const t = TEXT[lang] || TEXT.tg;
    const user = ctx.state.user;
    await ctx.answerCbQuery();

    const course = await Course.findById(courseId).lean();
    if (!course) {
      await ctx.reply(t.empty);
      return;
    }

    if (!hasAccessToPlan(user.subscription.plan, course.requiredPlan)) {
      await ctx.reply(t.locked(course.requiredPlan));
      return;
    }

    const description = course.description?.[lang] || course.description?.tg || '';
    const buttons = Markup.inlineKeyboard([
      [Markup.button.callback(lang === 'ru' ? '▶️ Начать урок 1' : lang === 'en' ? '▶️ Start lesson 1' : '▶️ Дарси 1-ро сар кунед', `lesson_start_${courseId}_0`)],
    ]);

    await ctx.replyWithMarkdown(`*${course.title?.[lang] || course.title?.tg}*\n\n${description}`, buttons);
  });
}

export default registerCoursesHandler;
