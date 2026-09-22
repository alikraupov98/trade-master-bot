import { Router } from 'express';
import Payment from '../../src/models/Payment.js';
import { markPaymentPaid } from '../../src/services/paymentService.js';
import { requireAdminAuth } from './authGuard.js';
import bot from '../../src/config/bot.js';
import logger from '../../src/utils/errorHandler.js';

const router = Router();
const PAGE_SIZE = 25;

router.get('/payments', requireAdminAuth, async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const { status, method } = req.query;

  const query = {};
  if (status) query.status = status;
  if (method) query.method = method;

  const [payments, total] = await Promise.all([
    Payment.find(query)
      .populate('user', 'firstName username telegramId')
      .sort({ createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean(),
    Payment.countDocuments(query),
  ]);

  res.render('payments', {
    payments,
    page,
    totalPages: Math.ceil(total / PAGE_SIZE),
    status: status || '',
    method: method || '',
  });
});

/** Ручное подтверждение платежа (для метода manual — после проверки скриншота чека). */
router.post('/payments/:id/approve', requireAdminAuth, async (req, res) => {
  try {
    await markPaymentPaid(req.params.id, { approvedBy: req.admin.id });
  } catch (err) {
    logger.error('Ошибка ручного подтверждения платежа:', err);
  }
  res.redirect(req.get('Referer') || '/payments');
});

router.post('/payments/:id/reject', requireAdminAuth, async (req, res) => {
  await Payment.findByIdAndUpdate(req.params.id, { status: 'failed' });
  res.redirect(req.get('Referer') || '/payments');
});

/** Редирект на изображение чека (Telegram file_id -> временная прямая ссылка). */
router.get('/payments/:id/receipt', requireAdminAuth, async (req, res) => {
  const payment = await Payment.findById(req.params.id).lean();
  if (!payment?.receiptFileId) return res.status(404).render('error', { message: 'Чек не найден' });

  try {
    const fileLink = await bot.telegram.getFileLink(payment.receiptFileId);
    return res.redirect(fileLink.href);
  } catch (err) {
    logger.error('Ошибка получения файла чека:', err);
    return res.status(500).render('error', { message: 'Не удалось загрузить чек' });
  }
});

export default router;
