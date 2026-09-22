import 'dotenv/config';
import express from 'express';
import 'express-async-errors';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import path from 'path';
import http from 'http';
import jwt from 'jsonwebtoken';
import { Server as SocketIOServer } from 'socket.io';
import { fileURLToPath } from 'url';
import { connectDatabase } from '../src/config/database.js';
import redisClient from '../src/config/redis.js';
import { ADMIN_NOTIFICATIONS_CHANNEL } from '../src/services/notificationBridge.js';
import SupportTicket from '../src/models/SupportTicket.js';
import Payment from '../src/models/Payment.js';
import logger from '../src/utils/errorHandler.js';

import authRoutes from './routes/auth.js';
import dashboardRoutes from './routes/dashboard.js';
import aiChatsRoutes from './routes/aiChats.js';
import aiKnowledgeRoutes from './routes/aiKnowledge.js';
import usersRoutes from './routes/users.js';
import paymentsRoutes from './routes/payments.js';
import aiPromptsRoutes from './routes/aiPrompts.js';
import settingsRoutes from './routes/settings.js';
import coursesRoutes from './routes/courses.js';
import lessonsRoutes from './routes/lessons.js';
import analyticsRoutes from './routes/analytics.js';
import broadcastsRoutes from './routes/broadcasts.js';
import aiTranslateRoutes from './routes/aiTranslate.js';
import supportRoutes from './routes/support.js';
import signalsRoutes from './routes/signals.js';
import lessonsRedirectRoutes from './routes/lessonsRedirect.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const httpServer = http.createServer(app);
const io = new SocketIOServer(httpServer);
const PORT = Number(process.env.ADMIN_PORT || 4000);

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use('/public', express.static(path.join(__dirname, 'public')));

app.use(async (req, res, next) => {
  try {
    const [openTickets, pendingPayments] = await Promise.all([
      SupportTicket.countDocuments({ status: 'open' }),
      Payment.countDocuments({ status: 'pending', method: 'manual' }),
    ]);
    res.locals.badgeCounts = { support: openTickets, payments: pendingPayments };
  } catch (err) {
    res.locals.badgeCounts = { support: 0, payments: 0 };
  }
  next();
});

app.get('/', (req, res) => res.redirect('/dashboard'));
app.use(authRoutes);
app.use(dashboardRoutes);
app.use(aiChatsRoutes);
app.use(aiKnowledgeRoutes);
app.use(usersRoutes);
app.use(paymentsRoutes);
app.use(aiPromptsRoutes);
app.use(settingsRoutes);
app.use(coursesRoutes);
app.use(lessonsRoutes);
app.use(analyticsRoutes);
app.use(broadcastsRoutes);
app.use(aiTranslateRoutes);
app.use(supportRoutes);
app.use(signalsRoutes);
app.use(lessonsRedirectRoutes);

app.use((req, res) => {
  res.status(404).render('error', { message: 'Страница не найдена' });
});

app.use((err, req, res, next) => {
  logger.error(`Ошибка админ-панели [${req.method} ${req.originalUrl}]: ${err?.message || err}`, err);

  if (err instanceof mongoose.Error.CastError) {
    return res.status(400).render('error', { message: 'Некорректный идентификатор записи в ссылке.' });
  }

  const isDev = process.env.NODE_ENV !== 'production';
  return res.status(500).render('error', {
    message: isDev ? `Внутренняя ошибка: ${err?.message || err}` : 'Внутренняя ошибка сервера. Мы уже разбираемся.',
  });
});

io.use((socket, next) => {
  try {
    const cookieHeader = socket.handshake.headers.cookie || '';
    const match = cookieHeader.match(/admin_token=([^;]+)/);
    if (!match) return next(new Error('unauthorized'));
    jwt.verify(decodeURIComponent(match[1]), process.env.JWT_SECRET);
    return next();
  } catch (err) {
    return next(new Error('unauthorized'));
  }
});

io.on('connection', (socket) => {
  logger.info(`🔌 Админ подключился к live-уведомлениям (socket ${socket.id})`);
  socket.on('disconnect', () => {
    logger.info(`🔌 Админ отключился от live-уведомлений (socket ${socket.id})`);
  });
});

async function startNotificationBridge() {
  const subscriber = redisClient.duplicate();
  await subscriber.subscribe(ADMIN_NOTIFICATIONS_CHANNEL);
  subscriber.on('message', (channel, message) => {
    try {
      const data = JSON.parse(message);
      io.emit('admin_notification', data);
    } catch (err) {
      logger.warn(`Не удалось разобрать уведомление из Redis: ${err.message}`);
    }
  });
  logger.info('📡 Мост live-уведомлений (Redis → Socket.io) запущен');
}

async function bootstrap() {
  await connectDatabase();
  await startNotificationBridge();
  httpServer.listen(PORT, () => {
    logger.info(`🛡 Админ-панель запущена на http://localhost:${PORT}`);
  });
}

bootstrap();
