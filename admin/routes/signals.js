import { Router } from 'express';
import Signal from '../../src/models/Signal.js';
import { createAndBroadcastSignal } from '../../src/services/signalService.js';
import { requireAdminAuth } from './authGuard.js';
import logger from '../../src/utils/errorHandler.js';

const router = Router();

router.get('/signals', requireAdminAuth, async (req, res) => {
  const signals = await Signal.find().sort({ createdAt: -1 }).limit(50).lean();
  res.render('signals', { signals, result: null });
});

router.get('/signals/new', requireAdminAuth, (req, res) => {
  res.render('signalForm');
});

/** Создаёт сигнал и сразу рассылает его всем подходящим по тарифу пользователям. */
router.post('/signals', requireAdminAuth, async (req, res) => {
  const { pair, direction, entryPrice, stopLoss, takeProfit, timeframe, requiredPlan, descTg, descRu, descEn } = req.body;

  try {
    const { signal, sent } = await createAndBroadcastSignal(
      {
        pair: pair.toUpperCase(),
        direction,
        entryPrice: Number(entryPrice),
        stopLoss: Number(stopLoss),
        takeProfit: takeProfit.split(',').map((v) => Number(v.trim())).filter((v) => !Number.isNaN(v)),
        timeframe,
        requiredPlan,
        description: { tg: descTg || '', ru: descRu || '', en: descEn || '' },
      },
      req.admin.id,
    );

    const signals = await Signal.find().sort({ createdAt: -1 }).limit(50).lean();
    return res.render('signals', { signals, result: { sent, pair: signal.pair } });
  } catch (err) {
    logger.error('Ошибка создания сигнала:', err);
    return res.status(500).render('error', { message: 'Не удалось создать сигнал: ' + err.message });
  }
});

router.post('/signals/:id/close', requireAdminAuth, async (req, res) => {
  const { status } = req.body; // closed_profit | closed_loss | cancelled
  await Signal.findByIdAndUpdate(req.params.id, { status, closedAt: new Date() });
  res.redirect('/signals');
});

export default router;
