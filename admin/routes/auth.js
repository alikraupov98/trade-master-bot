import { Router } from 'express';
import jwt from 'jsonwebtoken';
import Admin from '../../src/models/Admin.js';
import logger from '../../src/utils/errorHandler.js';

const router = Router();

router.get('/login', (req, res) => {
  if (req.cookies?.admin_token) return res.redirect('/dashboard');
  res.render('login', { error: null });
});

router.post('/login', async (req, res) => {
  const { login, password } = req.body;

  try {
    const admin = await Admin.findOne({ login, isActive: true });
    if (!admin || !(await admin.verifyPassword(password))) {
      return res.render('login', { error: 'Неверный логин или пароль' });
    }

    admin.lastLoginAt = new Date();
    await admin.save();

    const token = jwt.sign(
      { id: admin._id.toString(), login: admin.login, name: admin.name, role: admin.role },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' },
    );

    res.cookie('admin_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.redirect('/dashboard');
  } catch (err) {
    logger.error('Ошибка входа в админ-панель:', err);
    return res.render('login', { error: 'Внутренняя ошибка сервера' });
  }
});

router.get('/logout', (req, res) => {
  res.clearCookie('admin_token');
  res.redirect('/login');
});

export default router;
