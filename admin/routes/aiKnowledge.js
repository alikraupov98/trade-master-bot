import { Router } from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import AIKnowledge from '../../src/models/AIKnowledge.js';
import { indexDocument, searchKnowledge } from '../../src/services/ragService.js';
import { requireAdminAuth } from './authGuard.js';
import logger from '../../src/utils/errorHandler.js';

const router = Router();
const upload = multer({ dest: path.join(process.cwd(), 'uploads', 'temp') });

/** Извлекает чистый текст из загруженного файла в зависимости от его типа. */
async function extractText(filePath, mimetype, originalName) {
  const ext = path.extname(originalName).toLowerCase();

  if (ext === '.pdf' || mimetype === 'application/pdf') {
    const buffer = await fs.readFile(filePath);
    const data = await pdfParse(buffer);
    return data.text;
  }
  if (ext === '.docx') {
    const { value } = await mammoth.extractRawText({ path: filePath });
    return value;
  }
  // .txt, .md и всё остальное — читаем как обычный текст
  return fs.readFile(filePath, 'utf-8');
}

/** Страница базы знаний: список документов + статистика + форма загрузки. */
router.get('/ai-knowledge', requireAdminAuth, async (req, res) => {
  const [documents, totalChunks] = await Promise.all([
    AIKnowledge.aggregate([
      { $group: { _id: '$title', chunks: { $sum: 1 }, sourceType: { $first: '$sourceType' }, language: { $first: '$language' }, updatedAt: { $max: '$updatedAt' } } },
      { $sort: { updatedAt: -1 } },
    ]),
    AIKnowledge.countDocuments(),
  ]);

  res.render('aiKnowledge', {
    documents,
    totalDocuments: documents.length,
    totalChunks,
    query: req.query.q || '',
    searchResults: null,
  });
});

/** Поиск по базе знаний (проверка того, что реально найдёт AI-наставник). */
router.get('/ai-knowledge/search', requireAdminAuth, async (req, res) => {
  const q = req.query.q || '';
  const searchResults = q ? await searchKnowledge(q, { limit: 8 }) : null;

  const [documents, totalChunks] = await Promise.all([
    AIKnowledge.aggregate([
      { $group: { _id: '$title', chunks: { $sum: 1 }, sourceType: { $first: '$sourceType' }, language: { $first: '$language' }, updatedAt: { $max: '$updatedAt' } } },
      { $sort: { updatedAt: -1 } },
    ]),
    AIKnowledge.countDocuments(),
  ]);

  res.render('aiKnowledge', { documents, totalDocuments: documents.length, totalChunks, query: q, searchResults });
});

/** Загрузка нового документа: парсинг → чанкинг → эмбеддинги → сохранение. */
router.post('/ai-knowledge/upload', requireAdminAuth, upload.single('file'), async (req, res) => {
  const { title, language, tags } = req.body;
  const file = req.file;

  if (!file) {
    return res.redirect('/ai-knowledge');
  }

  try {
    const fullText = await extractText(file.path, file.mimetype, file.originalname);
    const result = await indexDocument({
      title: title || file.originalname,
      fullText,
      sourceType: 'document',
      sourceRef: null,
      language: language || 'tg',
      tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
    });

    logger.info(`Админ загрузил документ в базу знаний: ${title} (${result.indexed} фрагментов)`);
    return res.redirect('/ai-knowledge');
  } catch (err) {
    logger.error('Ошибка загрузки документа в базу знаний:', err);
    return res.status(500).render('error', { message: 'Не удалось обработать файл: ' + err.message });
  } finally {
    await fs.unlink(file.path).catch(() => {});
  }
});

/** Удаление всех фрагментов документа по названию. */
router.post('/ai-knowledge/delete', requireAdminAuth, async (req, res) => {
  const { title } = req.body;
  await AIKnowledge.deleteMany({ title });
  return res.redirect('/ai-knowledge');
});

export default router;
