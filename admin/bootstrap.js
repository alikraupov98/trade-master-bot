import { loadSettingsIntoEnv } from '../src/utils/loadEnvFromDb.js';

await loadSettingsIntoEnv();
await import('./server.js');
