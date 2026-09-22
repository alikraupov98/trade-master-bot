import { mainMenuKeyboard, languageInlineKeyboard } from '../utils/keyboards.js';

const WELCOME = {
  tg: (name) => `👋 Салом, ${name}!\n\n🎓 Хуш омадед ба *TradeMaster AI TJ* — платформаи омӯзиши трейдинг бо ёрии AI!\n\n🤖 Дар ин бот шумо метавонед:\n• Дарсҳои Forex, Крипто ва Stocks-ро омӯзед\n• Бо AI-наставники шахсии худ 24/7 сӯҳбат кунед\n• Таҳлили AI-и бозорро дар вақти воқеӣ гиред\n• Сигналҳои трейдингро пайгирӣ кунед\n\nБарои идома, лутфан забони худро интихоб кунед 👇`,
  ru: (name) => `👋 Привет, ${name}!\n\n🎓 Добро пожаловать в *TradeMaster AI TJ* — платформу обучения трейдингу с помощью AI!\n\n🤖 В этом боте вы можете:\n• Изучать Forex, Крипто и Stocks\n• Общаться с персональным AI-наставником 24/7\n• Получать AI-анализ рынка в реальном времени\n• Следить за торговыми сигналами\n\nВыберите язык для продолжения 👇`,
  en: (name) => `👋 Hello, ${name}!\n\n🎓 Welcome to *TradeMaster AI TJ* — an AI-powered trading education platform!\n\n🤖 With this bot you can:\n• Learn Forex, Crypto and Stocks\n• Chat with your personal AI mentor 24/7\n• Get real-time AI market analysis\n• Follow trading signals\n\nPlease choose your language to continue 👇`,
};

const MENU_READY = {
  tg: '✅ Забон танзим шуд! Аз менюи поён истифода баред.',
  ru: '✅ Язык установлен! Используйте меню ниже.',
  en: '✅ Language set! Use the menu below.',
};

export async function handleStart(ctx) {
  const name = ctx.from.first_name || 'дӯст';
  const lang = ctx.state.user?.language || 'tg';
  await ctx.replyWithMarkdown(WELCOME[lang](name), languageInlineKeyboard());
}

export function registerStartHandler(bot) {
  bot.start(handleStart);

  ['lang_tg', 'lang_ru', 'lang_en'].forEach((action) => {
    bot.action(action, async (ctx) => {
      const lang = action.replace('lang_', '');
      ctx.session.language = lang;
      if (ctx.state.user) {
        ctx.state.user.language = lang;
        await ctx.state.user.save();
      }
      await ctx.answerCbQuery();
      await ctx.editMessageReplyMarkup(null).catch(() => {});
      await ctx.reply(MENU_READY[lang], mainMenuKeyboard(lang));
    });
  });

  bot.command('help', async (ctx) => {
    const lang = ctx.state.user?.language || 'tg';
    const help = {
      tg: '📖 Фармонҳо:\n/ai — Сӯҳбат бо AI-наставник\n/анализ [ҷуфт] — Таҳлили AI-и бозор\n/обуна — Тарифҳо\n/support — Дастгирӣ',
      ru: '📖 Команды:\n/ai — Чат с AI-наставником\n/анализ [пара] — AI-анализ рынка\n/обуна — Тарифы\n/support — Поддержка',
      en: '📖 Commands:\n/ai — Chat with AI mentor\n/анализ [pair] — AI market analysis\n/обуна — Subscription plans\n/support — Support',
    };
    await ctx.reply(help[lang] || help.tg);
  });
}

export default registerStartHandler;
