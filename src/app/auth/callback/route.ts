import { authClient } from '@/lib/server';
export async function GET(req: Request) {
  const url = new URL(req.url),
    client = await authClient(),
    code = url.searchParams.get('code'),
    token_hash = url.searchParams.get('token_hash'),
    type = url.searchParams.get('type');
  const result = code
    ? await client.auth.exchangeCodeForSession(code)
    : token_hash && (type === 'recovery' || type === 'invite')
      ? await client.auth.verifyOtp({ token_hash, type })
      : { error: true };
  return Response.redirect(
    new URL(result.error ? '/?authError=1' : '/reset-password', process.env.APP_URL),
    303,
  );
}
