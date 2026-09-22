import { Markup } from 'telegraf';
import SupportTicket from '../models/SupportTicket.js';
import { isMenuButtonText } from '../utils/keyboards.js';
import { publishAdminNotification } from '../services/notificationBridge.js';

const TEXT = {
  tg: {
    ask: '💬 Мушкилоти худро тавсиф кунед — мутахассис ба зудӣ ҷавоб медиҳад:',
    created: '✅ Дархости шумо сабт шуд (№{{id}}). Мо ба зудӣ ҷавоб медиҳем.',
    contactAdmin: '☎️ Бо администратор бевосита тамос гиред',
  },
  ru: {
    ask: '💬 Опишите вашу проблему — специалист скоро ответит:',
    created: '✅ Ваш запрос зарегистрирован (№{{id}}). Мы скоро ответим.',
    contactAdmin: '☎️ Связаться с администратором напрямую',
  },
  en: {
    ask: '💬 Describe your issue — a specialist will reply soon:',
    created: '✅ Your request has been logged (#{{id}}). We will reply soon.',
    contactAdmin: '☎️ Contact administrator directly',
  },
};

function contactAdminKeyboard(lang) {
  const username = process.env.ADMIN_CONTACT_USERNAME;
  if (!username) return undefined;
  const t = TEXT[lang] || TEXT.tg;
  return Markup.inlineKeyboard([[Markup.button.url(t.contactAdmin, `https://t.me/${username}`)]]);
}

export function registerSupportHandler(bot) {
  const startSupport = async (ctx) => {
    const lang = ctx.state.user?.language || 'tg';
    ctx.session.step = 'support_wait_message';
    await ctx.reply(TEXT[lang].ask, contactAdminKeyboard(lang));
  };

  bot.command('support', startSupport);
  bot.hears(['💬 Дастгирӣ', '💬 Поддержка', '💬 Support'], startSupport);

  bot.on('text', async (ctx, next) => {
    if (ctx.session?.step !== 'support_wait_message') return next();

    if (isMenuButtonText(ctx.message.text)) {
      ctx.session.step = null;
      return next();
    }

    const lang = ctx.state.user?.language || 'tg';
    const t = TEXT[lang] || TEXT.tg;
    const isEscalation = !!ctx.session.tempData?.escalatedFromAI;

    const ticket = await SupportTicket.create({
      user: ctx.state.user._id,
      subject: ctx.message.text.slice(0, 60),
      messages: [{ from: 'user', text: ctx.message.text }],
      source: isEscalation ? 'ai_escalation' : 'manual',
    });

    ctx.session.step = null;
    ctx.session.tempData = { ...ctx.session.tempData, escalatedFromAI: false };
    await ctx.reply(t.created.replace('{{id}}', ticket._id.toString().slice(-6)), contactAdminKeyboard(lang));

    publishAdminNotification('new_support_ticket', {
      ticketId: ticket._id.toString(),
      userName: ctx.state.user.firstName || ctx.state.user.username || 'Пользователь',
      preview: ctx.message.text.slice(0, 80),
      fromAI: isEscalation,
    });
  });
}

export default registerSupportHandler;
