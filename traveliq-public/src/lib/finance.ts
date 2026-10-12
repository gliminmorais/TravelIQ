import Decimal from 'decimal.js';
import type { Booking, Transaction } from './model';
export const D = (v: Decimal.Value) => new Decimal(v);
export const sum = (v: Decimal.Value[]) => v.reduce<Decimal>((a, b) => a.plus(b), D(0));
export function financials(b: Pick<Booking, 'agencyCost' | 'customerCharged' | 'transactions'>) {
  const adjustments = b.transactions.filter((t) => t.type === 'adjustment');
  const revenue = D(b.customerCharged).plus(sum(adjustments.map((t) => t.amount)));
  const cost = D(b.agencyCost).plus(sum(adjustments.map((t) => t.costAdjustment || '0')));
  const paid = sum(b.transactions.filter((t) => t.type === 'payment').map((t) => t.amount));
  const refunds = sum(b.transactions.filter((t) => t.type === 'refund').map((t) => t.amount));
  const cash = paid.minus(refunds),
    profit = revenue.minus(cost),
    balance = revenue.minus(cash);
  return {
    revenue,
    cost,
    profit,
    cash,
    paid,
    refunds,
    balance,
    outstanding: Decimal.max(0, balance),
    credit: Decimal.max(0, balance.neg()),
    margin: revenue.isZero() ? D(0) : profit.div(revenue).times(100),
    paymentStatus: balance.lte(0) ? 'paid' : cash.gt(0) ? 'partially paid' : 'unpaid',
  };
}
export function validateTransaction(b: Booking, t: Transaction) {
  const f = financials({ ...b, transactions: [...b.transactions, t] });
  if (f.revenue.lt(0) || f.cost.lt(0)) throw Error('Adjusted charges and costs cannot be negative');
  if (f.cash.lt(0)) throw Error('Refund exceeds payments received');
  if (t.type === 'payment' && f.balance.lt(0))
    throw Error('Payment exceeds the outstanding balance');
}
export function inr(v: Decimal.Value, compact = false) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: compact ? 1 : 2,
    notation: compact ? 'compact' : 'standard',
  }).format(Number(v));
}
export function duplicateBookings(
  bookings: Booking[],
  b: Pick<Booking, 'pnr' | 'segments' | 'customerName'>,
  exclude?: string,
) {
  return bookings.filter(
    (x) =>
      x.id !== exclude &&
      !x.archived &&
      ((b.pnr &&
        x.pnr.toUpperCase() === b.pnr.toUpperCase() &&
        x.segments.some((s) =>
          b.segments.some((t) => s.departure.slice(0, 10) === t.departure.slice(0, 10)),
        )) ||
        (x.customerName.toLowerCase() === b.customerName.toLowerCase() &&
          x.segments.some((s) =>
            b.segments.some(
              (t) => s.departure === t.departure && s.flightNumber === t.flightNumber,
            ),
          ))),
  );
}
export function csv(rows: Record<string, unknown>[]) {
  if (!rows.length) return '';
  const escape = (v: unknown) =>
    '"' +
    String(v ?? '')
      .replace(/^[=+\-@\t\r]/, "'$&")
      .replace(/"/g, '""') +
    '"';
  return (
    '\uFEFF' +
    [
      Object.keys(rows[0]).map(escape).join(','),
      ...rows.map((r) => Object.values(r).map(escape).join(',')),
    ].join('\r\n')
  );
}
