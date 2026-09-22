import { Router } from 'express';
import User from '../../src/models/User.js';
import Payment from '../../src/models/Payment.js';
import AIChat from '../../src/models/AIChat.js';
import { requireAdminAuth } from './authGuard.js';

const router = Router();

router.get('/dashboard', requireAdminAuth, async (req, res) => {
  const [totalUsers, activeSubs, todayPayments, aiChatsToday] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ 'subscription.plan': { $ne: 'free' } }),
    Payment.aggregate([
      { $match: { status: 'paid', paidAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } } },
      { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
    ]),
    AIChat.countDocuments({ updatedAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } }),
  ]);

  res.render('dashboard', {
    stats: {
      totalUsers,
      activeSubs,
      todayRevenue: todayPayments[0]?.total || 0,
      todayPaymentsCount: todayPayments[0]?.count || 0,
      aiChatsToday,
    },
  });
});

export default router;
