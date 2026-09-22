import { Markup } from 'telegraf';
import { askMentorStream, rateLastResponse, getLastAssistantMessage } from '../services/aiAssistant.js';
import { checkUserAILimit, incrementUserAIUsage } from '../middleware/aiRateLimit.js';
import { aiFeedbackKeyboard, mainMenuKeyboard, isMenuButtonText } from '../utils/keyboards.js';
import { containsPromptInjection } from '../utils/validators.js';
import { synthesizeSpeech } from '../services/ttsService.js';
import { cleanupTempFile } from '../utils/mediaProcessor.js';
import logger from '../utils/errorHandler.js';

const BACK_LABEL = { tg: '⬅️ Бозгашт ба меню', ru: '⬅️ Назад в меню', en: '⬅️ Back to menu' };
const BACK_CONFIRM = {
  tg: '✅ Шумо аз AI-Наставник баромадед.',
  ru: '✅ Вы вышли из режима AI-Наставника.',
  en: '✅ You left the AI Mentor mode.',
};

function enterKeyboard(lang) {
  return Markup.inlineKeyboard([[Markup.button.callback(BACK_LABEL[lang] || BACK_LABEL.tg, 'ai_back_to_menu')]]);
}

const PROMPTS = {
  tg: {
    enter: '🤖 Шумо ба AI-Наставник ворид шудед!\n\nСавол ё мушкилоти худро дар бораи трейдинг нависед — ман кӯшиш мекунам бо роҳи оддӣ фаҳмонам. 💬',
    thinking: '🤖 Фикр карда истодааст...',
    errorLimit: '🚫 Лимити рӯзонаи AI-и шумо тамом шуд. Барои дастрасии бештар: /обуна',
    errorGeneric: '⚠️ Мутаассифона, AI ҳоло дастрас нест. Лутфан пас аз чанд дақиқа кӯшиш кунед.',
    injectionBlocked: '⚠️ Дархости шумо номувофиқ муайян шуд. Лутфан саволи худро оид ба трейдинг содда нависед.',
  },
  ru: {
    enter: '🤖 Вы вошли в AI-Наставника!\n\nНапишите свой вопрос по трейдингу — я постараюсь объяснить простыми словами. 💬',
    thinking: '🤖 Думаю...',
    errorLimit: '🚫 Ваш дневной лимит AI исчерпан. Для увеличения лимита: /обуна',
    errorGeneric: '⚠️ К сожалению, AI сейчас недоступен. Попробуйте через пару минут.',
    injectionBlocked: '⚠️ Ваш запрос выглядит некорректно. Пожалуйста, задайте обычный вопрос по трейдингу.',
  },
  en: {
    enter: "🤖 You're now chatting with your AI Mentor!\n\nAsk any trading question — I'll explain it simply. 💬",
    thinking: '🤖 Thinking...',
    errorLimit: '🚫 Your daily AI limit is reached. To get more: /subscription',
    errorGeneric: '⚠️ AI is temporarily unavailable. Please try again in a few minutes.',
    injectionBlocked: '⚠️ Your request looks invalid. Please ask a normal trading-related question.',
  },
};

