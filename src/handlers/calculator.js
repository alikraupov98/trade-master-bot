import { isMenuButtonText } from '../utils/keyboards.js';

const TEXT = {
  tg: {
    intro: '🧮 *Калкулятори хавф*\n\nМаблағи хисоб, фоизи хавф ва масофаи стоп-лоссро (бо pip ё %) ба таври зерин нависед:\n\n`балансе риск% масофаи_SL`\n\nМисол: `1000 2 50`\n(1000$ баланс, 2% хавф, 50 pip то стоп-лосс)',
    result: (risk, size) => `💰 Маблағи хатари шумо: $${risk}\n📏 Ҳаҷми позитсия: ${size} lot (тахминӣ, барои pip value $10)`,
    invalid: '⚠️ Формат нодуруст. Мисол: 1000 2 50',
  },
  ru: {
    intro: '🧮 *Калькулятор риска*\n\nВведите баланс счёта, процент риска и расстояние до стоп-лосса (в пипсах):\n\n`баланс риск% дистанция_SL`\n\nПример: `1000 2 50`\n(баланс 1000$, риск 2%, 50 пипсов до стопа)',
    result: (risk, size) => `💰 Сумма риска: $${risk}\n📏 Размер позиции: ${size} лот (примерно, при цене пипса $10)`,
    invalid: '⚠️ Неверный формат. Пример: 1000 2 50',
  },
  en: {
    intro: '🧮 *Risk calculator*\n\nEnter account balance, risk % and stop-loss distance (in pips):\n\n`balance risk% sl_distance`\n\nExample: `1000 2 50`\n(balance $1000, 2% risk, 50 pips to stop)',
    result: (risk, size) => `💰 Risk amount: $${risk}\n📏 Position size: ${size} lots (approx., at $10 pip value)`,
    invalid: '⚠️ Invalid format. Example: 1000 2 50',
  },
};

export function registerCalculatorHandler(bot) {
  const startCalc = async (ctx) => {
    const lang = ctx.state.user?.language || 'tg';
    ctx.session.step = 'calc_wait_input';
    await ctx.replyWithMarkdown(TEXT[lang].intro);
  };

  bot.command('calculator', startCalc);
  bot.hears(['🧮 Калкулятор', '🧮 Калькулятор'], startCalc);

  bot.on('text', async (ctx, next) => {
    if (ctx.session?.step !== 'calc_wait_input') return next();

    if (isMenuButtonText(ctx.message.text)) {
      ctx.session.step = null;
      return next();
    }

    const lang = ctx.state.user?.language || 'tg';
    const t = TEXT[lang] || TEXT.tg;

    const parts = ctx.message.text.trim().split(/\s+/).map(Number);
    if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n) || n <= 0)) {
      await ctx.reply(t.invalid);
      return;
    }

    const [balance, riskPercent, slPips] = parts;
    const riskAmount = Number(((balance * riskPercent) / 100).toFixed(2));
    const pipValue = 10; // усреднённое значение для стандартного лота на большинстве Forex-пар
    const positionSize = Number((riskAmount / (slPips * pipValue)).toFixed(2));

    ctx.session.step = null;
    await ctx.reply(t.result(riskAmount, positionSize));
  });
}

export default registerCalculatorHandler;
