import { Router } from 'express';
import Admin from '../../src/models/Admin.js';
import { SETTINGS_SCHEMA, getCurrentSettingsValues, saveSettings, fetchAvailableGroqModels } from '../../src/services/configService.js';
import { requireAdminAuth } from './authGuard.js';
import logger from '../../src/utils/errorHandler.js';

const router = Router();

function getIntegrationStatus() {
  return {
    groq: !!process.env.GROQ_API_KEY,
    openrouter: !!process.env.OPENROUTER_API_KEY,
    gemini: !!process.env.GOOGLE_GEMINI_API_KEY,
    together: !!process.env.TOGETHER_API_KEY,
    cohere: !!process.env.COHERE_API_KEY,
    alif: !!(process.env.ALIF_MERCHANT_ID && process.env.ALIF_API_KEY),
    eskhata: !!(process.env.ESKHATA_MERCHANT_ID && process.env.ESKHATA_API_KEY),
    humo: !!(process.env.HUMO_MERCHANT_ID && process.env.HUMO_API_KEY),
    nowpayments: !!process.env.NOWPAYMENTS_API_KEY,
  };
}

router.get('/settings', requireAdminAuth, async (req, res) => {
  const groqModels = await fetchAvailableGroqModels();
  res.render('settings', {
    integrations: getIntegrationStatus(),
    settingsSchema: SETTINGS_SCHEMA,
    values: getCurrentSettingsValues(),
    groqModels,
    error: req.query.error || null,
    success: req.query.saved ? `Сохранено настроек: ${req.query.saved}` : (req.query.pwOk ? 'Пароль успешно изменён' : null),
  });
});

router.post('/settings/config', requireAdminAuth, async (req, res) => {
  try {
    const count = await saveSettings(req.body, req.admin.id);
    logger.info(`⚙️ Админ обновил ${count} настроек через панель`);
    return res.redirect(`/settings?saved=${count}`);
  } catch (err) {
    logger.error('Ошибка сохранения настроек:', err);
    return res.redirect(`/settings?error=${encodeURIComponent('Не удалось сохранить настройки: ' + err.message)}`);
  }
});

router.post('/settings/password', requireAdminAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const admin = await Admin.findById(req.admin.id);

  if (!(await admin.verifyPassword(currentPassword))) {
    return res.redirect(`/settings?error=${encodeURIComponent('Неверный текущий пароль')}`);
  }

  admin.passwordHash = await Admin.hashPassword(newPassword);
  await admin.save();

  return res.redirect('/settings?pwOk=1');
});

export default router;