export function registerAIChatHandler(bot) {
  // Вход в режим AI-чата
  bot.command('ai', async (ctx) => {
    const lang = ctx.state.user?.language || 'tg';
    ctx.session.step = 'ai_chat';
    await ctx.reply(PROMPTS[lang].enter, enterKeyboard(lang));
  });
  bot.hears(['🤖 AI-Наставник', '🤖 AI Mentor'], async (ctx) => {
    const lang = ctx.state.user?.language || 'tg';
    ctx.session.step = 'ai_chat';
    await ctx.reply(PROMPTS[lang].enter, enterKeyboard(lang));
  });

  // Обработка текстовых сообщений в режиме AI-чата
  bot.on('text', async (ctx, next) => {
    if (ctx.session?.step !== 'ai_chat') return next();
    if (ctx.message.text.startsWith('/')) return next();

    if (isMenuButtonText(ctx.message.text)) {
      ctx.session.step = null;
      return next();
    }

    const lang = ctx.state.user?.language || 'tg';
    const t = PROMPTS[lang] || PROMPTS.tg;
    const user = ctx.state.user;
    const userMessage = ctx.message.text.trim();

    if (containsPromptInjection(userMessage)) {
      await ctx.reply(t.injectionBlocked);
      return;
    }

    const { allowed } = await checkUserAILimit(user);
    if (!allowed) {
      await ctx.reply(t.errorLimit);
      return;
    }

    const placeholder = await ctx.reply(t.thinking);
    let lastEditAt = 0;
    const EDIT_THROTTLE_MS = 1200;

    try {
      const result = await askMentorStream({
        user,
        userMessage,
        language: lang,
        onChunk: async (partialText) => {
          const now = Date.now();
          if (now - lastEditAt < EDIT_THROTTLE_MS) return;
          lastEditAt = now;
          try {
            await ctx.telegram.editMessageText(
              ctx.chat.id,
              placeholder.message_id,
              undefined,
              `${partialText}▌`,
            );
          } catch (e) {
            // Игнорируем ошибки "message not modified" и подобные
          }
        },
      });

      await ctx.telegram.editMessageText(
        ctx.chat.id,
        placeholder.message_id,
        undefined,
        result.content || t.errorGeneric,
        { reply_markup: aiFeedbackKeyboard(lang).reply_markup },
      );

      await incrementUserAIUsage(user._id, result.tokensUsed);
    } catch (err) {
      logger.error('Ошибка AI-чата:', err);
      const message = err.message === 'GROQ_RATE_LIMIT_EXCEEDED' ? t.errorLimit : t.errorGeneric;
      await ctx.telegram
        .editMessageText(ctx.chat.id, placeholder.message_id, undefined, message)
        .catch(() => ctx.reply(message));
    }
  });

  bot.action('ai_rate_good', async (ctx) => {
    await rateLastResponse(ctx.state.user._id, true);
    await ctx.answerCbQuery('👍 Раҳмат барои фикр!');
  });
  bot.action('ai_rate_bad', async (ctx) => {
    await rateLastResponse(ctx.state.user._id, false);
    await ctx.answerCbQuery('👎 Мо бартараф мекунем, раҳмат!');
  });
  bot.action('ai_new_chat', async (ctx) => {
    const lang = ctx.state.user?.language || 'tg';
    await ctx.answerCbQuery();
    await ctx.reply(PROMPTS[lang].enter, enterKeyboard(lang));
  });
  bot.action('ai_back_to_menu', async (ctx) => {
    const lang = ctx.state.user?.language || 'tg';
    ctx.session.step = null;
    await ctx.answerCbQuery();
    await ctx.reply(BACK_CONFIRM[lang] || BACK_CONFIRM.ru, mainMenuKeyboard(lang));
  });
  bot.action('ai_speak', async (ctx) => {
    const lang = ctx.state.user?.language || 'tg';
    await ctx.answerCbQuery('🔊');

    const lastMessage = await getLastAssistantMessage(ctx.state.user._id);
    if (!lastMessage) return;

    let audioPath = null;
    try {
      audioPath = await synthesizeSpeech(lastMessage, lang);
      await ctx.replyWithVoice({ source: audioPath });
    } catch (err) {
      logger.warn(`Не удалось озвучить ответ: ${err.message}`);
      const errText = { tg: '⚠️ Озвучка ҳоло дастрас нест.', ru: '⚠️ Озвучка временно недоступна.', en: '⚠️ Voice playback is temporarily unavailable.' };
      await ctx.reply(errText[lang] || errText.ru);
    } finally {
      await cleanupTempFile(audioPath);
    }
  });
  bot.action('ai_escalate', async (ctx) => {
    ctx.session.step = 'support_wait_message';
    ctx.session.tempData = { ...ctx.session.tempData, escalatedFromAI: true };
    await ctx.answerCbQuery();
    const lang = ctx.state.user?.language || 'tg';
    const msg = {
      tg: '🆘 Хуб, лутфан саволи худро барои мутахассис нависед — мо ба зудӣ ҷавоб медиҳем.',
      ru: '🆘 Хорошо, опишите свой вопрос для специалиста — мы скоро ответим.',
      en: "🆘 Sure, describe your issue for our support team — we'll reply soon.",
    };
    const contactLabel = { tg: '☎️ Бо администратор тамос гиред', ru: '☎️ Связаться с администратором', en: '☎️ Contact administrator' };
    const adminUsername = process.env.ADMIN_CONTACT_USERNAME;
    const keyboard = adminUsername
      ? Markup.inlineKeyboard([[Markup.button.url(contactLabel[lang] || contactLabel.ru, `https://t.me/${adminUsername}`)]])
      : undefined;
    await ctx.reply(msg[lang] || msg.tg, keyboard);
  });
}

export default registerAIChatHandler;
