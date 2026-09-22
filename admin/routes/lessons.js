import { Router } from 'express';
import Lesson from '../../src/models/Lesson.js';
import Course from '../../src/models/Course.js';
import { LESSON_TYPES } from '../../src/config/constants.js';
import { generateMoreLessons } from '../../src/services/aiContentService.js';
import { requireAdminAuth } from './authGuard.js';
import logger from '../../src/utils/errorHandler.js';

const router = Router();

router.get('/courses/:courseId/lessons', requireAdminAuth, async (req, res) => {
  const course = await Course.findById(req.params.courseId).lean();
  if (!course) return res.status(404).render('error', { message: 'Курс не найден' });

  const lessons = await Lesson.find({ course: req.params.courseId }).sort({ order: 1 }).lean();
  res.render('lessons', { course, lessons, lessonTypes: Object.values(LESSON_TYPES) });
});

router.get('/courses/:courseId/lessons/new', requireAdminAuth, async (req, res) => {
  const course = await Course.findById(req.params.courseId).lean();
  if (!course) return res.status(404).render('error', { message: 'Курс не найден' });
  res.render('lessonForm', { course, lesson: null, lessonTypes: Object.values(LESSON_TYPES) });
});

router.get('/courses/:courseId/lessons/:id/edit', requireAdminAuth, async (req, res) => {
  const [course, lesson] = await Promise.all([
    Course.findById(req.params.courseId).lean(),
    Lesson.findById(req.params.id).lean(),
  ]);
  if (!course || !lesson) return res.status(404).render('error', { message: 'Не найдено' });
  res.render('lessonForm', { course, lesson, lessonTypes: Object.values(LESSON_TYPES) });
});

router.post('/courses/:courseId/lessons', requireAdminAuth, async (req, res) => {
  const { titleTg, titleRu, titleEn, contentTg, contentRu, contentEn, type, mediaUrls, order } = req.body;

  const lesson = await Lesson.create({
    course: req.params.courseId,
    title: { tg: titleTg, ru: titleRu, en: titleEn },
    content: { tg: contentTg || '', ru: contentRu || '', en: contentEn || '' },
    type,
    mediaUrls: mediaUrls ? mediaUrls.split(',').map((u) => u.trim()).filter(Boolean) : [],
    order: Number(order) || 0,
  });

  await Course.findByIdAndUpdate(req.params.courseId, { $addToSet: { lessons: lesson._id } });
  res.redirect(`/courses/${req.params.courseId}/lessons`);
});

router.post('/courses/:courseId/lessons/generate-more', requireAdminAuth, async (req, res) => {
  const { lessonCount } = req.body;

  try {
    const { addedCount } = await generateMoreLessons({
      courseId: req.params.courseId,
      lessonCount: Math.min(Math.max(Number(lessonCount) || 5, 1), 50),
    });
    logger.info(`✅ В курс добавлено ${addedCount} AI-уроков через админку`);
    return res.redirect(`/courses/${req.params.courseId}/lessons`);
  } catch (err) {
    logger.error('Ошибка дополнения курса AI-уроками:', err);
    return res.status(500).render('error', { message: 'Не удалось сгенерировать уроки: ' + err.message });
  }
});

router.post('/courses/:courseId/lessons/:id', requireAdminAuth, async (req, res) => {
  const { titleTg, titleRu, titleEn, contentTg, contentRu, contentEn, type, mediaUrls, order } = req.body;

  await Lesson.findByIdAndUpdate(req.params.id, {
    title: { tg: titleTg, ru: titleRu, en: titleEn },
    content: { tg: contentTg || '', ru: contentRu || '', en: contentEn || '' },
    type,
    mediaUrls: mediaUrls ? mediaUrls.split(',').map((u) => u.trim()).filter(Boolean) : [],
    order: Number(order) || 0,
  });

  res.redirect(`/courses/${req.params.courseId}/lessons`);
});

router.post('/courses/:courseId/lessons/:id/delete', requireAdminAuth, async (req, res) => {
  await Lesson.findByIdAndDelete(req.params.id);
  await Course.findByIdAndUpdate(req.params.courseId, { $pull: { lessons: req.params.id } });
  res.redirect(`/courses/${req.params.courseId}/lessons`);
});

export default router;
