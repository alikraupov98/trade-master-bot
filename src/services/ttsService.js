import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import path from 'path';
import fs from 'fs/promises';
import { v4 as uuidv4 } from 'uuid';
import ffmpeg from 'fluent-ffmpeg';
import logger from '../utils/errorHandler.js';

const TEMP_DIR = path.join(process.cwd(), 'uploads', 'temp');

// Edge TTS не имеет отдельного таджикского голоса — используем русский голос как ближайший
// доступный (кириллица, схожая фонетика для многих пользователей). Для ru/en — родные голоса.
const VOICE_BY_LANGUAGE = {
  tg: 'ru-RU-SvetlanaNeural',
  ru: 'ru-RU-SvetlanaNeural',
  en: 'en-US-AriaNeural',
};

const MAX_TTS_CHARS = 800; // ограничиваем длину, чтобы не озвучивать целые лекции целиком

/** Перекладывает WEBM/Opus в OGG/Opus без перекодирования (быстрый remux) — нативный формат
 * голосовых сообщений Telegram. */
function remuxToOgg(inputPath) {
  const outputPath = inputPath.replace(/\.[^/.]+$/, '') + '.ogg';
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioCodec('copy')
      .toFormat('ogg')
      .on('end', () => resolve(outputPath))
      .on('error', (err) => reject(err))
      .save(outputPath);
  });
}

/**
 * Синтезирует речь из текста через Edge TTS и возвращает путь к готовому ogg/opus-файлу
 * (голосовое сообщение Telegram). Вызывающий код отвечает за удаление файла (cleanupTempFile).
 */
export async function synthesizeSpeech(text, language = 'ru') {
  if (!text?.trim()) throw new Error('EMPTY_TEXT');

  const cleanText = text.replace(/[*_`#>]/g, '').slice(0, MAX_TTS_CHARS);
  const voice = VOICE_BY_LANGUAGE[language] || VOICE_BY_LANGUAGE.ru;

  // msedge-tts@2.x принимает ПУТЬ К ПАПКЕ (не префикс имени файла) и сам создаёт внутри неё
  // файл audio.<ext> — поэтому под каждый запрос создаём отдельную уникальную папку.
  const outputDir = path.join(TEMP_DIR, uuidv4());
  await fs.mkdir(outputDir, { recursive: true });

  let webmPath = null;
  try {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(voice, OUTPUT_FORMAT.WEBM_24KHZ_16BIT_MONO_OPUS);

    const result = await tts.toFile(outputDir, cleanText);
    webmPath = result?.audioFilePath;
    if (!webmPath) throw new Error('TTS_NO_OUTPUT_FILE');

    const oggPath = await remuxToOgg(webmPath);
    return oggPath;
  } catch (err) {
    logger.error(`Ошибка синтеза речи Edge TTS: ${err?.message || err}`, err);
    throw new Error('TTS_FAILED');
  } finally {
    // Убираем исходный webm и временную папку — оставляем только итоговый .ogg
    if (webmPath) await fs.unlink(webmPath).catch(() => {});
    await fs.rmdir(outputDir).catch(() => {});
  }
}

export default { synthesizeSpeech };
