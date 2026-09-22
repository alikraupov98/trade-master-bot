import { Router } from 'express';
import Course from '../../src/models/Course.js';
import Lesson from '../../src/models/Lesson.js';
import { COURSE_CATEGORIES } from '../../src/config/constants.js';
import { generateFullCourse } from '../../src/services/aiContentService.js';
import { requireAdminAuth } from './authGuard.js';
import logger from '../../src/utils/errorHandler.js';

const router = Router();

router.get('/courses', requireAdminAuth, async (req, res) => {
  const courses = await Course.find().sort({ category: 1, order: 1 }).lean();
  const lessonCounts = await Lesson.aggregate([{ $group: { _id: '$course', count: { $sum: 1 } } }]);
  const countMap = Object.fromEntries(lessonCounts.map((c) => [c._id.toString(), c.count]));

  res.render('courses', {
    courses: courses.map((c) => ({ ...c, lessonCount: countMap[c._id.toString()] || 0 })),
    categories: COURSE_CATEGORIES,
  });
});

router.get('/courses/new', requireAdminAuth, (req, res) => {
  res.render('courseForm', { course: null, categories: COURSE_CATEGORIES });
});

router.post('/courses/generate-ai', requireAdminAuth, async (req, res) => {
  const { category, lessonCount, requiredPlan } = req.body;

  try {
    const course = await generateFullCourse({
      category,
      lessonCount: Math.min(Math.max(Number(lessonCount) || 5, 1), 100),
      requiredPlan: requiredPlan || 'free',
    });
    return res.redirect(`/courses/${course._id}/lessons`);
  } catch (err) {
    logger.error('Ошибка AI-генерации курса:', err);
    return res.status(500).render('error', { message: 'Не удалось сгенерировать курс: ' + err.message });
  }
});

router.get('/courses/:id/edit', requireAdminAuth, async (req, res) => {
  const course = await Course.findById(req.params.id).lean();
  if (!course) return res.status(404).render('error', { message: 'Курс не найден' });
  res.render('courseForm', { course, categories: COURSE_CATEGORIES });
});

router.post('/courses', requireAdminAuth, async (req, res) => {
  const { titleTg, titleRu, titleEn, descTg, descRu, descEn, category, requiredPlan, order, coverImage } = req.body;

  await Course.create({
    title: { tg: titleTg, ru: titleRu, en: titleEn },
    description: { tg: descTg || '', ru: descRu || '', en: descEn || '' },
    category,
    requiredPlan,
    order: Number(order) || 0,
    coverImage: coverImage || null,
    isPublished: req.body.isPublished === 'on',
  });

  res.redirect('/courses');
});

router.post('/courses/:id', requireAdminAuth, async (req, res) => {
  const { titleTg, titleRu, titleEn, descTg, descRu, descEn, category, requiredPlan, order, coverImage } = req.body;

  await Course.findByIdAndUpdate(req.params.id, {
    title: { tg: titleTg, ru: titleRu, en: titleEn },
    description: { tg: descTg || '', ru: descRu || '', en: descEn || '' },
    category,
    requiredPlan,
    order: Number(order) || 0,
    coverImage: coverImage || null,
    isPublished: req.body.isPublished === 'on',
  });

  res.redirect('/courses');
});

router.post('/courses/:id/toggle-publish', requireAdminAuth, async (req, res) => {
  const course = await Course.findById(req.params.id);
  if (course) {
    course.isPublished = !course.isPublished;
    await course.save();
  }
  res.redirect(req.get('Referer') || '/courses');
});

router.post('/courses/:id/delete', requireAdminAuth, async (req, res) => {
  await Lesson.deleteMany({ course: req.params.id });
  await Course.findByIdAndDelete(req.params.id);
  res.redirect('/courses');
});

export default router;
