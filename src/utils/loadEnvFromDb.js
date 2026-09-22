import 'dotenv/config';
import mongoose from 'mongoose';

export async function loadSettingsIntoEnv() {
  const uri = process.env.MONGO_URI || 'mongodb://localhost:27017/trademaster_ai_tj';

  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });

    const Setting = mongoose.model(
      'SettingBootstrap',
      new mongoose.Schema({ key: String, value: String }, { strict: false, collection: 'settings' }),
    );

    const settings = await Setting.find().lean();
    for (const s of settings) {
      if (s.value !== undefined && s.value !== null && s.value !== '') {
        process.env[s.key] = s.value;
      }
    }

    console.log(`⚙️  Загружено настроек из БД: ${settings.length}`);
  } catch (err) {
    console.warn(`⚠️  Не удалось загрузить настройки из БД (используются только .env): ${err.message}`);
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
}

export default loadSettingsIntoEnv;
