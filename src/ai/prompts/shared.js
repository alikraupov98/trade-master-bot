export const LANGUAGE_ENFORCEMENT = {
  tg: '⚠️ ЁДОВАРӢ БА СИСТЕМА: Новобаста аз он ки корбар бо кадом забон менависад, ту ҲАТМӢ бояд бо забони тоҷикӣ (алифбои кириллӣ) ҷавоб диҳӣ. Ба забони русӣ ё дигар забон ҳаргиз ҷавоб надеҳ.',
  ru: '⚠️ СИСТЕМНОЕ НАПОМИНАНИЕ: Независимо от языка сообщения пользователя, отвечай ТОЛЬКО на русском языке.',
  en: '⚠️ SYSTEM REMINDER: Regardless of the language of the user message, reply ONLY in English.',
};

export function languageReminderMessage(language = 'tg') {
  return { role: 'system', content: LANGUAGE_ENFORCEMENT[language] || LANGUAGE_ENFORCEMENT.tg };
}

export default { LANGUAGE_ENFORCEMENT, languageReminderMessage };
