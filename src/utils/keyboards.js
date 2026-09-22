import { Markup } from 'telegraf';

// Полный список текстов кнопок нижнего меню на всех языках — используется, чтобы отличить
// "пользователь нажал кнопку навигации" от "пользователь пишет свободный текст" внутри
// пошаговых режимов (AI-чат, ожидание чека, поддержка и т.д.). Без этой проверки нажатие
// любой кнопки меню во время такого режима "проглатывалось" бы им вместо перехода по разделу.
const MENU_BUTTON_TEXTS = new Set([
  '📚 Курсҳо', '📚 Курсы', '📚 Courses',
  '🤖 AI-Наставник', '🤖 AI Mentor',
  '📊 Сигналҳо', '📊 Сигналы', '📊 Signals',
  '📈 Таҳлил', '📈 Анализ', '📈 Analysis',
  '🧮 Калкулятор', '🧮 Калькулятор', '🧮 Calculator',
  '👤 Профил', '👤 Профиль', '👤 Profile',
  '💎 Обуна', '💎 Подписка', '💎 Subscription',
  '💬 Дастгирӣ', '💬 Поддержка', '💬 Support',
  '🎁 Реферал', '🎁 Referral',
]);

/** Проверяет, является ли текст сообщения нажатием одной из кнопок нижнего меню. */
export function isMenuButtonText(text) {
  return MENU_BUTTON_TEXTS.has((text || '').trim());
}

export function mainMenuKeyboard(lang = 'tg') {
  const labels = {
    tg: {
      courses: '📚 Курсҳо', ai: '🤖 AI-Наставник', signals: '📊 Сигналҳо',
      analysis: '📈 Таҳлил', calculator: '🧮 Калкулятор', profile: '👤 Профил',
      subscription: '💎 Обуна', support: '💬 Дастгирӣ', referral: '🎁 Реферал',
    },
    ru: {
      courses: '📚 Курсы', ai: '🤖 AI-Наставник', signals: '📊 Сигналы',
      analysis: '📈 Анализ', calculator: '🧮 Калькулятор', profile: '👤 Профиль',
      subscription: '💎 Подписка', support: '💬 Поддержка', referral: '🎁 Реферал',
    },
    en: {
      courses: '📚 Courses', ai: '🤖 AI Mentor', signals: '📊 Signals',
      analysis: '📈 Analysis', calculator: '🧮 Calculator', profile: '👤 Profile',
      subscription: '💎 Subscription', support: '💬 Support', referral: '🎁 Referral',
    },
  };
  const t = labels[lang] || labels.tg;

  return Markup.keyboard([
    [t.courses, t.ai],
    [t.signals, t.analysis],
    [t.calculator, t.profile],
    [t.subscription, t.support],
    [t.referral],
  ]).resize();
}

export function languageInlineKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🇹🇯 Тоҷикӣ', 'lang_tg')],
    [Markup.button.callback('🇷🇺 Русский', 'lang_ru')],
    [Markup.button.callback('🇬🇧 English', 'lang_en')],
  ]);
}

export function aiFeedbackKeyboard(lang = 'tg') {
  const labels = {
    tg: { good: '👍 Хуб', bad: '👎 Бад', human: '🆘 Мутахассис лозим', newChat: '🔄 Гуфтугӯи нав', speak: '🔊 Гӯш кунед', back: '⬅️ Бозгашт' },
    ru: { good: '👍 Хорошо', bad: '👎 Плохо', human: '🆘 Нужен специалист', newChat: '🔄 Новый диалог', speak: '🔊 Озвучить', back: '⬅️ Назад' },
    en: { good: '👍 Good', bad: '👎 Bad', human: '🆘 Need a human', newChat: '🔄 New chat', speak: '🔊 Listen', back: '⬅️ Back' },
  };
  const t = labels[lang] || labels.tg;

  return Markup.inlineKeyboard([
    [Markup.button.callback(t.good, 'ai_rate_good'), Markup.button.callback(t.bad, 'ai_rate_bad')],
    [Markup.button.callback(t.speak, 'ai_speak')],
    [Markup.button.callback(t.human, 'ai_escalate'), Markup.button.callback(t.newChat, 'ai_new_chat')],
    [Markup.button.callback(t.back, 'ai_back_to_menu')],
  ]);
}

export function subscriptionInlineKeyboard(lang = 'tg') {
  const names = {
    tg: ['🆓 Бепул', '🥈 Нуқрагӣ — 299 TJS', '🥉 Тиллоӣ — 599 TJS', '💎 Алмосӣ — 999 TJS'],
    ru: ['🆓 Бесплатно', '🥈 Серебро — 299 TJS', '🥉 Золото — 599 TJS', '💎 Алмаз — 999 TJS'],
    en: ['🆓 Free', '🥈 Silver — 299 TJS', '🥉 Gold — 599 TJS', '💎 Diamond — 999 TJS'],
  };
  const t = names[lang] || names.tg;
  return Markup.inlineKeyboard([
    [Markup.button.callback(t[1], 'sub_silver')],
    [Markup.button.callback(t[2], 'sub_gold')],
    [Markup.button.callback(t[3], 'sub_diamond')],
  ]);
}

export function marketPairsKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('BTC/USDT', 'analyze_BTCUSDT'), Markup.button.callback('ETH/USDT', 'analyze_ETHUSDT')],
    [Markup.button.callback('EUR/USD', 'analyze_EURUSD'), Markup.button.callback('GBP/USD', 'analyze_GBPUSD')],
    [Markup.button.callback('XAU/USD', 'analyze_XAUUSD'), Markup.button.callback('TON/USDT', 'analyze_TONUSDT')],
  ]);
}

export default {
  mainMenuKeyboard,
  languageInlineKeyboard,
  aiFeedbackKeyboard,
  subscriptionInlineKeyboard,
  marketPairsKeyboard,
  isMenuButtonText,
};
