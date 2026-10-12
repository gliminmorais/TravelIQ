import { beforeAll, afterAll, describe, it, expect, vi } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { sql } from 'drizzle-orm';
import { demoBookings } from '@/lib/demo';
import {
  saveBooking,
  listBookings,
  recordTransaction,
  archiveBooking,
  scoped,
  type Actor,
} from '@/db/repository';
let pg: PGlite, db: ReturnType<typeof drizzle>;
vi.mock('@/db/client', () => ({ database: () => db }));
const a: Actor = {
    agencyId: '10000000-0000-4000-8000-000000000001',
    userId: '20000000-0000-4000-8000-000000000001',
    role: 'admin',
  },
  other: Actor = {
    agencyId: '10000000-0000-4000-8000-000000000002',
    userId: '20000000-0000-4000-8000-000000000002',
    role: 'staff',
  };
let bookingId: string;
beforeAll(async () => {
  pg = new PGlite();
  await pg.waitReady;
  db = drizzle(pg);
  for (const file of readdirSync('src/db/generated')
    .filter((f) => f.endsWith('.sql'))
    .sort())
    await pg.exec(readFileSync('src/db/generated/' + file, 'utf8'));
  await pg.query('INSERT INTO agencies(id,name) VALUES ($1,$2),($3,$4)', [
    a.agencyId,
    'Fictional A',
    other.agencyId,
    'Fictional B',
  ]);
  await pg.query(
    'INSERT INTO memberships(user_id,agency_id,name,role) VALUES ($1,$2,$3,$4),($5,$6,$7,$8)',
    [a.userId, a.agencyId, 'Admin A', 'admin', other.userId, other.agencyId, 'Staff B', 'staff'],
  );
  await pg.exec('SET ROLE traveliq_app');
});
afterAll(async () => {
  await pg?.close();
});
describe('real PostgreSQL engine and repository integration', () => {
  it('creates a normalized booking with all relationships and an audit', async () => {
    const b = await saveBooking(a, {
      ...demoBookings()[0],
      customerCharged: '100.00',
      agencyCost: '80.00',
      pnr: 'DBTEST',
      version: undefined,
    });
    bookingId = b.id;
    expect(b.passengers.length).toBe(1);
    expect(b.segments.length).toBe(1);
    expect(b.customerCharged).toBe('100.00');
    const logs = await scoped(a, (tx) => tx.execute(sql`select * from audit_logs`));
    expect((logs as unknown as { rows: unknown[] }).rows.length).toBe(1);
  });
  it('hides records from a different agency at both repository and RLS levels', async () => {
    expect((await listBookings(other)).bookings).toHaveLength(0);
    const raw = await scoped(other, (tx) => tx.execute(sql`select * from bookings`));
    expect((raw as unknown as { rows: unknown[] }).rows).toHaveLength(0);
    await expect(
      recordTransaction(other, bookingId, {
        type: 'payment',
        amount: '1',
        date: '2026-10-01',
        note: 'wrong tenant',
      }),
    ).rejects.toThrow('not found');
  });
  it('enforces duplicate acknowledgement and permits deliberately reused PNRs', async () => {
    const b = (await listBookings(a)).bookings[0];
    await expect(saveBooking(a, { ...b, version: undefined })).rejects.toThrow('duplicate');
    const next = await saveBooking(a, { ...b, acknowledgeDuplicate: true, version: undefined });
    expect(next.id).not.toBe(bookingId);
    expect(next.pnr).toBe('DBTEST');
  });
  it('updates optimistically and preserves original charges', async () => {
    const b = (await listBookings(a)).bookings.find((x) => x.id === bookingId)!;
    const updated = await saveBooking(
      a,
      { ...b, status: 'pending', acknowledgeDuplicate: true },
      bookingId,
    );
    expect(updated.version).toBe(2);
    await expect(
      saveBooking(a, { ...b, status: 'confirmed', acknowledgeDuplicate: true }, bookingId),
    ).rejects.toThrow('changed');
    await expect(
      saveBooking(
        a,
        { ...updated, customerCharged: '150.00', acknowledgeDuplicate: true },
        bookingId,
      ),
    ).rejects.toThrow('immutable');
  });
  it('keeps an immutable cash ledger and enforces role restrictions', async () => {
    const updated = await recordTransaction(a, bookingId, {
      type: 'payment',
      amount: '50.00',
      date: '2026-10-01',
      note: 'partial receipt',
    });
    expect(updated.transactions).toHaveLength(1);
    await expect(
      recordTransaction({ ...a, role: 'staff' }, bookingId, {
        type: 'refund',
        amount: '10',
        date: '2026-10-01',
        note: 'return',
      }),
    ).rejects.toThrow('Administrator');
    await expect(scoped(a, (tx) => tx.execute(sql`delete from payments`))).rejects.toThrow();
    await expect(scoped(a, (tx) => tx.execute(sql`delete from audit_logs`))).rejects.toThrow();
  });
  it('rejects overpayments and archives only settled bookings', async () => {
    await expect(
      recordTransaction(a, bookingId, {
        type: 'payment',
        amount: '51',
        date: '2026-10-01',
        note: 'too much',
      }),
    ).rejects.toThrow('exceeds');
    await expect(archiveBooking(a, bookingId)).rejects.toThrow('Settle');
    await recordTransaction(a, bookingId, {
      type: 'payment',
      amount: '50',
      date: '2026-10-01',
      note: 'settlement',
    });
    await archiveBooking(a, bookingId);
    expect((await listBookings(a)).bookings.find((b) => b.id === bookingId)?.archived).toBe(true);
  });
  it('blocks a forged cross-agency child foreign key', async () => {
    await expect(
      scoped(other, (tx) =>
        tx.execute(
          sql`insert into payments(agency_id,booking_id,amount,date,note) values(${other.agencyId},${bookingId},1,'2026-10-01','forged')`,
        ),
      ),
    ).rejects.toThrow();
  });
  it('rate limits atomically and does not leak context outside a transaction', async () => {
    await scoped(a, (tx) => tx.execute(sql`select app_rate_limit('test',1)`));
    const limit = await db.execute(sql`select app_rate_limit('test',1) as allowed`);
    expect(limit.rows[0].allowed).toBe(false);
    const result = await db.execute(sql`select * from bookings`);
    expect(result.rows).toHaveLength(0);
  });
});
