import { CohereClient } from 'cohere-ai';
import { COHERE_CONFIG } from '../config/ai.js';
import logger from '../utils/errorHandler.js';

const cohere = COHERE_CONFIG.apiKey ? new CohereClient({ token: COHERE_CONFIG.apiKey }) : null;

/**
 * Получает эмбеддинг для одного текста (используется при поиске - inputType search_query)
 */
export async function embedQuery(text) {
  if (!cohere) {
    logger.warn('COHERE_API_KEY не задан — эмбеддинги недоступны');
    return null;
  }
  try {
    const response = await cohere.embed({
      texts: [text],
      model: COHERE_CONFIG.embedModel,
      inputType: 'search_query',
    });
    return response.embeddings[0];
  } catch (err) {
    logger.error('Ошибка получения эмбеддинга запроса:', err);
    return null;
  }
}

/**
 * Получает эмбеддинги для батча документов (используется при индексации базы знаний)
 */
export async function embedDocuments(texts) {
  if (!cohere) {
    logger.warn('COHERE_API_KEY не задан — эмбеддинги недоступны');
    return texts.map(() => null);
  }
  try {
    const response = await cohere.embed({
      texts,
      model: COHERE_CONFIG.embedModel,
      inputType: 'search_document',
    });
    return response.embeddings;
  } catch (err) {
    logger.error('Ошибка получения эмбеддингов документов:', err);
    return texts.map(() => null);
  }
}

export default { embedQuery, embedDocuments };
