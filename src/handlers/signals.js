import { getActiveSignalsForUser, formatSignalMessage } from '../services/signalService.js';

const TEXT = {
  tg: { title: '📊 *Сигналҳои фаъол*', empty: 'Ҳоло сигнали фаъол нест. Санҷед баъдтар!', locked: '🔒 Сигналҳо танҳо барои муштариёни тарифи Тиллоӣ ва Алмосӣ дастрасанд. Барои дастрасӣ: /обуна' },
  ru: { title: '📊 *Активные сигналы*', empty: 'Активных сигналов пока нет. Загляните позже!', locked: '🔒 Сигналы доступны только на тарифах Золото и Алмаз. Оформить: /обуна' },
  en: { title: '📊 *Active signals*', empty: 'No active signals yet. Check back later!', locked: '🔒 Signals are available only on Gold and Diamond plans. Get one: /subscription' },
};

export function registerSignalsHandler(bot) {
  const showSignals = async (ctx) => {
    const lang = ctx.state.user?.language || 'tg';
    const t = TEXT[lang] || TEXT.tg;
    const user = ctx.state.user;

    const signals = await getActiveSignalsForUser(user.subscription.plan);

    if (!['gold', 'diamond'].includes(user.subscription.plan)) {
      await ctx.reply(t.locked);
      return;
    }

    if (!signals.length) {
      await ctx.reply(t.empty);
      return;
    }

    await ctx.replyWithMarkdown(t.title);
    for (const signal of signals) {
      await ctx.replyWithMarkdown(formatSignalMessage(signal, lang));
    }
  };

  bot.command('signals', showSignals);
  bot.hears(['📊 Сигналҳо', '📊 Сигналы', '📊 Signals'], showSignals);
}

export default registerSignalsHandler;
