import 'server-only';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { applicationMode } from '@/lib/config';
let instance: ReturnType<typeof drizzle> | undefined;
export function database() {
  if (applicationMode() !== 'agency') throw Error('Database access is disabled in demo mode');
  if (!process.env.DATABASE_URL) throw Error('Database is not configured');
  return (instance ??= drizzle(
    postgres(process.env.DATABASE_URL, {
      prepare: false,
      max: 3,
      idle_timeout: 20,
      connect_timeout: 10,
    }),
  ));
}
