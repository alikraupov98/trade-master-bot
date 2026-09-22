import mongoose from 'mongoose';
import AIKnowledge from '../models/AIKnowledge.js';
import { embedQuery, embedDocuments } from './embeddingService.js';
import logger from '../utils/errorHandler.js';

const VECTOR_INDEX = process.env.MONGO_VECTOR_INDEX || 'vector_index';

/**
 * Разбивает длинный текст на фрагменты (чанки) для векторизации.
 * Простое разбиение по количеству символов с перекрытием — этого достаточно
 * для учебных материалов, которые обычно уже разбиты на уроки/абзацы.
 */
export function chunkText(text, chunkSize = 800, overlap = 100) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start += chunkSize - overlap;
  }
  return chunks;
}

/**
 * Индексирует документ (курс/урок/загруженный файл) в базу знаний:
 * разбивает на чанки, получает эмбеддинги, сохраняет в MongoDB.
 */
export async function indexDocument({ title, fullText, sourceType, sourceRef, language = 'tg', tags = [] }) {
  const chunks = chunkText(fullText);
  const embeddings = await embedDocuments(chunks);

  const docs = chunks.map((chunk, idx) => ({
    sourceType,
    sourceRef,
    title,
    chunkText: chunk,
    chunkIndex: idx,
    embedding: embeddings[idx] || [],
    language,
    tags,
  })).filter((d) => d.embedding.length > 0);

  if (docs.length === 0) {
    logger.warn(`Не удалось получить эмбеддинги для документа "${title}" — индексация пропущена`);
    return { indexed: 0 };
  }

  await AIKnowledge.insertMany(docs);
  logger.info(`RAG: проиндексировано ${docs.length} фрагментов из "${title}"`);
  return { indexed: docs.length };
}

/**
 * Ищет наиболее релевантные фрагменты знаний по вопросу пользователя.
 * Использует $vectorSearch (MongoDB Atlas). Если Atlas Vector Search недоступен
 * (например, локальная разработка без Atlas), делает fallback на простой текстовый поиск.
 */
export async function searchKnowledge(query, { limit = 4, language = null } = {}) {
  const queryEmbedding = await embedQuery(query);

  if (queryEmbedding) {
    try {
      const pipeline = [
        {
          $vectorSearch: {
            index: VECTOR_INDEX,
            path: 'embedding',
            queryVector: queryEmbedding,
            numCandidates: 100,
            limit,
            ...(language ? { filter: { language } } : {}),
          },
        },
        {
          $project: {
            title: 1,
            chunkText: 1,
            sourceType: 1,
            sourceRef: 1,
            score: { $meta: 'vectorSearchScore' },
          },
        },
      ];
      const results = await AIKnowledge.aggregate(pipeline);
      if (results.length > 0) return results;
    } catch (err) {
      logger.warn(`Atlas Vector Search недоступен (${err.message}), используется текстовый fallback-поиск`);
    }
  }

  // Fallback: обычный текстовый поиск по ключевым словам (без Atlas)
  const regex = new RegExp(query.split(' ').filter((w) => w.length > 2).join('|'), 'i');
  const fallbackResults = await AIKnowledge.find(language ? { chunkText: regex, language } : { chunkText: regex })
    .limit(limit)
    .lean();
  return fallbackResults;
}

/**
 * Формирует текстовый контекст для вставки в system-промпт AI-наставника,
 * с указанием источника каждого фрагмента.
 */
export async function getRagContext(query, options = {}) {
  const results = await searchKnowledge(query, options);
  if (!results || results.length === 0) return '';

  return results
    .map((r, i) => `[Манбаъ ${i + 1}: ${r.title}]\n${r.chunkText}`)
    .join('\n\n');
}

export default { indexDocument, searchKnowledge, getRagContext, chunkText };
