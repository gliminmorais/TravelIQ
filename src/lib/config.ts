export type Mode = 'demo' | 'agency';
export function applicationMode(env: Record<string, string | undefined> = process.env): Mode {
  const mode = env.APP_MODE || 'demo';
  if (mode !== 'demo' && mode !== 'agency') throw Error('Invalid APP_MODE');
  if (
    mode === 'demo' &&
    [
      'DATABASE_URL',
      'MIGRATION_DATABASE_URL',
      'SUPABASE_URL',
      'SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'STORAGE_BUCKET',
    ].some((k) => env[k])
  )
    throw Error('Demo must not have agency credentials');
  return mode;
}
