import { describe, it, expect } from 'vitest';
import { journeyRoute, journeyLabel } from '@/lib/journey';
import type { Segment } from '@/lib/model';
const leg = (origin: string, destination: string): Segment => ({
  origin,
  destination,
  airline: 'Example Air',
  flightNumber: 'EX 1',
  departure: '2026-10-20T13:15',
  arrival: '',
});
describe('whole-journey summaries', () => {
  it('shows the final destination and preserves the connecting airport', () => {
    const booking = { segments: [leg('TRV', 'BLR'), leg('BLR', 'MAA')] };
    expect(journeyRoute(booking)).toEqual({
      origin: 'TRV',
      destination: 'MAA',
      via: ['BLR'],
      hasMoreJourneys: false,
    });
    expect(journeyLabel(booking)).toBe('TRV → MAA');
    expect(booking.segments).toHaveLength(2);
  });
  it('handles direct flights, three connected legs and an empty booking', () => {
    expect(journeyRoute({ segments: [leg('TRV', 'MAA')] }).via).toEqual([]);
    expect(
      journeyRoute({ segments: [leg('TRV', 'BLR'), leg('BLR', 'MAA'), leg('MAA', 'SIN')] })
        .destination,
    ).toBe('SIN');
    expect(journeyLabel({ segments: [] })).toBe('— → —');
  });
  it('keeps the outward destination for a return itinerary', () => {
    expect(
      journeyRoute({
        segments: [leg('TRV', 'BLR'), leg('BLR', 'MAA'), leg('MAA', 'BLR'), leg('BLR', 'TRV')],
      }),
    ).toEqual({ origin: 'TRV', destination: 'MAA', via: ['BLR'], hasMoreJourneys: true });
  });
  it('does not merge disconnected journeys into an invented route', () => {
    expect(journeyRoute({ segments: [leg('TRV', 'MAA'), leg('BOM', 'DXB')] }).destination).toBe(
      'MAA',
    );
  });
});
