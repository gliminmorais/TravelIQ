import { beforeEach, describe, it, expect, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  where: vi.fn(),
  execute: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock('next/headers', () => ({ cookies: async () => ({ getAll: () => [], set: vi.fn() }) }));
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { getUser: mocks.getUser } }),
}));
vi.mock('@/db/client', () => ({ database: () => ({ transaction: mocks.transaction }) }));
import { actor, sameOrigin, jsonBody, endpoint, HttpError } from '@/lib/server';
beforeEach(() => {
  process.env.APP_MODE = 'agency';
  process.env.APP_URL = 'https://agency.example';
  mocks.getUser.mockReset();
  mocks.where.mockReset();
  mocks.execute.mockReset();
  mocks.transaction.mockReset();
  mocks.execute.mockResolvedValue([{ role: 'traveliq_app' }]);
  mocks.transaction.mockImplementation((fn) =>
    fn({ execute: mocks.execute, select: () => ({ from: () => ({ where: mocks.where }) }) }),
  );
});
describe('server authentication and request controls', () => {
  it('rejects unauthenticated requests before querying customer data', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: true });
    await expect(actor()).rejects.toMatchObject({ status: 401 });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it('rejects authenticated users without an active membership', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-a' } }, error: null });
    mocks.where.mockResolvedValue([]);
    await expect(actor()).rejects.toMatchObject({ status: 403 });
  });
  it('derives the agency and role from the server membership', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'user-a', user_metadata: { role: 'admin', agencyId: 'forged' } } },
      error: null,
    });
    mocks.where.mockResolvedValue([
      { agencyId: 'trusted-agency', role: 'staff', name: 'Sample Staff' },
    ]);
    expect(await actor()).toEqual({
      userId: 'user-a',
      agencyId: 'trusted-agency',
      role: 'staff',
      name: 'Sample Staff',
    });
  });
  it('refuses a privileged database connection', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-a' } }, error: null });
    mocks.execute.mockResolvedValue([{ role: 'postgres' }]);
    await expect(actor()).rejects.toThrow('restricted');
  });
  it('requires exact same-origin writes', () => {
    expect(() =>
      sameOrigin(
        new Request('https://agency.example/api', {
          headers: { origin: 'https://agency.example' },
        }),
      ),
    ).not.toThrow();
    for (const origin of ['https://other.example', 'null', 'https://agency.example.evil.test'])
      expect(() =>
        sameOrigin(new Request('https://agency.example/api', { headers: { origin } })),
      ).toThrow();
    expect(() => sameOrigin(new Request('https://agency.example/api'))).toThrow();
  });
  it('bounds JSON input and gives safe structured errors', async () => {
    await expect(
      jsonBody(new Request('https://agency.example', { method: 'POST', body: 'x'.repeat(50) }), 10),
    ).rejects.toMatchObject({ status: 413 });
    const r = await endpoint(async () => {
      throw new HttpError(401, 'Please sign in');
    });
    expect(r.status).toBe(401);
    expect(r.headers.get('cache-control')).toContain('no-store');
  });
});
