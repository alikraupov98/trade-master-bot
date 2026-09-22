import { Telegraf, session } from 'telegraf';
import logger from '../utils/errorHandler.js';

if (!process.env.BOT_TOKEN) {
  throw new Error('BOT_TOKEN не задан в .env');
}

const bot = new Telegraf(process.env.BOT_TOKEN, {
  handlerTimeout: 90_000,
});

bot.use(session({
  defaultSession: () => ({
    language: 'tg',
    step: null,
    tempData: {},
    aiContext: [],
  }),
}));

bot.catch((err, ctx) => {
  logger.error(`Ошибка в обработчике для ${ctx.updateType}:`, err);
  ctx.reply('⚠️ Хатогӣ рух дод. Лутфан баъдтар кӯшиш кунед. / Произошла ошибка, попробуйте позже.').catch(() => {});
});

/** Определяет, что ошибка Telegram вызвана именно неразбираемой Markdown/HTML-разметкой. */
function isParseEntitiesError(err) {
  const desc = err?.response?.description || err?.message || '';
  return desc.includes("can't parse entities") || desc.includes('parse entities');
}

// ВАЖНО: динамический текст (ссылки с подчёркиваниями, ответы AI, пользовательский ввод)
// часто содержит символы (_, *, [, ` и т.д.), которые ломают строгий парсер Telegram Markdown —
// сообщение целиком не доходит до пользователя, а бот выглядит "не работающим". Патчим
// sendMessage/editMessageText: при ошибке разбора разметки автоматически повторяем отправку
// тем же текстом, но БЕЗ форматирования — пользователь в любом случае получит сообщение.
const originalSendMessage = bot.telegram.sendMessage.bind(bot.telegram);
bot.telegram.sendMessage = async (chatId, text, extra) => {
  try {
    return await originalSendMessage(chatId, text, extra);
  } catch (err) {
    if (isParseEntitiesError(err) && extra?.parse_mode) {
      logger.warn(`Markdown/HTML-разбор не удался, повторяю без форматирования: ${err.message}`);
      const { parse_mode, ...rest } = extra;
      return originalSendMessage(chatId, text, rest);
    }
    throw err;
  }
};

const originalEditMessageText = bot.telegram.editMessageText.bind(bot.telegram);
bot.telegram.editMessageText = async (chatId, messageId, inlineMessageId, text, extra) => {
  try {
    return await originalEditMessageText(chatId, messageId, inlineMessageId, text, extra);
  } catch (err) {
    if (isParseEntitiesError(err) && extra?.parse_mode) {
      logger.warn(`Markdown/HTML-разбор не удался при редактировании, повторяю без форматирования: ${err.message}`);
      const { parse_mode, ...rest } = extra;
      return originalEditMessageText(chatId, messageId, inlineMessageId, text, rest);
    }
    throw err;
  }
};

export default bot;
