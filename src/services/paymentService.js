import axios from 'axios';
import crypto from 'crypto';
import Payment from '../models/Payment.js';
import Subscription from '../models/Subscription.js';
import User from '../models/User.js';
import { SUBSCRIPTION_PLANS } from '../config/constants.js';
import logger from '../utils/errorHandler.js';
import { creditFirstPaymentBonus } from './referralService.js';

const SUBSCRIPTION_DAYS = 30;

/**
 * Создаёт запись о платеже в статусе "pending" для выбранного тарифа и способа оплаты.
 */
export async function createPayment({ userId, plan, method }) {
  const planKey = plan.toUpperCase();
  const planConfig = SUBSCRIPTION_PLANS[planKey];
  if (!planConfig || planConfig.price === 0) {
    throw new Error('INVALID_PLAN');
  }

  const payment = await Payment.create({
    user: userId,
    plan,
    amount: planConfig.price,
    currency: 'TJS',
    method,
    status: 'pending',
  });

  return payment;
}

/**
 * Активирует (или продлевает) подписку пользователя после успешной оплаты.
 * Если у пользователя уже есть активная подписка того же или более высокого уровня —
 * продлевает срок действия, а не создаёт дубликат.
 */
export async function activateSubscription({ userId, plan, paymentId }) {
  const now = new Date();
  const existing = await Subscription.findOne({ user: userId, status: 'active' }).sort({ expiresAt: -1 });

  const baseDate = existing && existing.expiresAt > now ? existing.expiresAt : now;
  const expiresAt = new Date(baseDate.getTime() + SUBSCRIPTION_DAYS * 24 * 60 * 60 * 1000);

  if (existing) {
    existing.status = 'expired';
    await existing.save();
  }

  const subscription = await Subscription.create({
    user: userId,
    plan,
    expiresAt,
    payment: paymentId || null,
    status: 'active',
  });

  await User.updateOne(
    { _id: userId },
    { $set: { 'subscription.plan': plan, 'subscription.expiresAt': expiresAt } },
  );

  logger.info(`✅ Подписка ${plan} активирована для пользователя ${userId} до ${expiresAt.toISOString()}`);
  return subscription;
}

/**
 * Помечает платёж оплаченным и активирует подписку. Используется вебхуками и ручным подтверждением.
 */
export async function markPaymentPaid(paymentId, { externalId, rawPayload, approvedBy } = {}) {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw new Error('PAYMENT_NOT_FOUND');
  if (payment.status === 'paid') return payment; // защита от повторной обработки вебхука

  payment.status = 'paid';
  payment.paidAt = new Date();
  if (externalId) payment.externalId = externalId;
  if (rawPayload) payment.rawPayload = rawPayload;
  if (approvedBy) payment.approvedBy = approvedBy;
  await payment.save();

  await activateSubscription({ userId: payment.user, plan: payment.plan, paymentId: payment._id });
  creditFirstPaymentBonus(payment.user, payment._id).catch((err) =>
    logger.warn('Ошибка начисления реферального бонуса за оплату:', err.message),
  );
  return payment;
}

// ============================================================
// ALIF MOBI — оплата через QR / deep link
// ⚠️ Реальная интеграция требует мерчант-договора с Alif и доступа к их
// официальной документации API (эндпоинты и формат подписи предоставляются
// персонально после подключения). Ниже — типовой каркас интеграции
// online-эквайринга: создание счёта + верификация подписи вебхука по HMAC.
// Замените ALIF_API_URL и логику подписи на актуальные из документации Alif после получения доступа.
// ============================================================
export async function createAlifInvoice(payment) {
  if (!process.env.ALIF_MERCHANT_ID || !process.env.ALIF_API_KEY) {
    throw new Error('ALIF_NOT_CONFIGURED');
  }
  try {
    const { data } = await axios.post(
      `${process.env.ALIF_API_URL}/invoice/create`,
      {
        merchant_id: process.env.ALIF_MERCHANT_ID,
        order_id: payment._id.toString(),
        amount: payment.amount,
        currency: payment.currency,
        callback_url: `${process.env.APP_URL}/api/webhooks/alif`,
      },
      { headers: { Authorization: `Bearer ${process.env.ALIF_API_KEY}` }, timeout: 15_000 },
    );
    return { invoiceUrl: data.payment_url, externalId: data.invoice_id };
  } catch (err) {
    logger.error('Ошибка создания счёта Alif:', err.message);
    throw new Error('ALIF_INVOICE_FAILED');
  }
}

