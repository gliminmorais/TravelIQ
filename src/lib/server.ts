import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { applicationMode } from './config';
import { database } from '@/db/client';
import { memberships } from '@/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';
import { ZodError } from 'zod';
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function agencyOnly() {
  if (applicationMode() !== 'agency') throw new HttpError(404, 'Not available in demo mode');
}
export async function authClient() {
  agencyOnly();
  const jar = await cookies();
  return createServerClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    },
    cookies: {
      getAll: () => jar.getAll(),
      setAll(values) {
        try {
          values.forEach(({ name, value, options }) => jar.set(name, value, options));
        } catch {
          /* Server pages cannot write; protected route handlers refresh cookies. */
        }
      },
    },
  });
}
export function storageClient() {
  agencyOnly();
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
export async function actor() {
  const supabase = await authClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new HttpError(401, 'Please sign in');
  return database().transaction(async (tx) => {
    const role = await tx.execute(sql`select current_user as role`);
    if (role[0]?.role !== 'traveliq_app')
      throw Error('Application database must use the restricted traveliq_app role');
    await tx.execute(sql`select set_config('app.user_id',${user.id},true)`);
    const [m] = await tx
      .select()
      .from(memberships)
      .where(and(eq(memberships.userId, user.id), eq(memberships.active, true)));
    if (!m) throw new HttpError(403, 'Your account does not have agency access');
    return { userId: user.id, agencyId: m.agencyId, role: m.role, name: m.name };
  });
}
export function sameOrigin(req: Request) {
  const expected = process.env.APP_URL || 'http://localhost:3000';
  if (req.headers.get('origin') !== new URL(expected).origin)
    throw new HttpError(403, 'Request origin is not allowed');
}
export async function rateLimit(key: string, limit = 60) {
  const hash = createHash('sha256').update(key).digest('hex');
  const result = await database().execute(sql`select app_rate_limit(${hash},${limit}) as allowed`);
  if (!result[0]?.allowed) throw new HttpError(429, 'Too many requests. Please wait a minute.');
}
export async function jsonBody(req: Request, max = 64000) {
  const reader = req.body?.getReader();
  if (!reader) throw new HttpError(400, 'Request body is missing');
  const parts: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > max) {
      await reader.cancel();
      throw new HttpError(413, 'Request is too large');
    }
    parts.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(parts).toString('utf8'));
  } catch {
    throw new HttpError(400, 'Invalid JSON');
  }
}
export function reply(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { 'Cache-Control': 'private, no-store' } });
}
export async function endpoint(fn: () => Promise<unknown>) {
  try {
    return reply(await fn());
  } catch (e) {
    if (e instanceof HttpError) return reply({ error: e.message }, e.status);
    if (e instanceof ZodError)
      return reply(
        { error: e.issues.map((x) => `${x.path.join('.')}: ${x.message}`).join('; ') },
        400,
      );
    const safe = [
      'Potential duplicate:',
      'Booking not found',
      'This booking changed.',
      'Original charges',
      'Administrator access',
      'Refund exceeds',
      'Payment exceeds',
      'Adjusted charges',
      'Settle the outstanding',
    ];
    if (e instanceof Error && safe.some((s) => e.message.startsWith(s)))
      return reply({ error: e.message }, 409);
    console.error(
      JSON.stringify({
        event: 'request_failed',
        errorType: e instanceof Error ? e.name : 'unknown',
      }),
    );
    return reply(
      { error: 'The request could not be completed. Try again or contact your administrator.' },
      500,
    );
  }
}
