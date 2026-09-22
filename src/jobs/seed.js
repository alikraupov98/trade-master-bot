import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/database.js';
import Admin from '../models/Admin.js';
import Course from '../models/Course.js';
import Lesson from '../models/Lesson.js';
import logger from '../utils/errorHandler.js';

async function seedAdmin() {
  const login = process.env.ADMIN_DEFAULT_LOGIN || 'admin';
  const password = process.env.ADMIN_DEFAULT_PASSWORD || 'change_me_on_first_login';

  const existing = await Admin.findOne({ login });
  if (existing) {
    logger.info(`Админ "${login}" уже существует — пропускаем создание.`);
    return;
  }

  const passwordHash = await Admin.hashPassword(password);
  await Admin.create({ login, passwordHash, name: 'Главный администратор', role: 'superadmin' });
  logger.info(`✅ Создан первый админ: логин="${login}", пароль="${password}" (обязательно смените после входа!)`);
}

async function seedDemoCourse() {
  const existing = await Course.findOne({ category: 'basics' });
  if (existing) {
    logger.info('Демо-курс уже существует — пропускаем создание.');
    return;
  }

  const course = await Course.create({
    title: { tg: 'Асосҳои трейдинг', ru: 'Основы трейдинга', en: 'Trading Basics' },
    description: {
      tg: 'Курси муқаддимавӣ барои онҳое, ки навакак ба ҷаҳони трейдинг қадам мегузоранд.',
      ru: 'Вводный курс для тех, кто только начинает изучать трейдинг.',
      en: 'An introductory course for those just starting out in trading.',
    },
    category: 'basics',
    requiredPlan: 'free',
    order: 1,
    isPublished: true,
  });

  const lesson1 = await Lesson.create({
    course: course._id,
    title: { tg: 'Трейдинг чист?', ru: 'Что такое трейдинг?', en: 'What is trading?' },
    content: {
      tg: 'Трейдинг — раванди хариду фурӯши дороиҳои молиявӣ (асъор, крипто, саҳмия) бо мақсади ба даст овардани фоида аз тағйирёбии нарх.\n\n⚠️ Дар ёд дошта бошед: трейдинг хатари гум кардани маблағро дорад. Ин курс танҳо барои мақсадҳои таълимист.',
      ru: 'Трейдинг — это процесс покупки и продажи финансовых активов (валюта, крипто, акции) с целью получения прибыли от изменения цены.\n\n⚠️ Помните: трейдинг сопряжён с риском потери средств. Этот курс создан исключительно в образовательных целях.',
      en: 'Trading is the process of buying and selling financial assets (currency, crypto, stocks) to profit from price changes.\n\n⚠️ Remember: trading carries the risk of losing money. This course is for educational purposes only.',
    },
    type: 'text',
    order: 1,
  });

  course.lessons.push(lesson1._id);
  await course.save();

  logger.info(`✅ Создан демо-курс "${course.title.get('ru')}" с 1 уроком.`);
}

async function main() {
  await connectDatabase();
  await seedAdmin();
  await seedDemoCourse();
  logger.info('🌱 Инициализация БД завершена.');
  await mongoose.connection.close();
  process.exit(0);
}

main().catch((err) => {
  logger.error('Ошибка инициализации БД:', err);
  process.exit(1);
});
