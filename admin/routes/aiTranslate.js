import { Router } from 'express';
import { translateText } from '../../src/services/aiTranslationService.js';
import { requireAdminAuth } from './authGuard.js';

const router = Router();

/** Переводит произвольный текст на указанный язык (используется кнопками "Перевести" в формах). */
router.post('/api/translate', requireAdminAuth, async (req, res) => {
  const { text, targetLanguage } = req.body;
  if (!text || !targetLanguage) {
    return res.status(400).json({ error: 'text и targetLanguage обязательны' });
  }

  try {
    const translated = await translateText(text, targetLanguage);
    return res.json({ success: true, translated });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
