// Простой, но эффективный фильтр от базовых попыток промпт-инъекций.
// Не заменяет полноценную защиту на уровне системного промпта, но отсекает явные попытки.
const INJECTION_PATTERNS = [
  /ignore (all|previous|above) instructions/i,
  /забудь (все|инструкции|правила)/i,
  /игнорируй (все|инструкции|правила|предыдущие)/i,
  /you are now/i,
  /ти зараз/i,
  /act as (an? )?(dan|jailbreak)/i,
  /system prompt/i,
  /системный промпт/i,
  /покажи (свой|системный) промпт/i,
  /pretend (you are|to be)/i,
  /override your (rules|instructions|guidelines)/i,
  /\bDAN\b/,
  /reveal your instructions/i,
];

export function containsPromptInjection(text) {
  if (!text || typeof text !== 'string') return false;
  return INJECTION_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Проверяет, что строка — валидный тикер/пара для анализа рынка (буквы/цифры, до 12 символов).
 */
export function isValidMarketPair(text) {
  return /^[A-Za-z0-9]{2,12}$/.test((text || '').trim());
}

/**
 * Простая валидация суммы платежа (положительное число, до 100000).
 */
export function isValidAmount(value) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 && num <= 100000;
}

/**
 * Обрезает пользовательский текст до безопасной длины перед отправкой в AI.
 */
export function truncateUserInput(text, maxLength = 1500) {
  if (!text) return '';
  return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
}

export default { containsPromptInjection, isValidMarketPair, isValidAmount, truncateUserInput };
