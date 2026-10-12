import { and, eq, inArray, sql, gt, asc, or } from 'drizzle-orm';
import { database } from './client';
import * as s from './schema';
import { bookingSchema, transactionSchema, type BookingInput } from '@/lib/validation';
import type { Booking, Transaction } from '@/lib/model';
import { duplicateBookings, validateTransaction, financials, D } from '@/lib/finance';
export type Actor = { userId: string; agencyId: string; role: string };
type Tx = Parameters<Parameters<ReturnType<typeof database>['transaction']>[0]>[0];
export async function scoped<T>(a: Actor, fn: (tx: Tx) => Promise<T>) {
  return database().transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('app.agency_id',${a.agencyId},true),set_config('app.user_id',${a.userId},true)`,
    );
    return fn(tx);
  });
}
async function audit(
  tx: Tx,
  a: Actor,
  action: string,
  recordId: string,
  details: Record<string, unknown> = {},
) {
  await tx
    .insert(s.auditLogs)
    .values({ agencyId: a.agencyId, userId: a.userId, action, recordId, details });
}
export async function loadBookings(
  tx: Tx,
  agencyId: string,
  ids?: string[],
  cursor?: string,
): Promise<Booking[]> {
  const where = and(
    eq(s.bookings.agencyId, agencyId),
    ids ? inArray(s.bookings.id, ids) : undefined,
    cursor ? gt(s.bookings.id, cursor) : undefined,
  );
  const rows = await tx
    .select()
    .from(s.bookings)
    .innerJoin(
      s.customers,
      and(eq(s.customers.id, s.bookings.customerId), eq(s.customers.agencyId, agencyId)),
    )
    .innerJoin(s.financialRecords, eq(s.financialRecords.bookingId, s.bookings.id))
    .where(where)
    .orderBy(asc(s.bookings.id))
    .limit(ids ? ids.length : 250);
  if (!rows.length) return [];
  const bookingIds = rows.map((r) => r.bookings.id);
  const [ps, fs, pay, ref, adj] = await Promise.all([
    tx
      .select()
      .from(s.passengers)
      .where(and(eq(s.passengers.agencyId, agencyId), inArray(s.passengers.bookingId, bookingIds)))
      .orderBy(s.passengers.position),
    tx
      .select()
      .from(s.flightSegments)
      .where(
        and(
          eq(s.flightSegments.agencyId, agencyId),
          inArray(s.flightSegments.bookingId, bookingIds),
        ),
      )
      .orderBy(s.flightSegments.position),
    tx
      .select()
      .from(s.payments)
      .where(and(eq(s.payments.agencyId, agencyId), inArray(s.payments.bookingId, bookingIds))),
    tx
      .select()
      .from(s.refunds)
      .where(and(eq(s.refunds.agencyId, agencyId), inArray(s.refunds.bookingId, bookingIds))),
    tx
      .select()
      .from(s.adjustments)
      .where(
        and(eq(s.adjustments.agencyId, agencyId), inArray(s.adjustments.bookingId, bookingIds)),
      ),
  ]);
  return rows.map(({ bookings: b, customers: c, financial_records: f }) => ({
    ...b,
    currency: 'INR',
    status: b.status as Booking['status'],
    createdAt: b.createdAt.toISOString(),
    customerName: c.name,
    phone: c.phone,
    email: c.email,
    agencyCost: f.agencyCost,
    customerCharged: f.customerCharged,
    passengers: ps
      .filter((p) => p.bookingId === b.id)
      .map((p) => ({ name: p.name, ticketNumber: p.ticketNumber })),
    segments: fs.filter((p) => p.bookingId === b.id),
    transactions: [
      ...pay.map((t) => ({ ...t, type: 'payment' as const })),
      ...ref.map((t) => ({ ...t, type: 'refund' as const })),
      ...adj.map((t) => ({ ...t, type: 'adjustment' as const })),
    ].filter((t) => t.bookingId === b.id),
  }));
}
export function listBookings(a: Actor, cursor?: string) {
  return scoped(a, async (tx) => {
    const bookings = await loadBookings(tx, a.agencyId, undefined, cursor);
    return { bookings, nextCursor: bookings.length === 250 ? bookings.at(-1)!.id : null };
  });
}
export async function saveBooking(a: Actor, input: BookingInput, id?: string) {
  const data = bookingSchema.parse(input);
  return scoped(a, async (tx) => {
    // Serializes duplicate checks within an agency; transactions still use optimistic versions for edits.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${a.agencyId}))`);
    const possible = await tx
      .select({ id: s.bookings.id })
      .from(s.bookings)
      .innerJoin(s.customers, eq(s.bookings.customerId, s.customers.id))
      .where(
        and(
          eq(s.bookings.agencyId, a.agencyId),
          or(
            eq(s.bookings.pnr, data.pnr.toUpperCase()),
            sql`lower(${s.customers.name})=lower(${data.customerName})`,
          ),
        ),
      );
    const candidates = possible.length
      ? await loadBookings(
          tx,
          a.agencyId,
          possible.map((b) => b.id),
        )
      : [];
    if (duplicateBookings(candidates, data, id).length && !data.acknowledgeDuplicate)
      throw Error(
        'Potential duplicate: review the existing customer, flight and PNR, then acknowledge to save.',
      );
    const existing = id ? (await loadBookings(tx, a.agencyId, [id]))[0] : undefined;
    if (id && (!existing || existing.archived)) throw Error('Booking not found');
    if (existing && data.version !== existing.version)
      throw Error('This booking changed. Refresh and review before saving.');
    if (
      existing &&
      (!D(data.agencyCost).eq(existing.agencyCost) ||
        !D(data.customerCharged).eq(existing.customerCharged))
    )
      throw Error('Original charges are immutable. Use a financial adjustment with a reason.');
    const identity =
      data.customerName.toLowerCase().replace(/\s+/g, ' ') + '|' + data.phone.replace(/\D/g, '');
    const [customer] = await tx
      .insert(s.customers)
      .values({
        agencyId: a.agencyId,
        name: data.customerName,
        phone: data.phone,
        email: data.email,
        identity,
      })
      .onConflictDoUpdate({
        target: [s.customers.agencyId, s.customers.identity],
        set: { email: data.email },
      })
      .returning();
    const common = {
      customerId: customer.id,
      pnr: data.pnr.toUpperCase(),
      bookedOn: data.bookedOn,
      status: data.status,
      currency: data.currency,
    };
    let bookingId = id;
    if (id) {
      const updated = await tx
        .update(s.bookings)
        .set({ ...common, version: existing!.version + 1, updatedAt: new Date() })
        .where(
          and(
            eq(s.bookings.id, id),
            eq(s.bookings.agencyId, a.agencyId),
            eq(s.bookings.version, data.version!),
          ),
        )
        .returning();
      if (!updated.length) throw Error('This booking changed. Refresh before saving.');
      await tx
        .delete(s.passengers)
        .where(and(eq(s.passengers.bookingId, id), eq(s.passengers.agencyId, a.agencyId)));
      await tx
        .delete(s.flightSegments)
        .where(and(eq(s.flightSegments.bookingId, id), eq(s.flightSegments.agencyId, a.agencyId)));
    } else {
      const [b] = await tx
        .insert(s.bookings)
        .values({ ...common, agencyId: a.agencyId })
        .returning();
      bookingId = b.id;
      await tx
        .insert(s.financialRecords)
        .values({
          agencyId: a.agencyId,
          bookingId: b.id,
          agencyCost: data.agencyCost,
          customerCharged: data.customerCharged,
        });
    }
    await tx
      .insert(s.passengers)
      .values(
        data.passengers.map((p, position) => ({
          ...p,
          position,
          agencyId: a.agencyId,
          bookingId: bookingId!,
        })),
      );
    await tx
      .insert(s.flightSegments)
      .values(
        data.segments.map((p, position) => ({
          ...p,
          position,
          agencyId: a.agencyId,
          bookingId: bookingId!,
        })),
      );
    await audit(tx, a, id ? 'booking.updated' : 'booking.created', bookingId!, {
      version: existing ? existing.version + 1 : 1,
    });
    return (await loadBookings(tx, a.agencyId, [bookingId!]))[0];
  });
}
export async function recordTransaction(a: Actor, id: string, input: unknown) {
  const t = transactionSchema.parse(input);
  if (t.type !== 'payment' && a.role !== 'admin') throw Error('Administrator access required');
  return scoped(a, async (tx) => {
    await tx.execute(
      sql`select id from bookings where id=${id} and agency_id=${a.agencyId} for update`,
    );
    const b = (await loadBookings(tx, a.agencyId, [id]))[0];
    if (!b || b.archived) throw Error('Booking not found');
    validateTransaction(b, { ...t, id: crypto.randomUUID() } as Transaction);
    const common = {
      agencyId: a.agencyId,
      bookingId: id,
      amount: t.amount,
      date: t.date,
      note: t.note,
    };
    if (t.type === 'adjustment')
      await tx.insert(s.adjustments).values({ ...common, costAdjustment: t.costAdjustment || '0' });
    else await tx.insert(t.type === 'payment' ? s.payments : s.refunds).values(common);
    await tx
      .update(s.bookings)
      .set({ version: b.version + 1, updatedAt: new Date() })
      .where(and(eq(s.bookings.id, id), eq(s.bookings.agencyId, a.agencyId)));
    await audit(tx, a, `finance.${t.type}`, id, {
      amount: t.amount,
      costAdjustment: t.costAdjustment || '0',
    });
    return (await loadBookings(tx, a.agencyId, [id]))[0];
  });
}
export async function archiveBooking(a: Actor, id: string) {
  if (a.role !== 'admin') throw Error('Administrator access required');
  return scoped(a, async (tx) => {
    await tx.execute(
      sql`select id from bookings where id=${id} and agency_id=${a.agencyId} for update`,
    );
    const b = (await loadBookings(tx, a.agencyId, [id]))[0];
    if (!b) throw Error('Booking not found');
    if (!financials(b).balance.isZero())
      throw Error('Settle the outstanding balance or customer credit before archiving');
    await tx
      .update(s.bookings)
      .set({ archived: true, version: b.version + 1, updatedAt: new Date() })
      .where(and(eq(s.bookings.id, id), eq(s.bookings.agencyId, a.agencyId)));
    await audit(tx, a, 'booking.archived', id);
    return { ok: true };
  });
}
