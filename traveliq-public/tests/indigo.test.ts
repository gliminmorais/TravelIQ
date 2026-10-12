import { describe, it, expect } from 'vitest';
import { parseTicket, customerDefaults } from '@/lib/pdf/parser';
const ticket = `Passenger Information
MRS MAYA EXAMPLE Adult
MSTR ARJUN EXAMPLE Child
MISS TARA EXAMPLE Child
Sector Seat Services Purchased
BOM - DXB - -
Departing
Check-in/Bag drop closes: 00:05 hrs
BOM - Mumbai International Airport
(Terminal 2)
01:20, 15 Nov 2026
DXB - Dubai International Airport
03:55, 15 Nov 2026
PNR / Booking Ref DEMO06 Confirmed Payment status Complete
6E 1234 . A320
Baggage Information
Customer Charged: 99999
Agency Phone: 0000011111`;
describe('IndiGo passenger itinerary', () => {
  it('reads content-stream order, three passengers and airport-local times', () => {
    const result = parseTicket(ticket);
    expect(result.parser).toBe('indigo-itinerary-v1');
    expect(result.pnr).toBe('DEMO06');
    expect(result.passengers.map((p) => p.name)).toEqual([
      'MAYA EXAMPLE',
      'ARJUN EXAMPLE',
      'TARA EXAMPLE',
    ]);
    expect(result.segments).toEqual([
      {
        airline: 'IndiGo',
        flightNumber: '6E 1234',
        origin: 'BOM',
        destination: 'DXB',
        departure: '2026-11-15T01:20',
        arrival: '2026-11-15T03:55',
      },
    ]);
    expect(customerDefaults(result)).toEqual({
      customerName: 'MAYA EXAMPLE',
      phone: '',
      email: '',
    });
    expect(result).not.toHaveProperty('customerCharged');
    expect(result).not.toHaveProperty('agencyCost');
  });
  it('prefills an explicitly labelled customer number while leaving email blank', () => {
    expect(
      customerDefaults(
        parseTicket(ticket + '\nPassenger Contact: 0000012345\nEmail: example@example.test'),
      ),
    ).toEqual({ customerName: 'MAYA EXAMPLE', phone: '0000012345', email: '' });
  });
  it('leaves mismatched flight columns blank for review', () => {
    const result = parseTicket(ticket.replace('03:55, 15 Nov 2026', ''));
    expect(result.segments[0].departure).toBe('');
    expect(result.segments[0].destination).toBe('');
    expect(result.warnings.join(' ')).toContain('ambiguous');
  });
});
