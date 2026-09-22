import {
  createPayment,
  createAlifInvoice,
  createEskhataPayment,
  createCryptoInvoice,
  submitManualReceipt,
} from '../services/paymentService.js';
import { SUBSCRIPTION_PLANS } from '../config/constants.js';
import { isMenuButtonText } from '../utils/keyboards.js';
import { publishAdminNotification } from '../services/notificationBridge.js';
import logger from '../utils/errorHandler.js';

const TEXT = {
  tg: {
    creating: '⏳ Дар ҳоли эҷоди пардохт...',
    invoiceReady: (url) => `✅ Барои пардохт пахш кунед:\n${url}`,
    unavailable: '⚠️ Ин тарзи пардохт ҳоло дастрас нест. Лутфан тарзи дигарро интихоб кунед ё бо дастгирӣ тамос гиред.',
    manualCard: (card, amount) =>
      `💳 Лутфан ${amount} сомониро ба корти зерин гузаронед:\n\n\`${card}\`\n\nБаъд аз пардохт, скриншоти чекро ба ин ҷо фиристед.`,
    receiptSaved: '✅ Чек қабул шуд! Мутахассис онро тафтиш карда, тарифи шуморо фаъол мекунад (то 24 соат).',
    needScreenshot: 'Лутфан скриншоти чекро ҳамчун акс фиристед.',
  },
  ru: {
    creating: '⏳ Создаю счёт...',
    invoiceReady: (url) => `✅ Для оплаты нажмите:\n${url}`,
    unavailable: '⚠️ Этот способ оплаты временно недоступен. Выберите другой метод или свяжитесь с поддержкой.',
    manualCard: (card, amount) =>
      `💳 Переведите ${amount} сомони на карту:\n\n\`${card}\`\n\nПосле оплаты отправьте сюда скриншот чека.`,
    receiptSaved: '✅ Чек получен! Специалист проверит его и активирует тариф (в течение 24 часов).',
    needScreenshot: 'Пожалуйста, отправьте скриншот чека как изображение.',
  },
  en: {
    creating: '⏳ Creating invoice...',
    invoiceReady: (url) => `✅ Tap to pay:\n${url}`,
    unavailable: '⚠️ This payment method is temporarily unavailable. Choose another or contact support.',
    manualCard: (card, amount) =>
      `💳 Transfer ${amount} TJS to card:\n\n\`${card}\`\n\nAfter payment, send a screenshot of the receipt here.`,
    receiptSaved: '✅ Receipt received! A specialist will verify it and activate your plan (within 24 hours).',
    needScreenshot: 'Please send the receipt screenshot as an image.',
  },
};

export function registerPaymentHandler(bot) {
  bot.action(/^pay_(alif|eskhata|humo|crypto|manual)_(silver|gold|diamond)$/, async (ctx) => {
    const [, method, plan] = ctx.match;
    const lang = ctx.state.user?.language || 'tg';
    const t = TEXT[lang] || TEXT.tg;
    const user = ctx.state.user;
    const planConfig = SUBSCRIPTION_PLANS[plan.toUpperCase()];

    await ctx.answerCbQuery();
    await ctx.reply(t.creating);

    try {
      const payment = await createPayment({ userId: user._id, plan, method });

      if (method === 'manual') {
        ctx.session.step = 'awaiting_receipt';
        ctx.session.tempData = { paymentId: payment._id.toString() };
        await ctx.reply(t.manualCard(process.env.MANUAL_PAYMENT_CARD || '---', planConfig.price));
        return;
      }

      let invoiceUrl;
      if (method === 'alif') {
        const result = await createAlifInvoice(payment);
        invoiceUrl = result.invoiceUrl;
        payment.externalId = result.externalId;
      } else if (method === 'eskhata') {
        const result = await createEskhataPayment(payment);
        invoiceUrl = result.paymentUrl;
        payment.externalId = result.externalId;
      } else if (method === 'crypto') {
        const result = await createCryptoInvoice(payment);
        invoiceUrl = result.invoiceUrl;
        payment.externalId = result.externalId;
      } else {
        throw new Error(`${method.toUpperCase()}_INTEGRATION_PENDING`);
      }

      await payment.save();
      await ctx.reply(t.invoiceReady(invoiceUrl));
    } catch (err) {
      logger.warn(`Платёжный метод ${method} недоступен: ${err.message}`);
      await ctx.reply(t.unavailable);
    }
  });

  bot.on('photo', async (ctx, next) => {
    if (ctx.session?.step !== 'awaiting_receipt') return next();

    const lang = ctx.state.user?.language || 'tg';
    const t = TEXT[lang] || TEXT.tg;
    const paymentId = ctx.session.tempData?.paymentId;
    if (!paymentId) return next();

    const photos = ctx.message.photo;
    const largestPhoto = photos[photos.length - 1];

    try {
      const payment = await submitManualReceipt(paymentId, largestPhoto.file_id);
      ctx.session.step = null;
      ctx.session.tempData = {};
      await ctx.reply(t.receiptSaved);

      publishAdminNotification('new_payment_receipt', {
        paymentId: payment._id.toString(),
        userName: ctx.state.user.firstName || ctx.state.user.username || 'Пользователь',
        amount: payment.amount,
        plan: payment.plan,
      });
    } catch (err) {
      logger.error('Ошибка сохранения чека:', err);
    }
  });

  bot.on('text', async (ctx, next) => {
    if (ctx.session?.step !== 'awaiting_receipt') return next();

    if (isMenuButtonText(ctx.message.text)) {
      ctx.session.step = null;
      return next();
    }

    const lang = ctx.state.user?.language || 'tg';
    await ctx.reply((TEXT[lang] || TEXT.tg).needScreenshot);
  });
}

export default registerPaymentHandler;
