import Groq from 'groq-sdk';

if (!process.env.GROQ_API_KEY) {
  // Не бросаем исключение, чтобы проект стартовал даже без ключа —
  // aiProviderService в этом случае уйдёт на fallback-провайдеры.
  console.warn('⚠️ GROQ_API_KEY не задан — Groq недоступен, будет использован fallback');
}

// Клиент Groq SDK (OpenAI-совместимый интерфейс)
export const groqClient = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null;

export const GROQ_CONFIG = {
  models: {
    chat: process.env.GROQ_MODEL_CHAT || 'llama-3.3-70b-versatile',
    fast: process.env.GROQ_MODEL_FAST || 'llama-3.1-8b-instant',
    vision: process.env.GROQ_MODEL_VISION || 'llama-3.2-11b-vision-preview',
    whisper: process.env.GROQ_MODEL_WHISPER || 'whisper-large-v3',
  },
  maxTokens: Number(process.env.GROQ_MAX_TOKENS || 2048),
  temperature: Number(process.env.GROQ_TEMPERATURE || 0.7),
  rateLimit: {
    rpm: Number(process.env.GROQ_RATE_LIMIT_RPM || 30),
    rpd: Number(process.env.GROQ_RATE_LIMIT_RPD || 14400),
  },
};
