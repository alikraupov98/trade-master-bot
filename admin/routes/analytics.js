import { Router } from 'express';
import User from '../../src/models/User.js';
import Payment from '../../src/models/Payment.js';
import AIChat from '../../src/models/AIChat.js';
import { requireAdminAuth } from './authGuard.js';

const router = Router();
const DAYS_RANGE = 14;

function lastNDays(n) {
  const days = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    days.push(d);
  }
  return days;
}

router.get('/analytics', requireAdminAuth, async (req, res) => {
  const days = lastNDays(DAYS_RANGE);
  const rangeStart = days[0];

  const [newUsersByDay, revenueByDay, planDistribution, aiMessagesByDay] = await Promise.all([
    User.aggregate([
      { $match: { createdAt: { $gte: rangeStart } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
    ]),
    Payment.aggregate([
      { $match: { status: 'paid', paidAt: { $gte: rangeStart } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$paidAt' } }, total: { $sum: '$amount' } } },
    ]),
    User.aggregate([{ $group: { _id: '$subscription.plan', count: { $sum: 1 } } }]),
    AIChat.aggregate([
      { $unwind: '$messages' },
      { $match: { 'messages.createdAt': { $gte: rangeStart } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$messages.createdAt' } }, count: { $sum: 1 } } },
    ]),
  ]);

  const newUsersMap = Object.fromEntries(newUsersByDay.map((d) => [d._id, d.count]));
  const revenueMap = Object.fromEntries(revenueByDay.map((d) => [d._id, d.total]));
  const aiMessagesMap = Object.fromEntries(aiMessagesByDay.map((d) => [d._id, d.count]));

  const chartData = days.map((d) => {
    const key = d.toISOString().slice(0, 10);
    return {
      date: key,
      newUsers: newUsersMap[key] || 0,
      revenue: revenueMap[key] || 0,
      aiMessages: aiMessagesMap[key] || 0,
    };
  });

  const totalRevenue = revenueByDay.reduce((sum, d) => sum + d.total, 0);
  const totalNewUsers = newUsersByDay.reduce((sum, d) => sum + d.count, 0);

  res.render('analytics', { chartData, planDistribution, totalRevenue, totalNewUsers, daysRange: DAYS_RANGE });
});

export default router;
