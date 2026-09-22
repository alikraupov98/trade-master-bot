import { Router } from 'express';
import User from '../../src/models/User.js';
import { requireAdminAuth } from './authGuard.js';

const router = Router();
const PAGE_SIZE = 25;

router.get('/users', requireAdminAuth, async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const { search, plan } = req.query;

  const query = {};
  if (search) {
    query.$or = [
      { username: new RegExp(search, 'i') },
      { firstName: new RegExp(search, 'i') },
      { telegramId: Number(search) || 0 },
    ];
  }
  if (plan) query['subscription.plan'] = plan;

  const [users, total] = await Promise.all([
    User.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * PAGE_SIZE)
      .limit(PAGE_SIZE)
      .lean(),
    User.countDocuments(query),
  ]);

  res.render('users', {
    users,
    page,
    totalPages: Math.ceil(total / PAGE_SIZE),
    search: search || '',
    plan: plan || '',
  });
});

router.post('/users/:id/ban', requireAdminAuth, async (req, res) => {
  const user = await User.findById(req.params.id);
  if (user) {
    user.isBanned = !user.isBanned;
    await user.save();
  }
  res.redirect(req.get('Referer') || '/users');
});

router.post('/users/:id/plan', requireAdminAuth, async (req, res) => {
  const { plan, days } = req.body;
  const user = await User.findById(req.params.id);
  if (user) {
    user.subscription.plan = plan;
    user.subscription.expiresAt = plan === 'free' ? null : new Date(Date.now() + Number(days || 30) * 86400000);
    await user.save();
  }
  res.redirect(req.get('Referer') || '/users');
});

export default router;
