import { groqVisionAnalysis } from '../services/groqService.js';
import { buildChartVisionPrompt } from '../ai/prompts/analyst.js';
import { LANGUAGE_ENFORCEMENT } from '../ai/prompts/shared.js';
import { checkUserAILimit, incrementUserAIUsage } from '../middleware/aiRateLimit.js';
import { downloadTelegramFile, fileToBase64, cleanupTempFile } from '../utils/mediaProcessor.js';
import AIMarketAnalysis from '../models/AIMarketAnalysis.js';
import logger from '../utils/errorHandler.js';

const TEXT = {
  tg: {
    prompt: '📸 Скриншоти графики трейдингро фиристед — AI онро таҳлил мекунад.',
    analyzing: '🤖 Дар ҳоли таҳлили график...',
    limit: '🚫 Лимити рӯзонаи AI-и шумо тамом шуд. Барои дастрасии бештар: /обуна',
    error: '⚠️ Хатогӣ ҳангоми таҳлили расм. Лутфан кӯшиши дигар кунед.',
    visionUnavailable: '⚠️ Vision-таҳлил ҳоло дастрас нест (Groq vision key/лимит). Лутфан баъдтар кӯшиш кунед.',
  },
  ru: {
    prompt: '📸 Отправьте скриншот торгового графика — AI его проанализирует.',
    analyzing: '🤖 Анализирую график...',
    limit: '🚫 Ваш дневной лимит AI исчерпан. Для увеличения лимита: /обуна',
    error: '⚠️ Ошибка при анализе изображения. Попробуйте ещё раз.',
    visionUnavailable: '⚠️ Vision-анализ временно недоступен (лимит/ключ Groq). Попробуйте позже.',
  },
  en: {
    prompt: '📸 Send a trading chart screenshot — AI will analyze it.',
    analyzing: '🤖 Analyzing the chart...',
    limit: '🚫 Your daily AI limit is reached. To get more: /subscription',
    error: '⚠️ Error analyzing the image. Please try again.',
    visionUnavailable: '⚠️ Vision analysis is temporarily unavailable (Groq key/limit). Try again later.',
  },
};

export function registerAIVisionHandler(bot) {
  bot.command('chart', async (ctx) => {
    const lang = ctx.state.user?.language || 'tg';
    ctx.session.step = 'awaiting_chart_photo';
    await ctx.reply(TEXT[lang].prompt);
  });

  bot.hears(['📸 Таҳлили график', '📸 Анализ графика', '📸 Chart analysis'], async (ctx) => {
    const lang = ctx.state.user?.language || 'tg';
    ctx.session.step = 'awaiting_chart_photo';
    await ctx.reply(TEXT[lang].prompt);
  });

  // Приём скриншота для Vision-анализа (срабатывает только после /chart, чтобы не
  // конфликтовать с фото-чеками оплаты, которые обрабатываются раньше в payment.js)
  bot.on('photo', async (ctx, next) => {
    if (ctx.session?.step !== 'awaiting_chart_photo') return next();

    const lang = ctx.state.user?.language || 'tg';
    const t = TEXT[lang] || TEXT.tg;
    const user = ctx.state.user;

    const { allowed } = await checkUserAILimit(user);
    if (!allowed) {
      ctx.session.step = null;
      await ctx.reply(t.limit);
      return;
    }

    ctx.session.step = null;
    const statusMsg = await ctx.reply(t.analyzing);

    const photos = ctx.message.photo;
    const largestPhoto = photos[photos.length - 1];
    let localPath = null;

    try {
      localPath = await downloadTelegramFile(bot, largestPhoto.file_id, 'jpg');
      const base64Image = await fileToBase64(localPath);

      const result = await groqVisionAnalysis({
        imageBase64: base64Image,
        mimeType: 'image/jpeg',
        prompt: `${buildChartVisionPrompt({ language: lang })}\n\n${LANGUAGE_ENFORCEMENT[lang] || LANGUAGE_ENFORCEMENT.tg}`,
      });

      await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, undefined, result.content, {
        parse_mode: 'Markdown',
      });

      await incrementUserAIUsage(user._id, result.tokensUsed);

      // Сохраняем как разновидность AI-анализа рынка для статистики (без привязки к конкретной паре)
      await AIMarketAnalysis.create({
        pair: 'CHART_SCREENSHOT',
        user: user._id,
        analysisText: result.content,
        provider: result.provider,
        tokensUsed: result.tokensUsed || 0,
      }).catch(() => {});
    } catch (err) {
      logger.error('Ошибка Vision-анализа графика:', err);
      const message = err.message === 'GROQ_NOT_CONFIGURED' || err.message === 'GROQ_RATE_LIMIT_EXCEEDED' ? t.visionUnavailable : t.error;
      await ctx.telegram
        .editMessageText(ctx.chat.id, statusMsg.message_id, undefined, message)
        .catch(() => ctx.reply(message));
    } finally {
      await cleanupTempFile(localPath);
    }
  });
}

export default registerAIVisionHandler;
