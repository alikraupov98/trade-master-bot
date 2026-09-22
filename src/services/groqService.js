import { groqClient, GROQ_CONFIG } from '../config/groq.js';
import redisClient from '../config/redis.js';
import logger from '../utils/errorHandler.js';

// Ключи Redis для учёта лимитов Groq (rpm/rpd)
const RPM_KEY = 'groq:rpm_counter';
const RPD_KEY = 'groq:rpd_counter';

/**
 * Проверяет и инкрементирует глобальные счётчики использования Groq.
 * Возвращает false, если лимит исчерпан (нужно уходить на fallback).
 */
async function checkAndIncrementLimits() {
  const now = Math.floor(Date.now() / 1000);
  const minuteWindow = Math.floor(now / 60);
  const dayWindow = new Date().toISOString().slice(0, 10);

  const rpmKey = `${RPM_KEY}:${minuteWindow}`;
  const rpdKey = `${RPD_KEY}:${dayWindow}`;

  const [rpmCount, rpdCount] = await Promise.all([
    redisClient.incr(rpmKey),
    redisClient.incr(rpdKey),
  ]);

  // Ставим TTL только при первом инкременте окна
  if (rpmCount === 1) await redisClient.expire(rpmKey, 65);
  if (rpdCount === 1) await redisClient.expire(rpdKey, 90_000);

  if (rpmCount > GROQ_CONFIG.rateLimit.rpm) {
    logger.warn(`Groq: превышен лимит RPM (${rpmCount}/${GROQ_CONFIG.rateLimit.rpm})`);
    return false;
  }
  if (rpdCount > GROQ_CONFIG.rateLimit.rpd) {
    logger.warn(`Groq: превышен дневной лимит RPD (${rpdCount}/${GROQ_CONFIG.rateLimit.rpd})`);
    return false;
  }
  return true;
}

/**
 * Обычный (не потоковый) запрос к Groq.
 * messages — массив [{role: 'system'|'user'|'assistant', content: string}]
 */
export async function groqChatCompletion({ messages, model, temperature, maxTokens, skipRateLimit = false }) {
  if (!groqClient) {
    throw new Error('GROQ_NOT_CONFIGURED');
  }

  if (!skipRateLimit) {
    const canProceed = await checkAndIncrementLimits();
    if (!canProceed) {
      throw new Error('GROQ_RATE_LIMIT_EXCEEDED');
    }
  }

  try {
    const completion = await groqClient.chat.completions.create({
      model: model || GROQ_CONFIG.models.chat,
      messages,
      temperature: temperature ?? GROQ_CONFIG.temperature,
      max_tokens: maxTokens || GROQ_CONFIG.maxTokens,
    });

    const choice = completion.choices?.[0];
    return {
      content: choice?.message?.content || '',
      tokensUsed: completion.usage?.total_tokens || 0,
      provider: 'groq',
      model: model || GROQ_CONFIG.models.chat,
    };
  } catch (err) {
    logger.error('Ошибка запроса к Groq:', err);
    throw err;
  }
}

/**
 * Потоковый запрос к Groq для эффекта "печатающегося" ответа.
 * onChunk(text) вызывается по мере поступления токенов.
 * Возвращает финальный полный текст и количество использованных токенов (приблизительно).
 */
export async function groqChatCompletionStream({ messages, model, temperature, maxTokens, onChunk }) {
  if (!groqClient) {
    throw new Error('GROQ_NOT_CONFIGURED');
  }

  const canProceed = await checkAndIncrementLimits();
  if (!canProceed) {
    throw new Error('GROQ_RATE_LIMIT_EXCEEDED');
  }

  let fullText = '';
  let tokensUsed = 0;

  try {
    const stream = await groqClient.chat.completions.create({
      model: model || GROQ_CONFIG.models.chat,
      messages,
      temperature: temperature ?? GROQ_CONFIG.temperature,
      max_tokens: maxTokens || GROQ_CONFIG.maxTokens,
      stream: true,
    });

    for await (const part of stream) {
      const delta = part.choices?.[0]?.delta?.content || '';
      if (delta) {
        fullText += delta;
        if (onChunk) await onChunk(fullText, delta);
      }
      // Groq в последнем чанке иногда присылает usage
      if (part.x_groq?.usage?.total_tokens) {
        tokensUsed = part.x_groq.usage.total_tokens;
      }
    }

    return { content: fullText, tokensUsed, provider: 'groq', model: model || GROQ_CONFIG.models.chat };
  } catch (err) {
    logger.error('Ошибка потокового запроса к Groq:', err);
    // Пробрасываем то, что успели собрать, чтобы вызывающий код мог решить, fallback или нет
    err.partialContent = fullText;
    throw err;
  }
}

/**
 * Vision-запрос (анализ изображения графика) через Groq.
 * imageBase64 — data URL (data:image/jpeg;base64,...) или чистый base64 с mimeType.
 */
export async function groqVisionAnalysis({ imageBase64, mimeType = 'image/jpeg', prompt }) {
  if (!groqClient) {
    throw new Error('GROQ_NOT_CONFIGURED');
  }

  const canProceed = await checkAndIncrementLimits();
  if (!canProceed) {
    throw new Error('GROQ_RATE_LIMIT_EXCEEDED');
  }

  const imageUrl = imageBase64.startsWith('data:') ? imageBase64 : `data:${mimeType};base64,${imageBase64}`;

  try {
    const completion = await groqClient.chat.completions.create({
      model: GROQ_CONFIG.models.vision,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: imageUrl } },
          ],
        },
      ],
      max_tokens: GROQ_CONFIG.maxTokens,
    });

    const choice = completion.choices?.[0];
    return {
      content: choice?.message?.content || '',
      tokensUsed: completion.usage?.total_tokens || 0,
      provider: 'groq-vision',
    };
  } catch (err) {
    logger.error('Ошибка Groq Vision:', err);
    throw err;
  }
}

/**
 * Транскрибация голосового сообщения через Groq Whisper (whisper-large-v3).
 * filePath — путь к локальному аудиофайлу (mp3/wav/m4a/webm — см. поддерживаемые Groq форматы).
 */
export async function groqAudioTranscription({ filePath, language }) {
  if (!groqClient) {
    throw new Error('GROQ_NOT_CONFIGURED');
  }

  const canProceed = await checkAndIncrementLimits();
  if (!canProceed) {
    throw new Error('GROQ_RATE_LIMIT_EXCEEDED');
  }

  const fs = await import('fs');
  try {
    const transcription = await groqClient.audio.transcriptions.create({
      file: fs.createReadStream(filePath),
      model: GROQ_CONFIG.models.whisper || 'whisper-large-v3',
      language: language && language !== 'tg' ? language : undefined, // Whisper не поддерживает tg-код напрямую — распознаёт автоматически
      response_format: 'json',
    });
    return { text: transcription.text || '' };
  } catch (err) {
    logger.error('Ошибка транскрибации Groq Whisper:', err);
    throw err;
  }
}

export default {
  groqChatCompletion,
  groqChatCompletionStream,
  groqVisionAnalysis,
  groqAudioTranscription,
};
