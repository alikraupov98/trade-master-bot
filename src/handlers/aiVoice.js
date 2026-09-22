import { groqAudioTranscription } from '../services/groqService.js';
import { askMentorStream } from '../services/aiAssistant.js';
import { checkUserAILimit, incrementUserAIUsage } from '../middleware/aiRateLimit.js';
import { downloadTelegramFile, convertToMp3, cleanupTempFile } from '../utils/mediaProcessor.js';
import { aiFeedbackKeyboard } from '../utils/keyboards.js';
import logger from '../utils/errorHandler.js';

const TEXT = {
  tg: {
    transcribing: '🎙 Овози шумо шунида истодааст...',
    thinking: '🤖 Фикр карда истодааст...',
    limit: '🚫 Лимити рӯзонаи AI-и шумо тамом шуд. Барои дастрасии бештар: /обуна',
    error: '⚠️ Хатогӣ ҳангоми коркарди овоз. Лутфан бо матн нависед ё баъдтар кӯшиш кунед.',
    heard: (text) => `🎙 Шунидам: _"${text}"_\n\n`,
  },
  ru: {
    transcribing: '🎙 Распознаю голосовое сообщение...',
    thinking: '🤖 Думаю...',
    limit: '🚫 Ваш дневной лимит AI исчерпан. Для увеличения лимита: /обуна',
    error: '⚠️ Ошибка обработки голосового. Напишите текстом или попробуйте позже.',
    heard: (text) => `🎙 Услышал: _"${text}"_\n\n`,
  },
  en: {
    transcribing: '🎙 Transcribing your voice message...',
    thinking: '🤖 Thinking...',
    limit: '🚫 Your daily AI limit is reached. To get more: /subscription',
    error: '⚠️ Error processing voice message. Please type instead or try again later.',
    heard: (text) => `🎙 Heard: _"${text}"_\n\n`,
  },
};

export function registerAIVoiceHandler(bot) {
  bot.on('voice', async (ctx) => {
    const lang = ctx.state.user?.language || 'tg';
    const t = TEXT[lang] || TEXT.tg;
    const user = ctx.state.user;

    const { allowed } = await checkUserAILimit(user);
    if (!allowed) {
      await ctx.reply(t.limit);
      return;
    }

    const statusMsg = await ctx.reply(t.transcribing);
    let oggPath = null;
    let mp3Path = null;

    try {
      oggPath = await downloadTelegramFile(bot, ctx.message.voice.file_id, 'oga');
      mp3Path = await convertToMp3(oggPath);

      const { text: transcribedText } = await groqAudioTranscription({ filePath: mp3Path });

      if (!transcribedText?.trim()) {
        await ctx.telegram.editMessageText(ctx.chat.id, statusMsg.message_id, undefined, t.error);
        return;
      }

      await ctx.telegram.editMessageText(
        ctx.chat.id,
        statusMsg.message_id,
        undefined,
        `${t.heard(transcribedText)}${t.thinking}`,
        { parse_mode: 'Markdown' },
      );

      let lastEditAt = 0;
      const result = await askMentorStream({
        user,
        userMessage: transcribedText,
        language: lang,
        onChunk: async (partialText) => {
          const now = Date.now();
          if (now - lastEditAt < 1200) return;
          lastEditAt = now;
          try {
            await ctx.telegram.editMessageText(
              ctx.chat.id,
              statusMsg.message_id,
              undefined,
              `${t.heard(transcribedText)}${partialText}▌`,
              { parse_mode: 'Markdown' },
            );
          } catch (e) {
            // игнорируем "message not modified"
          }
        },
      });

      await ctx.telegram.editMessageText(
        ctx.chat.id,
        statusMsg.message_id,
        undefined,
        `${t.heard(transcribedText)}${result.content}`,
        { parse_mode: 'Markdown', reply_markup: aiFeedbackKeyboard(lang).reply_markup },
      );

      await incrementUserAIUsage(user._id, result.tokensUsed);
    } catch (err) {
      logger.error('Ошибка голосового ассистента:', err);
      await ctx.telegram
        .editMessageText(ctx.chat.id, statusMsg.message_id, undefined, t.error)
        .catch(() => ctx.reply(t.error));
    } finally {
      await cleanupTempFile(oggPath);
      await cleanupTempFile(mp3Path);
    }
  });
}

export default registerAIVoiceHandler;
