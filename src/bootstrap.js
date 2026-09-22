import { loadSettingsIntoEnv } from './utils/loadEnvFromDb.js';

await loadSettingsIntoEnv();
await import('./index.js');
