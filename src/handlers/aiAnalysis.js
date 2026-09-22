import { generateMarketAnalysis } from '../services/aiMarketService.js';
import { checkUserAILimit, incrementUserAIUsage } from '../middleware/aiRateLimit.js';
import { marketPairsKeyboard } from '../utils/keyboards.js';
import { isValidMarketPair } from '../utils/validators.js';
import logger from '../utils/errorHandler.js';

const TEXT = {
  tg: {
    choose: '📈 Ҷуфти (пара) мехоҳед таҳлил кунед, интихоб кунед ё бинависед (мисол: /анализ BTCUSDT):',
    analyzing: (p) => `🤖 Дар ҳоли таҳлили ${p}...`,
    limit: '🚫 Лимити рӯзонаи AI-и шумо тамом шуд. Барои дастрасии бештар: /обуна',
    invalid: '⚠️ Формати ҷуфт нодуруст аст. Мисол: BTCUSDT, EURUSD',
    error: '⚠️ Хатогӣ ҳангоми таҳлил. Лутфан баъдтар кӯшиш кунед.',
  },
  ru: {
    choose: '📈 Выберите пару для анализа или напишите её (например: /анализ BTCUSDT):',
    analyzing: (p) => `🤖 Анализирую ${p}...`,
    limit: '🚫 Ваш дневной лимит AI исчерпан. Для увеличения лимита: /обуна',
    invalid: '⚠️ Неверный формат пары. Пример: BTCUSDT, EURUSD',
    error: '⚠️ Ошибка при анализе. Попробуйте позже.',
  },
  en: {
    choose: '📈 Choose a pair to analyze or type it (e.g. /анализ BTCUSDT):',
    analyzing: (p) => `🤖 Analyzing ${p}...`,
    limit: '🚫 Your daily AI limit is reached. To get more: /subscription',
    invalid: '⚠️ Invalid pair format. Example: BTCUSDT, EURUSD',
    error: '⚠️ Error during analysis. Please try again later.',
  },
};

async function runAnalysis(ctx, pair) {
  const lang = ctx.state.user?.language || 'tg';
  const t = TEXT[lang] || TEXT.tg;
  const user = ctx.state.user;

  if (!isValidMarketPair(pair)) {
    await ctx.reply(t.invalid);
    return;
  }

  const { allowed } = await checkUserAILimit(user);
  if (!allowed) {
    await ctx.reply(t.limit);
    return;
  }

  const statusMsg = await ctx.reply(t.analyzing(pair.toUpperCase()));

  try {
    const result = await generateMarketAnalysis({ pair: pair.toUpperCase(), userId: user._id, language: lang });
    const priceLine = result.snapshot
      ? `💹 *${pair.toUpperCase()}*: $${result.snapshot.price} (${result.snapshot.change24h >= 0 ? '📈' : '📉'} ${result.snapshot.change24h?.toFixed(2)}%)\n\n`
      : '';

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      undefined,
      `${priceLine}${result.content}`,
      { parse_mode: 'Markdown' },
    );

    await incrementUserAIUsage(user._id, result.tokensUsed);
  } catch (err) {
    logger.error('Ошибка AI-анализа рынка:', err);
    await ctx.telegram
      .editMessageText(ctx.chat.id, statusMsg.message_id, undefined, t.error)
      .catch(() => ctx.reply(t.error));
  }
}

export function registerAIAnalysisHandler(bot) {
  bot.command('анализ', async (ctx) => {
    const lang = ctx.state.user?.language || 'tg';
    const t = TEXT[lang] || TEXT.tg;
    const arg = ctx.message.text.split(' ').slice(1).join(' ').trim();

    if (!arg) {
      await ctx.reply(t.choose, marketPairsKeyboard());
      return;
    }
    await runAnalysis(ctx, arg);
  });

  bot.hears(['📈 Таҳлил', '📈 Анализ', '📈 Analysis'], async (ctx) => {
    const lang = ctx.state.user?.language || 'tg';
    await ctx.reply(TEXT[lang].choose, marketPairsKeyboard());
  });

  bot.action(/^analyze_(.+)$/, async (ctx) => {
    const pair = ctx.match[1];
    await ctx.answerCbQuery();
    await runAnalysis(ctx, pair);
  });
}

export default registerAIAnalysisHandler;
