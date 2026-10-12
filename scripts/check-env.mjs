import env from '@next/env';
const { loadEnvConfig } = env;
loadEnvConfig(process.cwd());
const mode = process.env.APP_MODE || 'demo';
if (!['demo', 'agency'].includes(mode)) throw Error('APP_MODE must be demo or agency');
const privateKeys = [
  'DATABASE_URL',
  'MIGRATION_DATABASE_URL',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'STORAGE_BUCKET',
];
if (mode === 'demo' && privateKeys.some((k) => process.env[k]))
  throw Error('Demo build refused: remove all agency environment variables.');
if (mode === 'agency') {
  for (const key of [
    'APP_URL',
    'DATABASE_URL',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ])
    if (!process.env[key]) throw Error(`Missing ${key}`);
  if (process.env.VERCEL && process.env.MIGRATION_DATABASE_URL)
    throw Error('Do not install the privileged migration URL in Vercel.');
}
console.log(`Environment boundary checked: ${mode}`);
