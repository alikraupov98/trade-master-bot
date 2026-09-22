// Модели иногда игнорируют инструкцию "не используй markdown-таблицы" из системного промпта —
// это известное поведение LLM при сравнении нескольких вариантов/показателей. Полагаться только
// на промпт ненадёжно, поэтому дополнительно чистим готовый ответ перед отправкой в Telegram.

function isTableSeparatorLine(line) {
  return /^\|?[\s:\-|]+\|?$/.test(line.trim()) && line.includes('-');
}

function isTableRowLine(line) {
  const trimmed = line.trim();
  return trimmed.includes('|') && trimmed.replace(/\|/g, '').trim().length > 0;
}

function tableRowToPlainText(line) {
  const cells = line
    .split('|')
    .map((c) => c.trim())
    .filter((c) => c.length > 0);
  return cells.length ? `▪️ ${cells.join(' — ')}` : '';
}

function convertMarkdownTables(text) {
  const lines = text.split('\n');
  const result = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (isTableRowLine(line) && i + 1 < lines.length && isTableSeparatorLine(lines[i + 1])) {
      result.push(tableRowToPlainText(line));
      i += 2;
      while (i < lines.length && isTableRowLine(lines[i])) {
        result.push(tableRowToPlainText(lines[i]));
        i += 1;
      }
      continue;
    }

    result.push(line);
    i += 1;
  }

  return result.join('\n');
}

function stripMarkdownNoise(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*_]{3,}\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function sanitizeAIResponseText(text) {
  if (!text) return text;
  return stripMarkdownNoise(convertMarkdownTables(text));
}

export default { sanitizeAIResponseText };
