import { Router } from 'express';
import SupportTicket from '../../src/models/SupportTicket.js';
import bot from '../../src/config/bot.js';
import { requireAdminAuth } from './authGuard.js';
import logger from '../../src/utils/errorHandler.js';

const router = Router();
const PAGE_SIZE = 20;

router.get('/support', requireAdminAuth, async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const status = ['open', 'answered', 'closed'].includes(req.query.status) ? req.query.status : 'open';

  const [tickets, total] = await Promise.all([
    SupportTicket.find({ status })
      .populate('user', 'firstName username telegramId')
      .sort({ updatedAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean(),
    SupportTicket.countDocuments({ status }),
  ]);

  res.render('support', { tickets, status, page, totalPages: Math.ceil(total / PAGE_SIZE) });
});

router.get('/support/:id', requireAdminAuth, async (req, res) => {
  const ticket = await SupportTicket.findById(req.params.id).populate('user', 'firstName username telegramId').lean();
  if (!ticket) return res.status(404).render('error', { message: 'Тикет не найден' });
  res.render('supportDetail', { ticket });
});

router.post('/support/:id/reply', requireAdminAuth, async (req, res) => {
  const { text } = req.body;
  const ticket = await SupportTicket.findById(req.params.id).populate('user', 'telegramId');
  if (!ticket) return res.status(404).json({ error: 'NOT_FOUND' });

  try {
    await bot.telegram.sendMessage(ticket.user.telegramId, `💬 *Дастгирӣ / Поддержка:*\n\n${text}`, { parse_mode: 'Markdown' });
    ticket.messages.push({ from: 'admin', text });
    ticket.status = 'answered';
    ticket.assignedTo = req.admin.id;
    await ticket.save();
    return res.json({ success: true });
  } catch (err) {
    logger.error('Ошибка ответа в тикет поддержки:', err);
    return res.status(500).json({ error: 'SEND_FAILED' });
  }
});

router.post('/support/:id/close', requireAdminAuth, async (req, res) => {
  await SupportTicket.findByIdAndUpdate(req.params.id, { status: 'closed' });
  res.redirect('/support');
});

router.post('/support/:id/reopen', requireAdminAuth, async (req, res) => {
  await SupportTicket.findByIdAndUpdate(req.params.id, { status: 'open' });
  res.redirect(req.get('Referer') || '/support');
});

export default router;
