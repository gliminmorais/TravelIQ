import type { Booking } from './model';
export const DEMO_TODAY = '2026-10-12';
export function demoBookings(): Booking[] {
  let seed = 4271;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const names = [
    'Aarav Mehta',
    'Diya Kapoor',
    'Ishaan Rao',
    'Mira Shah',
    'Kabir Sen',
    'Ananya Roy',
    'Rohan Patel',
    'Tara Menon',
    'Vihaan Das',
    'Sana Verma',
    'Arjun Nair',
    'Neha Joshi',
    'Dev Malhotra',
    'Riya Bose',
    'Aditya Jain',
    'Priya Iyer',
    'Kiran Bhat',
    'Nisha Sethi',
    'Ayaan Khan',
    'Leela Sharma',
    'Samir Dutt',
    'Alia George',
    'Nikhil Paul',
    'Zoya Anand',
  ];
  const routes = [
    ['BOM', 'DXB', 'Emirates', 'EK 507'],
    ['DEL', 'SIN', 'Singapore Airlines', 'SQ 403'],
    ['BLR', 'GOI', 'IndiGo', '6E 621'],
    ['BOM', 'DEL', 'Air India', 'AI 806'],
    ['DEL', 'BKK', 'Thai Airways', 'TG 316'],
    ['MAA', 'CMB', 'SriLankan Airlines', 'UL 122'],
    ['BLR', 'LHR', 'British Airways', 'BA 118'],
  ];
  const output: Booking[] = [];
  for (let m = 0; m < 37; m++) {
    const month = new Date(Date.UTC(2023, 9 + m, 1)),
      count = m === 36 ? 12 : 14 + Math.floor(random() * 9) + Math.floor(m / 7);
    for (let j = 0; j < count; j++) {
      const person = Math.floor(random() * names.length),
        route = routes[Math.floor(random() * routes.length)],
        day = m === 36 ? 1 + j : 1 + Math.floor(random() * 27),
        bookedOn = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), day))
          .toISOString()
          .slice(0, 10);
      const dep =
        new Date(Date.parse(bookedOn) + 86400000 * (12 + Math.floor(random() * 35)))
          .toISOString()
          .slice(0, 10) + 'T09:30';
      const charged = Math.round(
          (route[1] === 'LHR' ? 65000 : route[1] === 'GOI' ? 6000 : 15000) + random() * 18000,
        ),
        cost = Math.round(charged * (0.78 + random() * 0.17));
      const n = output.length + 1,
        id = '00000000-0000-4000-8000-' + String(n).padStart(12, '0'),
        cancelled = n % 23 === 0;
      const b: Booking = {
        id,
        customerId: 'fictional-' + person,
        customerName: names[person],
        phone: '+91 00000 ' + String(person).padStart(5, '0'),
        email: 'traveller' + person + '@example.invalid',
        pnr: 'TQ' + String(1000 + n),
        bookedOn,
        status: cancelled ? 'cancelled' : n % 13 === 0 ? 'pending' : 'confirmed',
        currency: 'INR',
        agencyCost: String(n % 67 === 0 ? charged + 1000 : cost) + '.00',
        customerCharged: charged + '.00',
        passengers: [{ name: names[person], ticketNumber: '' }],
        segments: [
          {
            airline: route[2],
            flightNumber: route[3],
            origin: route[0],
            destination: route[1],
            departure: dep,
            arrival: '',
          },
        ],
        transactions: [],
        archived: false,
        version: 1,
        createdAt: bookedOn + 'T10:00:00Z',
      };
      const paid = n % 9 === 0 ? 0 : n % 7 === 0 ? Math.floor(charged / 2) : charged;
      if (paid)
        b.transactions.push({
          id: id + '-p',
          type: 'payment',
          amount: paid + '.00',
          date: bookedOn,
          note: 'Fictional sample receipt',
        });
      if (cancelled) {
        b.transactions.push({
          id: id + '-a',
          type: 'adjustment',
          amount: String(-charged + 2000) + '.00',
          costAdjustment: String(-Number(b.agencyCost) + 1500) + '.00',
          date: bookedOn,
          note: 'Fictional cancellation: retain service fee',
        });
        if (paid > 2000)
          b.transactions.push({
            id: id + '-r',
            type: 'refund',
            amount: String(paid - 2000) + '.00',
            date: bookedOn,
            note: 'Fictional customer refund',
          });
      }
      output.push(b);
    }
  }
  return output;
}
