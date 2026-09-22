// Общая конфигурация AI-стека: порядок fallback-провайдеров и их параметры

export const AI_PROVIDERS_ORDER = ['groq', 'openrouter', 'gemini', 'together'];

export const OPENROUTER_CONFIG = {
  apiKey: process.env.OPENROUTER_API_KEY || '',
  apiUrl: 'https://openrouter.ai/api/v1/chat/completions',
  model: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct:free',
};

export const GEMINI_CONFIG = {
  apiKey: process.env.GOOGLE_GEMINI_API_KEY || '',
  apiUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
  model: process.env.GOOGLE_GEMINI_MODEL || 'gemini-1.5-flash',
};

export const TOGETHER_CONFIG = {
  apiKey: process.env.TOGETHER_API_KEY || '',
  apiUrl: 'https://api.together.xyz/v1/chat/completions',
  model: process.env.TOGETHER_MODEL || 'meta-llama/Llama-3-8b-chat-hf',
};

export const COHERE_CONFIG = {
  apiKey: process.env.COHERE_API_KEY || '',
  embedModel: process.env.COHERE_EMBED_MODEL || 'embed-multilingual-v3.0',
  dimensions: Number(process.env.EMBEDDING_DIMENSIONS || 1024),
};

// Список запрещённых паттернов для базовой защиты от промпт-инъекций
export const PROMPT_INJECTION_PATTERNS = [
  /ignore (all|previous|above) instructions/i,
  /забудь (все )?(предыдущие )?инструкции/i,
  /сарфи назар кун аз дастурҳо/i,
  /you are now/i,
  /act as (?!a trading|an? ai mentor)/i,
  /system prompt/i,
  /reveal (your|the) (system )?prompt/i,
];
