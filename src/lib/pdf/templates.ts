import { day as validDay } from '../validation';
import type { TicketParser } from './parser';
import type { Passenger, Segment } from '../model';
const months: Record<string, string> = {
  jan: '01',
  feb: '02',
  mar: '03',
  apr: '04',
  may: '05',
  jun: '06',
  jul: '07',
  aug: '08',
  sep: '09',
  oct: '10',
  nov: '11',
  dec: '12',
};
// Only verified flight-prefix mappings; unknown carriers remain blank for manual review.
const airlines: Record<string, string> = { IX: 'Air India Express', '6E': 'IndiGo' };
const review = [
  'Verify every extracted field against the original ticket. Agency cost and customer charged must be entered manually.',
  'Airline names may be resolved from verified carrier codes. Flight times are local; time zones are not inferred.',
];
function namedDate(day: string, month: string, year: string, time: string) {
  const m = months[month.slice(0, 3).toLowerCase()];
  if (!m) return '';
  const date = `${year}-${m}-${day.padStart(2, '0')}`;
  if (
    !validDay.safeParse(date).success ||
    Number(time.slice(0, 2)) > 23 ||
    Number(time.slice(3, 5)) > 59
  )
    return '';
  return date + 'T' + time;
}
function pnr(text: string) {
  return text.match(/Airline\s+PNR\s*:?\s*\*?([A-Z0-9]{5,10})\*?/i)?.[1]?.toUpperCase() || '';
}
function routeCodes(text: string) {
  return [...text.matchAll(/\[\s*([A-Z]{3})\s*-\s*([A-Z]{3})\s*\]|\b([A-Z]{3})-([A-Z]{3})\b/g)]
    .map((m) => [m[1] || m[3], m[2] || m[4]])
    .filter((r, i, all) => all.findIndex((x) => x[0] === r[0] && x[1] === r[1]) === i);
}
function tablePassengers(text: string): Passenger[] {
  const section =
    text
      .split(/Passenger\s*Name/i)
      .at(-1)
      ?.split(/Fare Information/i)[0] || '';
  // Passenger names terminate at a passenger type. The lazy match allows wrapped names.
  return [
    ...section.matchAll(
      /\b(?:MR|MRS|MS|MISS|MSTR)\.?\s+([A-Z][A-Z\s./'-]*?)(?:\s*\(Onward\))?\s*(Adult|Child|Infant)\s*(\d{6,16})?/gi,
    ),
  ].map((m) => ({ name: m[1].replace(/\s+/g, ' ').trim(), ticketNumber: m[3] || '' }));
}
export const agencyTableParser: TicketParser = {
  id: 'agency-flight-table-v1',
  matches: (t) => /Dep\.?Date\s*&\s*Time/i.test(t) && /Airline\s+PNR/i.test(t),
  parse(text) {
    const flights = [
      ...text.matchAll(
        /(?:^|\n)\s*([A-Z0-9]{2})\s*[- ]\s*(\d{1,4})\s*\n([\s\S]*?)(?=\n\s*(?:[A-Z0-9]{2})\s*[- ]\s*\d{1,4}\s*\n|\n\s*Passenger|\n\s*Fare Information|$)/g,
      ),
    ];
    const codes = routeCodes(text),
      segments: Segment[] = flights.map((m, i) => {
        const dates = [...m[3].matchAll(/(\d{1,2})-([A-Za-z]{3})-(\d{4}),?\s*(\d{2}:\d{2})/g)];
        return {
          airline: airlines[m[1]] || '',
          flightNumber: m[1] + ' ' + m[2],
          origin: codes[i]?.[0] || '',
          destination: codes[i]?.[1] || '',
          departure: dates[0] ? namedDate(dates[0][1], dates[0][2], dates[0][3], dates[0][4]) : '',
          arrival: dates[1] ? namedDate(dates[1][1], dates[1][2], dates[1][3], dates[1][4]) : '',
        };
      });
    const warnings = [...review];
    if (codes.length !== segments.length)
      warnings.push(
        'Route code count differs from flight rows. Check every origin and destination.',
      );
    if (!segments.length)
      warnings.push('Flight rows could not be identified. Enter them manually.');
    return { pnr: pnr(text), passengers: tablePassengers(text), segments, warnings };
  },
};
export const flightCardParser: TicketParser = {
  id: 'agency-flight-cards-v1',
  matches: (t) => /Your\s+Flight/i.test(t) && /Operated by/i.test(t) && /Airline\s+PNR/i.test(t),
  parse(text) {
    const passengerSection =
      text.split(/Passengers\s+Ticket Numbers/i)[1]?.split(/Passenger Contact|Your Flight/i)[0] ||
      '';
    const passengers = [
      ...passengerSection.matchAll(
        /(?:Mr|Mrs|Ms|Miss|Mstr)\.?\s+([^\n]+?)\s*\((?:Adult|Child|Infant)\)\s*([^\s\n]+)?/gi,
      ),
    ].map((m) => ({ name: m[1].replace(/\s*\/\s*/g, ' ').trim(), ticketNumber: m[2] || '' }));
    const travel =
      text.split(/Your\s+Flight/i)[1]?.split(/Seat Reservations|RULES AND REGULATIONS/i)[0] || '';
    const legs = travel.split(/(?:Onward|Return)\s*-\s*/i).slice(1);
    const warnings = [...review];
    const segments = legs.map((block) => {
      const year = block.match(/\b\d{1,2}\s+[A-Za-z]{3}\s+(\d{4})\b/)?.[1] || '';
      const dates = [...block.matchAll(/([A-Za-z]{3})\s+(\d{1,2}),\s*(\d{2}:\d{2})/g)];
      const codes = [...block.matchAll(/(?:^|\n)\s*([A-Z]{3})\s*(?:\n|$)/g)].map((m) => m[1]);
      const flight = block.match(/Flight No\s+([A-Z0-9]{2})\s*(\d{1,4})/i);
      // If arrival crosses a year boundary the layout omits its year, so leave it for review.
      const departure =
        dates[0] && year ? namedDate(dates[0][2], dates[0][1], year, dates[0][3]) : '';
      let arrival = dates[1] && year ? namedDate(dates[1][2], dates[1][1], year, dates[1][3]) : '';
      if (
        dates[0] &&
        dates[1] &&
        Number(months[dates[1][1].toLowerCase()]) < Number(months[dates[0][1].toLowerCase()])
      ) {
        arrival = '';
        warnings.push('Arrival year is ambiguous; enter it manually.');
      }
      return {
        airline: block.match(/Operated by\s+([^\n]+?)\s*-\s*[A-Z0-9]{2}/i)?.[1]?.trim() || '',
        flightNumber: flight ? flight[1] + ' ' + flight[2] : '',
        origin: codes[0] || '',
        destination: codes[1] || '',
        departure,
        arrival,
      };
    });
    return { pnr: pnr(text), passengers, segments, warnings };
  },
};
