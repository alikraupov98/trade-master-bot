// Общие константы проекта

export const SUBSCRIPTION_PLANS = {
  FREE: {
    id: 'free',
    nameTg: 'Бепул',
    price: 0,
    aiRequestsPerDay: 3,
    features: ['basic_course'],
  },
  SILVER: {
    id: 'silver',
    nameTg: 'Нуқрагӣ',
    price: Number(process.env.PRICE_SILVER || 299),
    aiRequestsPerDay: 50,
    features: ['all_courses', 'ai_mentor'],
  },
  GOLD: {
    id: 'gold',
    nameTg: 'Тиллоӣ',
    price: Number(process.env.PRICE_GOLD || 599),
    aiRequestsPerDay: -1, // безлимит
    features: ['all_courses', 'ai_mentor', 'vip_signals', 'unlimited_ai'],
  },
  DIAMOND: {
    id: 'diamond',
    nameTg: 'Алмосӣ',
    price: Number(process.env.PRICE_DIAMOND || 999),
    aiRequestsPerDay: -1,
    features: ['all_courses', 'ai_mentor', 'vip_signals', 'unlimited_ai', 'personal_mentor', 'consultations'],
  },
};

export const LANGUAGES = ['tg', 'ru', 'en'];
export const DEFAULT_LANGUAGE = 'tg';

export const AI_ROLES = {
  MENTOR: 'mentor',
  ANALYST: 'analyst',
  TEACHER: 'teacher',
  TRADER: 'trader',
  TRANSLATOR: 'translator',
};

export const AI_CACHE_TTL_SECONDS = 3600; // 1 час кэш одинаковых AI-вопросов
export const AI_CONTEXT_MESSAGE_LIMIT = 20; // сколько последних сообщений помнит наставник

export const PAYMENT_METHODS = {
  ALIF: 'alif',
  ESKHATA: 'eskhata',
  HUMO: 'humo',
  CRYPTO: 'crypto',
  MANUAL: 'manual',
};

export const PAYMENT_STATUS = {
  PENDING: 'pending',
  PAID: 'paid',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
};

export const COURSE_CATEGORIES = [
  'basics',
  'forex',
  'crypto',
  'technical_analysis',
  'fundamental_analysis',
  'psychology',
  'risk_management',
  'ai_trading',
];

export const LESSON_TYPES = {
  PHOTO: 'photo',
  VIDEO: 'video',
  TEXT: 'text',
  INFOGRAPHIC: 'infographic',
  VOICE: 'voice',
  PDF: 'pdf',
  AI_INTERACTIVE: 'ai_interactive',
};

export const RATE_LIMITS = {
  USER_MESSAGES_PER_MIN: 30,
  AI_REQUESTS_PER_MIN_GLOBAL: 30,
};
