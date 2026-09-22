import Course from '../models/Course.js';
import Lesson from '../models/Lesson.js';
import User from '../models/User.js';
import { SUBSCRIPTION_PLANS } from '../config/constants.js';
import { checkAchievements } from './gamificationService.js';

const PLAN_ORDER = ['free', 'silver', 'gold', 'diamond'];

/** Проверяет, достаточен ли тариф пользователя для доступа к курсу. */
export function hasAccessToPlan(userPlan, requiredPlan) {
  return PLAN_ORDER.indexOf(userPlan) >= PLAN_ORDER.indexOf(requiredPlan);
}

/** Возвращает список опубликованных курсов, отсортированных по порядку. */
export async function listCourses({ category } = {}) {
  const query = { isPublished: true };
  if (category) query.category = category;
  return Course.find(query).sort({ order: 1 }).lean();
}

/** Возвращает курс со списком уроков. */
export async function getCourseWithLessons(courseId) {
  const course = await Course.findById(courseId).lean();
  if (!course) return null;
  const lessons = await Lesson.find({ course: courseId }).sort({ order: 1 }).lean();
  return { ...course, lessons };
}

/** Отмечает урок как пройденный и начисляет XP. */
export async function completeLesson(userId, lessonId, xpReward = 10) {
  const user = await User.findById(userId);
  if (!user) throw new Error('USER_NOT_FOUND');

  const alreadyCompleted = user.progress.completedLessons.some((id) => id.toString() === lessonId.toString());
  if (!alreadyCompleted) {
    user.progress.completedLessons.push(lessonId);
    user.progress.xp += xpReward;
    // Простая формула повышения уровня: каждые 100 XP — новый уровень
    user.progress.level = Math.floor(user.progress.xp / 100) + 1;
    await user.save();
  }

  return { xp: user.progress.xp, level: user.progress.level, alreadyCompleted };
}

/** Отдельная обёртка, вызывающая проверку достижений после завершения урока (без блокировки основного потока). */
export async function completeLessonAndCheckAchievements(userId, lessonId, xpReward = 10) {
  const result = await completeLesson(userId, lessonId, xpReward);
  checkAchievements(userId).catch(() => {});
  return result;
}

export default { hasAccessToPlan, listCourses, getCourseWithLessons, completeLesson };
