import { writeFileSync, mkdirSync } from 'node:fs';
import { demoBookings, DEMO_TODAY } from '../src/lib/demo';
import { monthly } from '../src/lib/analytics';
import { forecast } from '../src/lib/forecast';
const months = monthly(demoBookings()).filter((m) => m.month < DEMO_TODAY.slice(0, 7));
mkdirSync('data-science/data', { recursive: true });
writeFileSync(
  'data-science/data/synthetic-monthly.csv',
  'month,bookings,revenue,profit\n' +
    months
      .map((m) => `${m.month},${m.bookings},${m.revenue.toFixed(2)},${m.profit.toFixed(2)}`)
      .join('\n') +
    '\n',
);
mkdirSync('public/reports', { recursive: true });
const results = Object.fromEntries(
  (['bookings', 'revenue', 'profit'] as const).map((metric) => [
    metric,
    forecast(months.map((m) => m[metric])),
  ]),
);
writeFileSync(
  'public/reports/forecast-evaluation.json',
  JSON.stringify(
    {
      dataset: 'Reproducible fictional demo data only',
      asOf: DEMO_TODAY,
      completeMonths: months.length,
      results,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  'Exported 36 complete synthetic monthly observations and measured browser-model scores.',
);
