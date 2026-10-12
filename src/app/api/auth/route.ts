import {
  authClient,
  endpoint,
  HttpError,
  jsonBody,
  rateLimit,
  sameOrigin,
  actor,
} from '@/lib/server';
import { z } from 'zod';
const schema = z.object({
  action: z.enum(['login', 'logout', 'recover', 'password']),
  email: z.email().optional(),
  password: z.string().min(12).max(128).optional(),
});
export async function POST(req: Request) {
  return endpoint(async () => {
    sameOrigin(req);
    const body = schema.parse(await jsonBody(req, 4000)),
      auth = await authClient();
    await rateLimit(
      'auth:' + (body.email?.toLowerCase() || req.headers.get('x-vercel-forwarded-for') || 'local'),
      5,
    );
    if (body.action === 'login') {
      if (!body.email || !body.password)
        throw new HttpError(400, 'Email and password are required');
      const { error } = await auth.auth.signInWithPassword({
        email: body.email,
        password: body.password,
      });
      if (error) throw new HttpError(401, 'Sign-in failed. Check your email and password.');
      try {
        await actor();
      } catch (e) {
        await auth.auth.signOut();
        throw e;
      }
    } else if (body.action === 'logout') {
      await auth.auth.signOut();
    } else if (body.action === 'recover') {
      if (!body.email) throw new HttpError(400, 'Email is required');
      await auth.auth.resetPasswordForEmail(body.email, {
        redirectTo: process.env.APP_URL + '/auth/callback',
      });
    } else {
      await actor();
      if (!body.password) throw new HttpError(400, 'Password is required');
      const { error } = await auth.auth.updateUser({ password: body.password });
      if (error) throw new HttpError(400, 'Password could not be updated');
    }
    return { ok: true };
  });
}
