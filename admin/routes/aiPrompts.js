import { Router } from 'express';
import AITemplate from '../../src/models/AITemplate.js';
import { MENTOR_SYSTEM_PROMPT } from '../../src/ai/prompts/mentor.js';
import { ANALYST_SYSTEM_PROMPT } from '../../src/ai/prompts/analyst.js';
import { getAIResponse } from '../../src/services/aiProviderService.js';
import { requireAdminAuth } from './authGuard.js';

const router = Router();
const DEFAULT_PROMPTS = { mentor: MENTOR_SYSTEM_PROMPT, analyst: ANALYST_SYSTEM_PROMPT };
const ROLES = ['mentor', 'analyst', 'teacher', 'trader', 'translator'];
const LANGS = ['tg', 'ru', 'en'];

router.get('/ai-prompts', requireAdminAuth, async (req, res) => {
  const role = ROLES.includes(req.query.role) ? req.query.role : 'mentor';
  const language = LANGS.includes(req.query.language) ? req.query.language : 'tg';

  const activeOverride = await AITemplate.findOne({ role, language, isActive: true }).sort({ updatedAt: -1 }).lean();
  const currentText = activeOverride?.promptText || DEFAULT_PROMPTS[role]?.[language] || '';
  const history = await AITemplate.find({ role, language }).sort({ createdAt: -1 }).limit(10).lean();

  res.render('aiPrompts', { role, language, roles: ROLES, langs: LANGS, currentText, isOverride: !!activeOverride, history });
});

/** Сохраняет новую версию промпта как активную (предыдущие версии остаются в истории, но деактивируются). */
router.post('/ai-prompts/save', requireAdminAuth, async (req, res) => {
  const { role, language, promptText } = req.body;

  await AITemplate.updateMany({ role, language, isActive: true }, { $set: { isActive: false } });

  const lastVersion = await AITemplate.findOne({ role, language }).sort({ version: -1 });
  await AITemplate.create({
    role,
    language,
    promptText,
    isActive: true,
    version: (lastVersion?.version || 0) + 1,
    updatedBy: req.admin.id,
  });

  res.redirect(`/ai-prompts?role=${role}&language=${language}`);
});

/** Сброс к дефолтному хардкод-промпту (деактивирует все кастомные версии). */
router.post('/ai-prompts/reset', requireAdminAuth, async (req, res) => {
  const { role, language } = req.body;
  await AITemplate.updateMany({ role, language, isActive: true }, { $set: { isActive: false } });
  res.redirect(`/ai-prompts?role=${role}&language=${language}`);
});

/** Тестирует промпт в реальном времени с тестовым вопросом, не сохраняя его. */
router.post('/ai-prompts/test', requireAdminAuth, async (req, res) => {
  const { promptText, testQuestion, language } = req.body;
  try {
    const result = await getAIResponse({
      messages: [
        { role: 'system', content: promptText },
        { role: 'user', content: testQuestion },
      ],
      language,
      useCache: false,
    });
    return res.json({ success: true, response: result.content, provider: result.provider });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
