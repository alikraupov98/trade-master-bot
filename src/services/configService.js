import axios from 'axios';
import Setting from '../models/Setting.js';

export const SETTINGS_SCHEMA = [
  {
    group: '🌐 Общие настройки',
    fields: [
      { key: 'NODE_ENV', label: 'NODE_ENV', type: 'text' },
      { key: 'APP_NAME', label: 'Название приложения', type: 'text' },
      { key: 'APP_URL', label: 'APP_URL', type: 'text' },
      { key: 'PORT', label: 'Порт бота (health-check)', type: 'number' },
      { key: 'HEALTH_PORT', label: 'HEALTH_PORT', type: 'number' },
      { key: 'TIMEZONE', label: 'Часовой пояс', type: 'text' },
      { key: 'LOG_LEVEL', label: 'Уровень логирования', type: 'text', hint: 'error / warn / info / debug' },
      { key: 'LOG_DIR', label: 'Папка логов', type: 'text' },
    ],
  },
  {
    group: '🤖 Telegram-бот',
    fields: [
      { key: 'BOT_TOKEN', label: 'Bot Token', type: 'password', hint: '@BotFather — крайне важный секрет, меняйте с осторожностью' },
      { key: 'BOT_USERNAME', label: 'Username бота (без @)', type: 'text', hint: 'обычно определяется автоматически' },
      { key: 'ADMIN_CONTACT_USERNAME', label: 'Username администратора (без @)', type: 'text' },
      { key: 'ADMIN_TELEGRAM_IDS', label: 'Telegram ID админов (через запятую)', type: 'text' },
      { key: 'BOT_USE_WEBHOOK', label: 'Использовать webhook (true/false)', type: 'text' },
      { key: 'BOT_WEBHOOK_DOMAIN', label: 'Домен для webhook', type: 'text' },
      { key: 'BOT_WEBHOOK_PATH', label: 'Путь webhook', type: 'text' },
    ],
  },
  {
    group: '🗄 MongoDB',
    fields: [
      { key: 'MONGO_URI', label: 'MongoDB URI', type: 'password', hint: 'строка подключения — требует перезапуска ОБОИХ процессов' },
      { key: 'MONGO_VECTOR_INDEX', label: 'Название векторного индекса', type: 'text' },
    ],
  },
  {
    group: '🔴 Redis',
    fields: [
      { key: 'REDIS_HOST', label: 'Redis Host', type: 'text' },
      { key: 'REDIS_PORT', label: 'Redis Port', type: 'number' },
      { key: 'REDIS_PASSWORD', label: 'Redis Password', type: 'password' },
      { key: 'REDIS_DB', label: 'Redis DB номер', type: 'number' },
    ],
  },
  {
    group: '🔐 JWT / Админ-панель',
    fields: [
      { key: 'JWT_SECRET', label: 'JWT Secret', type: 'password', hint: '⚠️ смена этого значения разлогинит ВСЕХ администраторов, включая вас' },
      { key: 'JWT_EXPIRES_IN', label: 'Срок действия токена', type: 'text', hint: 'например 7d' },
      { key: 'SESSION_SECRET', label: 'Session Secret', type: 'password' },
      { key: 'ADMIN_DEFAULT_LOGIN', label: 'Логин первого админа (для seed)', type: 'text' },
      { key: 'ADMIN_DEFAULT_PASSWORD', label: 'Пароль первого админа (для seed)', type: 'password' },
    ],
  },
  {
    group: '🤖 AI — Groq (основной)',
    fields: [
      { key: 'GROQ_API_KEY', label: 'Groq API Key', type: 'password', hint: 'console.groq.com' },
      { key: 'GROQ_MODEL_CHAT', label: 'Модель — чат/наставник', type: 'model-select' },
      { key: 'GROQ_MODEL_FAST', label: 'Модель — быстрая', type: 'model-select' },
      { key: 'GROQ_MODEL_VISION', label: 'Модель — vision/графики', type: 'model-select' },
      { key: 'GROQ_MODEL_WHISPER', label: 'Модель — распознавание речи', type: 'model-select' },
      { key: 'GROQ_MAX_TOKENS', label: 'Макс. токенов в ответе', type: 'number' },
      { key: 'GROQ_TEMPERATURE', label: 'Temperature (0-1)', type: 'text' },
      { key: 'GROQ_RATE_LIMIT_RPM', label: 'Лимит запросов в минуту', type: 'number', hint: 'на нём строится пауза AI-генератора курсов' },
      { key: 'GROQ_RATE_LIMIT_RPD', label: 'Лимит запросов в сутки', type: 'number' },
    ],
  },
  {
    group: '🤖 AI — резервные провайдеры',
    fields: [
      { key: 'OPENROUTER_API_KEY', label: 'OpenRouter API Key', type: 'password' },
      { key: 'OPENROUTER_MODEL', label: 'OpenRouter — модель', type: 'text' },
      { key: 'GOOGLE_GEMINI_API_KEY', label: 'Google Gemini API Key', type: 'password' },
      { key: 'GOOGLE_GEMINI_MODEL', label: 'Gemini — модель', type: 'text' },
      { key: 'TOGETHER_API_KEY', label: 'Together.ai API Key', type: 'password' },
      { key: 'TOGETHER_MODEL', label: 'Together — модель', type: 'text' },
    ],
  },
  {
    group: '🔢 Эмбеддинги (RAG)',
    fields: [
      { key: 'COHERE_API_KEY', label: 'Cohere API Key', type: 'password' },
      { key: 'COHERE_EMBED_MODEL', label: 'Модель эмбеддингов', type: 'text' },
      { key: 'EMBEDDING_DIMENSIONS', label: 'Размерность вектора', type: 'number' },
    ],
  },
  {
    group: '💹 Данные рынка',
    fields: [
      { key: 'COINGECKO_API_URL', label: 'CoinGecko API URL', type: 'text' },
      { key: 'BINANCE_API_URL', label: 'Binance API URL', type: 'text' },
    ],
  },
  {
    group: '💎 Цены подписки (TJS / 30 дней)',
    fields: [
      { key: 'PRICE_SILVER', label: 'Тариф Нуқрагӣ/Серебро', type: 'number' },
      { key: 'PRICE_GOLD', label: 'Тариф Тиллоӣ/Золото', type: 'number' },
      { key: 'PRICE_DIAMOND', label: 'Тариф Алмосӣ/Алмаз', type: 'number' },
    ],
  },
  {
    group: '💳 Платежи',
    fields: [
      { key: 'MANUAL_PAYMENT_CARD', label: 'Номер карты для ручной оплаты', type: 'text' },
      { key: 'ALIF_MERCHANT_ID', label: 'Alif Mobi — Merchant ID', type: 'text' },
      { key: 'ALIF_API_KEY', label: 'Alif Mobi — API Key', type: 'password' },
      { key: 'ALIF_API_URL', label: 'Alif Mobi — API URL', type: 'text' },
      { key: 'ESKHATA_MERCHANT_ID', label: 'Eskhata — Merchant ID', type: 'text' },
      { key: 'ESKHATA_API_KEY', label: 'Eskhata — API Key', type: 'password' },
      { key: 'ESKHATA_API_URL', label: 'Eskhata — API URL', type: 'text' },
      { key: 'HUMO_MERCHANT_ID', label: 'Humo — Merchant ID', type: 'text' },
      { key: 'HUMO_API_KEY', label: 'Humo — API Key', type: 'password' },
      { key: 'NOWPAYMENTS_API_KEY', label: 'NowPayments (крипто) — API Key', type: 'password' },
      { key: 'NOWPAYMENTS_IPN_SECRET', label: 'NowPayments — IPN Secret', type: 'password' },
    ],
  },
];

export function getCurrentSettingsValues() {
  const values = {};
  for (const group of SETTINGS_SCHEMA) {
    for (const field of group.fields) {
      values[field.key] = process.env[field.key] || '';
    }
  }
  return values;
}

export async function saveSettings(values, adminId) {
  const schema = SETTINGS_SCHEMA.flatMap((g) => g.fields);
  const updates = [];

  for (const field of schema) {
    const incoming = values[field.key];
    if (incoming === undefined) continue;
    if (field.type === 'password' && incoming.trim() === '') continue;

    updates.push(
      Setting.findOneAndUpdate(
        { key: field.key },
        { key: field.key, value: incoming, updatedBy: adminId },
        { upsert: true },
      ),
    );
    process.env[field.key] = incoming;
  }

  await Promise.all(updates);
  return updates.length;
}

export async function fetchAvailableGroqModels() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return [];

  try {
    const { data } = await axios.get('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 10_000,
    });
    return (data?.data || []).map((m) => m.id).sort();
  } catch (err) {
    return [];
  }
}

export default { SETTINGS_SCHEMA, getCurrentSettingsValues, saveSettings, fetchAvailableGroqModels };
