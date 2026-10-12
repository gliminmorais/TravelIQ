import type { Booking } from './model';
import { financials, sum, D } from './finance';
export function totals(bookings: Booking[]) {
  const f = bookings.map(financials),
    revenue = sum(f.map((x) => x.revenue)),
    cost = sum(f.map((x) => x.cost)),
    profit = revenue.minus(cost);
  return {
    bookings: bookings.length,
    revenue,
    cost,
    profit,
    margin: revenue.isZero() ? D(0) : profit.div(revenue).mul(100),
    outstanding: sum(f.map((x) => x.outstanding)),
    cash: sum(f.map((x) => x.cash)),
    credit: sum(f.map((x) => x.credit)),
  };
}
export function monthly(
  bookings: Booking[],
  basis: 'booking' | 'departure' | 'payment' = 'booking',
) {
  const groups = new Map<
    string,
    { revenue: ReturnType<typeof D>; cost: ReturnType<typeof D>; bookings: number }
  >();
  for (const b of bookings) {
    if (basis === 'payment') {
      for (const t of b.transactions.filter((t) => t.type !== 'adjustment')) {
        const month = t.date.slice(0, 7),
          g = groups.get(month) || { revenue: D(0), cost: D(0), bookings: 0 };
        g.revenue = g.revenue.plus(D(t.amount).mul(t.type === 'refund' ? -1 : 1));
        groups.set(month, g);
      }
    } else {
      const month = (
          basis === 'booking' ? b.bookedOn : b.segments[0]?.departure || b.bookedOn
        ).slice(0, 7),
        f = financials(b),
        g = groups.get(month) || { revenue: D(0), cost: D(0), bookings: 0 };
      g.revenue = g.revenue.plus(f.revenue);
      g.cost = g.cost.plus(f.cost);
      g.bookings++;
      groups.set(month, g);
    }
  }
  if (!groups.size) return [];
  const keys = [...groups.keys()].sort(),
    start = new Date(keys[0] + '-01T00:00:00Z'),
    end = keys.at(-1)!;
  const result = [];
  for (let i = 0; i < 1200; i++) {
    const key = start.toISOString().slice(0, 7);
    if (key > end) break;
    const g = groups.get(key) || { revenue: D(0), cost: D(0), bookings: 0 };
    result.push({
      month: key,
      label: new Date(key + '-02').toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
      revenue: g.revenue.toNumber(),
      cost: g.cost.toNumber(),
      profit: g.revenue.minus(g.cost).toNumber(),
      bookings: g.bookings,
    });
    start.setUTCMonth(start.getUTCMonth() + 1);
  }
  return result;
}
export function ranked(bookings: Booking[], key: (b: Booking) => string) {
  const groups = new Map<string, Booking[]>();
  bookings.forEach((b) => {
    const k = key(b);
    groups.set(k, [...(groups.get(k) || []), b]);
  });
  return [...groups]
    .map(([name, items]) => ({ name, ...totals(items) }))
    .sort((a, b) => b.revenue.comparedTo(a.revenue));
}
export function customers(bookings: Booking[], asOf: string) {
  const date = new Date(asOf + 'T00:00:00Z').getTime();
  return ranked(bookings, (b) => b.customerId).map((g) => {
    const items = bookings
        .filter((b) => b.customerId === g.name)
        .sort((a, b) => b.bookedOn.localeCompare(a.bookedOn)),
      c = items[0];
    const recency = Math.max(
      0,
      Math.floor((date - Date.parse(c.bookedOn + 'T00:00:00Z')) / 86400000),
    );
    const segment =
      recency > 180
        ? 'Inactive'
        : g.bookings >= 5 && g.revenue.gte(100000)
          ? 'High value'
          : g.bookings >= 3
            ? 'Regular'
            : 'New & occasional';
    return {
      ...g,
      id: c.customerId,
      name: c.customerName,
      phone: c.phone,
      email: c.email,
      lastBooking: c.bookedOn,
      recency,
      segment,
    };
  });
}
const median = (values: number[]) => {
  const a = [...values].sort((a, b) => a - b);
  return a.length ? (a[Math.floor(a.length / 2)] + a[Math.floor((a.length - 1) / 2)]) / 2 : 0;
};
export function anomalies(bookings: Booking[]) {
  const charges = bookings.map((b) => financials(b).revenue.toNumber()),
    mid = median(charges),
    mad = median(charges.map((n) => Math.abs(n - mid)));
  return bookings.flatMap((b) => {
    const f = financials(b),
      reasons: string[] = [];
    if (f.profit.lt(0)) reasons.push('Negative gross profit');
    else if (f.revenue.gt(0) && f.margin.lt(5)) reasons.push('Gross margin below 5%');
    if (bookings.length >= 20 && mad > 0 && (0.6745 * (f.revenue.toNumber() - mid)) / mad > 3.5)
      reasons.push('Charge exceeds robust outlier threshold');
    if (
      b.pnr &&
      bookings.some(
        (x) =>
          x.id !== b.id &&
          x.pnr === b.pnr &&
          x.segments[0]?.departure.slice(0, 10) === b.segments[0]?.departure.slice(0, 10),
      )
    )
      reasons.push('Repeated PNR and departure date');
    const peers = bookings.filter(
      (x) =>
        x.id !== b.id &&
        x.bookedOn < b.bookedOn &&
        x.segments[0]?.airline === b.segments[0]?.airline &&
        x.segments[0]?.origin === b.segments[0]?.origin &&
        x.segments[0]?.destination === b.segments[0]?.destination,
    );
    if (peers.length >= 10) {
      const previous = median(peers.map((x) => financials(x).cost.toNumber()));
      if (previous > 0 && f.cost.gt(previous * 2))
        reasons.push('Cost exceeds twice the prior route median');
    }
    return reasons.length ? [{ booking: b, reasons }] : [];
  });
}
export function simulate(
  bookings: number,
  charge: string,
  cost: string,
  cancellation: number,
  growth: number,
) {
  const volume = D(bookings)
    .mul(D(1).plus(D(growth).div(100)))
    .mul(D(1).minus(D(cancellation).div(100)));
  return { volume, revenue: volume.mul(charge), profit: volume.mul(D(charge).minus(cost)) };
}
