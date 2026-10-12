import type { Passenger, Segment } from '../model';
import { day } from '../validation';
import { agencyTableParser, flightCardParser } from './templates';
export type Extraction = {
  pnr: string;
  customerPhone: string;
  passengers: Passenger[];
  segments: Segment[];
  warnings: string[];
  parser: string;
  confidence: 'review required';
};
export interface TicketParser {
  id: string;
  matches: (text: string) => boolean;
  parse: (text: string) => Omit<Extraction, 'parser' | 'confidence' | 'customerPhone'>;
}
export function extractCustomerPhone(text: string) {
  // Only explicitly customer/passenger-labelled numbers are eligible. Generic Phone/Ph
  // and agent/agency contacts often appear first and must never become a customer number.
  const match = text.match(
    /\b(?:Customer|Passenger|Traveller|Traveler)\s+(?:Contact\s+)?(?:Phone(?:\s*(?:No\.?|Number))?|Contact(?:\s*(?:No\.?|Number))?|Mobile(?:\s*(?:No\.?|Number))?)\s*(?:[:#-]\s*)?([+()0-9][0-9 ()+-]{5,24})/i,
  );
  if (!match) return '';
  const value = match[1].trim().replace(/\s+/g, ' '),
    digits = value.replace(/\D/g, '');
  return digits.length >= 7 && digits.length <= 15 && value.length <= 20 ? value : '';
}
export function customerDefaults(result: Extraction) {
  return { customerName: result.passengers[0]?.name || '', phone: result.customerPhone, email: '' };
}
function labelled(text: string, labels: string) {
  return (
    text.match(new RegExp(`(?:^|\\n)\\s*(?:${labels})\\s*[:#]\\s*([^\\n]+)`, 'i'))?.[1]?.trim() ||
    ''
  );
}
function dateTime(text: string, label: string) {
  const v = labelled(text, label);
  return /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}$/.test(v) &&
    day.safeParse(v.slice(0, 10)).success &&
    Number(v.slice(11, 13)) < 24 &&
    Number(v.slice(14, 16)) < 60
    ? v.replace(' ', 'T')
    : '';
}
const generic: TicketParser = {
  id: 'labelled-ticket-v1',
  matches: () => true,
  parse(text) {
    const warnings = [
      'Verify every extracted field against the original ticket. Financial values must be entered manually.',
    ];
    const names = [
      ...text.matchAll(
        /(?:^|\n)\s*(?:Passenger(?:\s+\d+)?|Passenger Name|Traveller)\s*:\s*([^\n]+)/gi,
      ),
    ].map((m) => m[1].trim());
    const tickets = [...text.matchAll(/(?:^|\n)\s*Ticket(?: Number| No)?\s*:\s*([\d -]+)/gi)].map(
      (m) => m[1].trim(),
    );
    const chunks = text.split(/(?:^|\n)\s*(?:Segment|Flight Segment|Leg)\s*\d+\s*[:\n]/i).slice(1);
    const blocks = chunks.length ? chunks : [text];
    const segments = blocks
      .map((block) => ({
        airline: labelled(block, 'Airline|Carrier'),
        flightNumber: labelled(block, 'Flight|Flight Number|Flight No'),
        origin: labelled(block, 'Origin|From').match(/\b[A-Z]{3}\b/)?.[0] || '',
        destination: labelled(block, 'Destination|To').match(/\b[A-Z]{3}\b/)?.[0] || '',
        departure: dateTime(block, 'Departure|Departs'),
        arrival: dateTime(block, 'Arrival|Arrives'),
      }))
      .filter((s) => Object.values(s).some(Boolean));
    if (!segments.length)
      warnings.push('No supported flight layout found. Enter segments manually.');
    if (segments.some((s) => !s.departure))
      warnings.push(
        'Ambiguous or missing flight date/time left blank. Use the local time printed on the ticket.',
      );
    if (!names.length) warnings.push('Passenger names could not be identified.');
    const pnr =
      labelled(text, 'PNR|Booking Reference|Record Locator')
        .match(/^[A-Z0-9-]{4,20}$/i)?.[0]
        ?.toUpperCase() || '';
    if (!pnr) warnings.push('Booking reference not found.');
    return {
      pnr,
      passengers: names.map((name, i) => ({ name, ticketNumber: tickets[i] || '' })),
      segments,
      warnings,
    };
  },
};
// Layout adapters run before the conservative generic parser. They never receive financial field setters.
const parsers: TicketParser[] = [flightCardParser, agencyTableParser, generic];
export function parseTicket(text: string): Extraction {
  if (text.length > 200000) throw Error('Too much text in this document');
  if (text.trim().length < 20)
    throw Error('No selectable ticket text found. Scanned PDFs are not supported.');
  const normalized = text.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008]/g, '');
  const parser = parsers.find((p) => p.matches(normalized))!;
  return {
    ...parser.parse(normalized),
    customerPhone: extractCustomerPhone(normalized),
    parser: parser.id,
    confidence: 'review required',
  };
}
