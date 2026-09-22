import Course from '../models/Course.js';
import { COURSE_CATEGORIES } from '../config/constants.js';
import { generateFullCourse } from '../services/aiContentService.js';
import logger from '../utils/errorHandler.js';

export async function runAutoCourseGeneration() {
  for (const category of COURSE_CATEGORIES) {
    const existing = await Course.countDocuments({ category });
    if (existing > 0) continue;

    try {
      logger.info(`🤖 Автогенерация: категория "${category}" пуста, создаю курс...`);
      const course = await generateFullCourse({ category, lessonCount: 5, requiredPlan: 'free' });
      logger.info(`✅ Автогенерация завершена: курс "${course.title.get('ru')}" добавлен в категорию "${category}"`);
    } catch (err) {
      logger.error(`Ошибка автогенерации курса для категории "${category}": ${err.message}`);
    }

    return;
  }

  logger.info('🤖 Автогенерация курсов: все категории уже заполнены, пропускаю.');
}

export default runAutoCourseGeneration;
