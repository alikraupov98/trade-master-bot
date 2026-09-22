import { Markup } from 'telegraf';

const TERMS = {
  'stop-loss': {
    tg: 'Стоп-лосс — сатҳи нархе, ки дар он позитсия ба таври худкор баста мешавад, то зарарро маҳдуд кунад.',
    ru: 'Стоп-лосс — уровень цены, при котором позиция автоматически закрывается, чтобы ограничить убыток.',
    en: 'Stop-loss — a price level at which a position is automatically closed to limit losses.',
  },
  'take-profit': {
    tg: 'Тейк-профит — сатҳи нархе, ки дар он позитсия бо фоида баста мешавад.',
    ru: 'Тейк-профит — уровень цены, при котором позиция закрывается с прибылью.',
    en: 'Take-profit — a price level at which a position is closed with profit.',
  },
  leverage: {
    tg: 'Ливеридж (қарзи молиявӣ) — имконияти савдо бо маблағи бештар аз депозити воқеии шумо. Хатарро зиёд мекунад!',
    ru: 'Кредитное плечо (леверидж) — возможность торговать суммой больше вашего реального депозита. Увеличивает риск!',
    en: 'Leverage — the ability to trade with more than your actual deposit. Increases risk!',
  },
  spread: {
    tg: 'Спред — фарқият байни нархи хариду фурӯш.',
    ru: 'Спред — разница между ценой покупки и продажи.',
    en: 'Spread — the difference between the buy and sell price.',
  },
  'support-resistance': {
    tg: 'Сатҳи дастгирӣ/муқовимат — нархҳое, ки дар онҷо тамоюли бозор одатан тағйир меёбад.',
    ru: 'Уровни поддержки/сопротивления — цены, на которых рыночный тренд обычно меняется.',
    en: 'Support/resistance — price levels where the market trend typically changes direction.',
  },
};

const TEXT = {
  tg: { title: '📖 *Луғати трейдинг*\n\nИстилоҳро интихоб кунед:' },
  ru: { title: '📖 *Глоссарий трейдинга*\n\nВыберите термин:' },
  en: { title: '📖 *Trading glossary*\n\nChoose a term:' },
};

export function registerGlossaryHandler(bot) {
  const showGlossary = async (ctx) => {
    const lang = ctx.state.user?.language || 'tg';
    const buttons = Object.keys(TERMS).map((key) => [
      Markup.button.callback(key.replace('-', ' / '), `glossary_${key}`),
    ]);
    await ctx.replyWithMarkdown(TEXT[lang].title, Markup.inlineKeyboard(buttons));
  };

  bot.command('glossary', showGlossary);

  bot.action(/^glossary_(.+)$/, async (ctx) => {
    const key = ctx.match[1];
    const lang = ctx.state.user?.language || 'tg';
    await ctx.answerCbQuery();
    const term = TERMS[key];
    if (!term) return;
    await ctx.reply(`📖 *${key}*\n\n${term[lang] || term.ru}`, { parse_mode: 'Markdown' });
  });
}

export default registerGlossaryHandler;
