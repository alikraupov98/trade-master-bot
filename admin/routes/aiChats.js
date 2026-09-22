import { Router } from 'express';
import AIChat from '../../src/models/AIChat.js';
import User from '../../src/models/User.js';
import bot from '../../src/config/bot.js';
import { requireAdminAuth } from './authGuard.js';
import logger from '../../src/utils/errorHandler.js';

const router = Router();
const PAGE_SIZE = 20;

/** Список всех AI-диалогов с фильтрами и пагинацией. */
router.get('/ai-chats', requireAdminAuth, async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const { search, escalated } = req.query;

  const query = {};
  if (escalated === '1') query.escalatedToHuman = true;

  let userIds = null;
  if (search) {
    const users = await User.find({
      $or: [
        { username: new RegExp(search, 'i') },
        { firstName: new RegExp(search, 'i') },
        { telegramId: Number(search) || 0 },
      ],
    }).select('_id');
    userIds = users.map((u) => u._id);
    query.user = { $in: userIds };
  }

  const [chats, total] = await Promise.all([
    AIChat.find(query)
      .populate('user', 'firstName username telegramId')
      .sort({ updatedAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean(),
    AIChat.countDocuments(query),
  ]);

  res.render('aiChats', {
    chats,
    page,
    totalPages: Math.ceil(total / PAGE_SIZE),
    search: search || '',
    escalated: escalated === '1',
  });
});

/** Полный просмотр одного диалога. */
router.get('/ai-chats/:id', requireAdminAuth, async (req, res) => {
  const chat = await AIChat.findById(req.params.id).populate('user', 'firstName username telegramId').lean();
  if (!chat) return res.status(404).render('error', { message: 'Диалог не найден' });
  res.render('aiChatDetail', { chat });
});

/** Ручной ответ администратора вместо AI (отправляется напрямую пользователю в Telegram). */
router.post('/ai-chats/:id/reply', requireAdminAuth, async (req, res) => {
  const { text } = req.body;
  const chat = await AIChat.findById(req.params.id).populate('user', 'telegramId');
  if (!chat) return res.status(404).json({ error: 'NOT_FOUND' });

  try {
    await bot.telegram.sendMessage(chat.user.telegramId, `👤 *Специалист:*\n\n${text}`, { parse_mode: 'Markdown' });
    chat.messages.push({ role: 'assistant', content: `[Ручной ответ админа] ${text}`, provider: 'admin' });
    chat.escalatedToHuman = false;
    await chat.save();
    return res.json({ success: true });
  } catch (err) {
    logger.error('Ошибка отправки ручного ответа:', err);
    return res.status(500).json({ error: 'SEND_FAILED' });
  }
});

/** Статистика использования AI (для раздела ai-usage). */
router.get('/ai-usage', requireAdminAuth, async (req, res) => {
  const [totalChats, totalMessages, escalatedCount, ratingStats, topProviders] = await Promise.all([
    AIChat.countDocuments(),
    AIChat.aggregate([{ $project: { count: { $size: '$messages' } } }, { $group: { _id: null, total: { $sum: '$count' } } }]),
    AIChat.countDocuments({ escalatedToHuman: true }),
    AIChat.aggregate([
      { $unwind: '$messages' },
      { $match: { 'messages.ratedGood': { $ne: null } } },
      { $group: { _id: '$messages.ratedGood', count: { $sum: 1 } } },
    ]),
    AIChat.aggregate([
      { $unwind: '$messages' },
      { $match: { 'messages.role': 'assistant' } },
      { $group: { _id: '$messages.provider', count: { $sum: 1 }, tokens: { $sum: '$messages.tokensUsed' } } },
      { $sort: { count: -1 } },
    ]),
  ]);

  const goodCount = ratingStats.find((r) => r._id === true)?.count || 0;
  const badCount = ratingStats.find((r) => r._id === false)?.count || 0;

  res.render('aiUsage', {
    totalChats,
    totalMessages: totalMessages[0]?.total || 0,
    escalatedCount,
    goodCount,
    badCount,
    satisfactionRate: goodCount + badCount > 0 ? Math.round((goodCount / (goodCount + badCount)) * 100) : null,
    topProviders,
  });
});

export default router;