/** Верифицирует подпись вебхука Alif (типовая HMAC-SHA256 схема — уточните у Alif точный алгоритм). */
export function verifyAlifSignature(payload, signature) {
  if (!process.env.ALIF_API_KEY) return false;
  const expected = crypto
    .createHmac('sha256', process.env.ALIF_API_KEY)
    .update(JSON.stringify(payload))
    .digest('hex');
  return expected === signature;
}

// ============================================================
// ESKHATA BANK — интернет-эквайринг по номеру карты
// ⚠️ Аналогично Alif — требует официального подключения к процессинговому центру Eskhata.
// Каркас ниже иллюстрирует стандартный флоу: создание платежа -> редирект/SMS -> вебхук.
// ============================================================
export async function createEskhataPayment(payment) {
  if (!process.env.ESKHATA_MERCHANT_ID || !process.env.ESKHATA_API_KEY) {
    throw new Error('ESKHATA_NOT_CONFIGURED');
  }
  try {
    const { data } = await axios.post(
      `${process.env.ESKHATA_API_URL}/payments`,
      {
        merchant_id: process.env.ESKHATA_MERCHANT_ID,
        order_id: payment._id.toString(),
        amount: payment.amount,
      },
      { headers: { Authorization: `Bearer ${process.env.ESKHATA_API_KEY}` }, timeout: 15_000 },
    );
    return { paymentUrl: data.redirect_url, externalId: data.transaction_id };
  } catch (err) {
    logger.error('Ошибка создания платежа Eskhata:', err.message);
    throw new Error('ESKHATA_PAYMENT_FAILED');
  }
}

// ============================================================
// HUMO / КОРТИ МИЛЛИ
// ⚠️ Требует подключения к процессинговому центру Humo (аналогичный флоу).
// ============================================================
export async function createHumoPayment(payment) {
  if (!process.env.HUMO_MERCHANT_ID || !process.env.HUMO_API_KEY) {
    throw new Error('HUMO_NOT_CONFIGURED');
  }
  logger.info(`Создание платежа Humo для заказа ${payment._id} (требует актуальных данных API от процессинга Humo)`);
  throw new Error('HUMO_INTEGRATION_PENDING');
}

// ============================================================
// CRYPTO (NowPayments) — реальное публичное API, работает "из коробки" с бесплатным аккаунтом
// Документация: https://documenter.getpostman.com/view/7907941/S1a32n38
// ============================================================
export async function createCryptoInvoice(payment) {
  if (!process.env.NOWPAYMENTS_API_KEY) {
    throw new Error('NOWPAYMENTS_NOT_CONFIGURED');
  }
  try {
    const { data } = await axios.post(
      'https://api.nowpayments.io/v1/invoice',
      {
        price_amount: payment.amount,
        price_currency: 'TJS',
        pay_currency: 'usdttrc20',
        order_id: payment._id.toString(),
        order_description: `TradeMaster AI TJ — тариф ${payment.plan}`,
        ipn_callback_url: `${process.env.APP_URL}/api/webhooks/nowpayments`,
        success_url: `${process.env.APP_URL}/payment/success`,
        cancel_url: `${process.env.APP_URL}/payment/cancel`,
      },
      { headers: { 'x-api-key': process.env.NOWPAYMENTS_API_KEY }, timeout: 15_000 },
    );
    return { invoiceUrl: data.invoice_url, externalId: data.id };
  } catch (err) {
    logger.error('Ошибка создания крипто-счёта NowPayments:', err.response?.data || err.message);
    throw new Error('CRYPTO_INVOICE_FAILED');
  }
}

/** Верифицирует IPN-подпись NowPayments (HMAC-SHA512 отсортированного JSON — по их официальной документации). */
export function verifyNowPaymentsSignature(payload, signature) {
  if (!process.env.NOWPAYMENTS_IPN_SECRET) return false;
  const sorted = JSON.stringify(payload, Object.keys(payload).sort());
  const expected = crypto
    .createHmac('sha512', process.env.NOWPAYMENTS_IPN_SECRET)
    .update(sorted)
    .digest('hex');
  return expected === signature;
}

// ============================================================
// РУЧНОЙ МЕТОД (fallback) — работает полностью "из коробки" без внешних API
// ============================================================
export async function submitManualReceipt(paymentId, receiptFileId) {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw new Error('PAYMENT_NOT_FOUND');

  payment.receiptFileId = receiptFileId;
  await payment.save();
  return payment;
}

export default {
  createPayment,
  activateSubscription,
  markPaymentPaid,
  createAlifInvoice,
  verifyAlifSignature,
  createEskhataPayment,
  createHumoPayment,
  createCryptoInvoice,
  verifyNowPaymentsSignature,
  submitManualReceipt,
};
