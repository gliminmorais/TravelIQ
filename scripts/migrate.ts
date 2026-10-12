import { loadEnvConfig } from '@next/env';
import postgres from 'postgres';
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
loadEnvConfig(process.cwd());
async function main() {
  if (process.env.APP_MODE !== 'agency' || !process.env.MIGRATION_DATABASE_URL)
    throw Error('Set APP_MODE=agency and MIGRATION_DATABASE_URL in your local agency environment.');
  const db = postgres(process.env.MIGRATION_DATABASE_URL, { max: 1, prepare: false });
  try {
    await db.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(784214)`;
      await tx`create table if not exists traveliq_migrations(name text primary key,checksum text not null,applied_at timestamptz not null default now())`;
      const files = (await readdir('src/db/generated')).filter((f) => f.endsWith('.sql')).sort();
      for (const file of files) {
        const body = await readFile('src/db/generated/' + file, 'utf8'),
          hash = createHash('sha256').update(body).digest('hex');
        const [done] = await tx`select checksum from traveliq_migrations where name=${file}`;
        if (done) {
          if (done.checksum !== hash) throw Error('Previously applied migration changed: ' + file);
          continue;
        }
        await tx.unsafe(body);
        await tx`insert into traveliq_migrations(name,checksum) values(${file},${hash})`;
        console.log('Applied ' + file);
      }
    });
  } finally {
    await db.end();
  }
}
main().catch(() => {
  console.error(
    'Migration failed. Check your local database access, migration history and role permissions. Credentials are not printed.',
  );
  process.exitCode = 1;
});
