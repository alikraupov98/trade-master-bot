import fs from 'fs';
import path from 'path';
import axios from 'axios';
import ffmpeg from 'fluent-ffmpeg';
import { v4 as uuidv4 } from 'uuid';
import logger from './errorHandler.js';

const TEMP_DIR = path.join(process.cwd(), 'uploads', 'temp');

/** Гарантирует, что временная директория существует. */
function ensureTempDir() {
  if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
}

/**
 * Скачивает файл из Telegram по file_id и сохраняет локально во временную папку.
 * Возвращает путь к сохранённому файлу.
 */
export async function downloadTelegramFile(bot, fileId, extension = 'tmp') {
  ensureTempDir();
  const fileLink = await bot.telegram.getFileLink(fileId);
  const destPath = path.join(TEMP_DIR, `${uuidv4()}.${extension}`);

  const response = await axios.get(fileLink.href, { responseType: 'stream', timeout: 30_000 });
  const writer = fs.createWriteStream(destPath);
  response.data.pipe(writer);

  await new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });

  return destPath;
}

/**
 * Конвертирует аудиофайл (например, Telegram voice в формате .oga/opus) в .mp3,
 * который гарантированно принимается Groq Whisper API.
 */
export function convertToMp3(inputPath) {
  ensureTempDir();
  const outputPath = inputPath.replace(/\.[^/.]+$/, '') + '.mp3';

  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .toFormat('mp3')
      .on('end', () => resolve(outputPath))
      .on('error', (err) => reject(err))
      .save(outputPath);
  });
}

/** Удаляет временный файл, если он существует, игнорируя ошибки. */
export async function cleanupTempFile(filePath) {
  if (!filePath) return;
  await fs.promises.unlink(filePath).catch(() => {
    logger.warn(`Не удалось удалить временный файл: ${filePath}`);
  });
}

/** Конвертирует изображение в base64 (для отправки в Groq Vision). */
export async function fileToBase64(filePath) {
  const buffer = await fs.promises.readFile(filePath);
  return buffer.toString('base64');
}

export default { downloadTelegramFile, convertToMp3, cleanupTempFile, fileToBase64 };
