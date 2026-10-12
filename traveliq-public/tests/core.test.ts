import { describe, it, expect } from 'vitest';
import { financials, duplicateBookings, validateTransaction, csv, D } from '@/lib/finance';
import { bookingSchema, transactionSchema } from '@/lib/validation';
import { totals, monthly, simulate, anomalies, customers } from '@/lib/analytics';
import { forecast, metrics, predict } from '@/lib/forecast';
import { demoBookings } from '@/lib/demo';
import { parseTicket, extractCustomerPhone, customerDefaults } from '@/lib/pdf/parser';
const example = () => ({
  ...demoBookings()[0],
  agencyCost: '0.10',
  customerCharged: '0.30',
  transactions: [],
});
describe('decimal accounting', () => {
  it('does not accumulate floating point rounding errors', () => {
    expect(financials(example()).profit.toFixed(2)).toBe('0.20');
    expect(totals([example(), example(), example()]).profit.toFixed(2)).toBe('0.60');
  });
  it('handles zero revenue and negative gross profit', () => {
    expect(financials({ ...example(), customerCharged: '0' }).margin.toString()).toBe('0');
    expect(financials({ ...example(), agencyCost: '1' }).profit.toString()).toBe('-0.7');
  });
  it('separates refunds from price adjustments and credits', () => {
    const b = {
      ...example(),
      customerCharged: '100',
      agencyCost: '80',
      transactions: [
        { id: '1', type: 'payment' as const, amount: '100', date: '2026-10-01', note: 'paid' },
        {
          id: '2',
          type: 'adjustment' as const,
          amount: '-90',
          costAdjustment: '-75',
          date: '2026-10-02',
          note: 'cancel',
        },
      ],
    };
    const f = financials(b);
    expect(f.profit.toString()).toBe('5');
    expect(f.credit.toString()).toBe('90');
    expect(f.outstanding.toString()).toBe('0');
    b.transactions.push({
      id: '3',
      type: 'refund' as 'payment',
      amount: '90',
      date: '2026-10-03',
      note: 'refund',
    });
    expect(financials(b).cash.toString()).toBe('10');
  });
  it('rejects overpayment, unbacked refunds and negative adjusted charges', () => {
    const b = example();
    const t = { id: 't', type: 'payment' as const, amount: '1', date: '2026-10-01', note: 'test' };
    expect(() => validateTransaction(b, t)).toThrow('exceeds');
    expect(() => validateTransaction(b, { ...t, type: 'refund' })).toThrow('exceeds');
    expect(() => validateTransaction(b, { ...t, type: 'adjustment', amount: '-1' })).toThrow(
      'negative',
    );
  });
  it('neutralizes CSV spreadsheet formulas and quotes', () => {
    expect(csv([{ name: '=1+1', other: 'a"b' }])).toContain('"\'=1+1"');
    expect(csv([{ name: 'a"b' }])).toContain('"a""b"');
  });
});
describe('validation and separation', () => {
  it('rejects missing manual amounts, invalid dates and malformed routes', () => {
    expect(bookingSchema.safeParse(example()).success).toBe(true);
    for (const patch of [
      { agencyCost: '' },
      { customerCharged: 'NaN' },
      { agencyCost: '1.123' },
      { bookedOn: '2026-02-31' },
      { phone: 'x' },
    ])
      expect(bookingSchema.safeParse({ ...example(), ...patch }).success).toBe(false);
  });
  it('validates financial entries independently', () => {
    expect(
      transactionSchema.safeParse({
        type: 'payment',
        amount: '-1',
        date: '2026-10-01',
        note: 'test',
      }).success,
    ).toBe(false);
    expect(
      transactionSchema.safeParse({
        type: 'adjustment',
        amount: '0',
        costAdjustment: '-1',
        date: '2026-10-01',
        note: 'test',
      }).success,
    ).toBe(true);
  });

  it('warns about duplicates without treating PNR as a unique key', () => {
    const b = example();
    expect(duplicateBookings([b], b).length).toBe(1);
    expect(
      duplicateBookings([b], {
        ...b,
        customerName: 'Different',
        segments: [{ ...b.segments[0], departure: '2030-01-01T10:00' }],
      }),
    ).toHaveLength(0);
  });
});
describe('analytics and evaluated forecasting', () => {
  it('generates deterministic fictional records', () => {
    expect(demoBookings()).toEqual(demoBookings());
    expect(demoBookings().length).toBeGreaterThan(600);
  });
  it('groups cash by actual transaction date', () => {
    const b = {
      ...example(),
      bookedOn: '2026-01-01',
      transactions: [
        { id: 't', type: 'payment' as const, amount: '.3', date: '2026-03-01', note: 'receipt' },
      ],
    };
    expect(monthly([b], 'payment')[0].month).toBe('2026-03');
    expect(monthly([b])[0].month).toBe('2026-01');
  });
  it('fills missing months instead of dropping zero activity', () => {
    const b = example();
    expect(
      monthly([
        { ...b, bookedOn: '2026-01-01' },
        { ...b, bookedOn: '2026-03-01' },
      ]).map((m) => m.bookings),
    ).toEqual([1, 0, 1]);
  });
  it('computes explainable customer segments and flags', () => {
    const b = { ...example(), agencyCost: '100', customerCharged: '50' };
    expect(anomalies([b])[0].reasons).toContain('Negative gross profit');
    expect(customers([b], '2030-01-01')[0].segment).toBe('Inactive');
  });
  it('simulates cancellation and growth transparently', () => {
    const s = simulate(100, '100', '80', 10, 10);
    expect(s.volume.toString()).toBe('99');
    expect(s.profit.toString()).toBe('1980');
    expect(simulate(100, '100', '80', 100, 0).revenue.toString()).toBe('0');
  });
  it('withholds short-history forecasts and handles zeros', () => {
    expect(forecast(Array(17).fill(0))).toBeNull();
    expect(metrics([0, 0], [0, 0]).wape).toBeNull();
    expect(forecast(Array(30).fill(0))?.test.mae).toBe(0);
  });
  it('selects before the final holdout, avoiding future leakage', () => {
    const series = Array.from({ length: 36 }, (_, i) => i + 10);
    const a = forecast(series)!,
      b = forecast([...series.slice(0, -3), 10000, 20000, 30000])!;
    expect(a.scores).toEqual(b.scores);
    expect(a.test.mae).not.toBe(b.test.mae);
    expect(a.testOrigins).toBe(3);
    expect(predict([1, 2, 3], 'Naive')).toBe(3);
    expect(() => predict([1, 2], 'Seasonal naive')).toThrow();
  });
  it('keeps exact money until chart boundary', () =>
    expect(D('90071992547409.99').plus('.01').toString()).toBe('90071992547410'));
});
describe('conservative text parsing', () => {
  it('prefills the customer from passenger one and keeps email blank', () => {
    const result = parseTicket(
      'PNR: TEST01\nPassenger 1: First Fiction\nPassenger 2: Second Fiction\nAgency Phone: 0000099999\nCustomer Phone No: +91 00000 10001\nEmail: booking@example.invalid',
    );
    expect(customerDefaults(result)).toEqual({
      customerName: 'First Fiction',
      phone: '+91 00000 10001',
      email: '',
    });
  });
  it('accepts passenger contacts but never agent phone numbers', () => {
    expect(
      extractCustomerPhone('Agent Phone: 0000099999\nPassenger Contact Number - 0000010005'),
    ).toBe('0000010005');
    expect(extractCustomerPhone('Agency Phone: 0000099999\nPhone: 0000088888')).toBe('');
    expect(extractCustomerPhone('Customer Phone No: 12')).toBe('');
  });
  it('leaves customer details blank when no passenger/contact is identifiable', () => {
    const result = parseTicket(
      'Booking Reference: DEMO99\nAgent Ref: Staff Example\nPhone: 0000099999',
    );
    expect(customerDefaults(result)).toEqual({ customerName: '', phone: '', email: '' });
  });

  it('never extracts price fields', () => {
    const p = parseTicket(
      'PNR: ABC123\nPassenger: Test Person\nAgency Cost: 10000\nCustomer Charged: 15000\nTotal Fare: 99999',
    );
    expect(p).not.toHaveProperty('agencyCost');
    expect(p).not.toHaveProperty('customerCharged');
  });
  it('leaves ambiguous dates blank and ignores booking dates', () => {
    const p = parseTicket(
      'PNR: ABC123\nPassenger: Test Person\nBooking Date: 2026-10-01\nDeparture: 03/04/2026 10:00\nFrom: BOM\nTo: DEL',
    );
    expect(p.segments[0].departure).toBe('');
    expect(p.warnings.length).toBeGreaterThan(1);
  });
  it('handles multiple passengers and legs', () => {
    const p = parseTicket(
      'PNR: MULTI1\nPassenger 1: Test One\nPassenger 2: Test Two\nSegment 1:\nFrom: BOM\nTo: DXB\nDeparture: 2026-10-20 10:00\nSegment 2:\nFrom: DXB\nTo: BOM\nDeparture: 2026-10-25 15:00',
    );
    expect(p.passengers).toHaveLength(2);
    expect(p.segments).toHaveLength(2);
    expect(p.segments[1].departure).toBe('2026-10-25T15:00');
  });
  it('rejects scanned/empty or enormous content', () => {
    expect(() => parseTicket('')).toThrow('selectable');
    expect(() => parseTicket('x'.repeat(200001))).toThrow('Too much');
  });
});
