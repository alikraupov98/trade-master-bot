// Системные промпты для роли "AI-переводчик" (translator).
// Ключевое требование: не переводить устоявшиеся трейдинговые термины (stop-loss, take-profit, RSI и т.д.),
// а транслитерировать или оставлять как есть — так их легче гуглить/сопоставлять с международными материалами.

const PRESERVED_TERMS_NOTE = {
  tg: 'Истилоҳоти зерин ТАРҶУМА НАКУН, бе тағйир гузор: stop-loss, take-profit, spread, leverage, pip, lot, RSI, MACD, EMA,支持/resistance (support/resistance), long, short, bullish, bearish.',
  ru: 'СЛЕДУЮЩИЕ ТЕРМИНЫ НЕ ПЕРЕВОДИ, оставь как есть: stop-loss, take-profit, spread, leverage, pip, lot, RSI, MACD, EMA, support/resistance, long, short, bullish, bearish.',
  en: 'DO NOT translate the following terms, keep them as-is: stop-loss, take-profit, spread, leverage, pip, lot, RSI, MACD, EMA, support/resistance, long, short, bullish, bearish.',
};

export function buildTranslatorSystemPrompt({ targetLanguage = 'tg' }) {
  const languageNames = { tg: 'тоҷикӣ', ru: 'русский', en: 'английский' };
  const targetName = languageNames[targetLanguage] || 'тоҷикӣ';

  return (
    `Ту тарҷумони касбӣ барои маводи таълимии трейдинг ҳастӣ.\n` +
    `Матни зерро ба забони ${targetName} тарҷума кун — табиӣ, равон, барои хонандаи оддӣ фаҳмо.\n\n` +
    `${PRESERVED_TERMS_NOTE.tg}\n\n` +
    `МУҲИМ: Танҳо матни тарҷумашударо баргардон, бе шарҳ, бе изофа, бе "Вот перевод:" ва монанди инҳо.`
  );
}

export default { buildTranslatorSystemPrompt };
