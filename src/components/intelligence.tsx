'use client';
import { useMemo, useState } from 'react';
import { Sparkles, Users, TrendingUp, Target, Info, ArrowUpRight } from 'lucide-react';
import type { Booking } from '@/lib/model';
import { monthly, customers, ranked, anomalies, simulate, totals } from '@/lib/analytics';
import { forecast } from '@/lib/forecast';
import { inr, D } from '@/lib/finance';
import { journeyLabel } from '@/lib/journey';
import { Card, Kpi, Badge, Empty, Field } from './ui';
import { Bars } from './charts';
export function Intelligence({
  bookings,
  today,
  onSelect,
}: {
  bookings: Booking[];
  today: string;
  onSelect: (b: Booking) => void;
}) {
  const cs = useMemo(() => customers(bookings, today), [bookings, today]),
    flags = useMemo(() => anomalies(bookings), [bookings]),
    routes = ranked(bookings, journeyLabel).sort((a, b) => b.profit.comparedTo(a.profit)),
    airlines = ranked(bookings, (b) => b.segments[0]?.airline || 'Unknown').sort((a, b) =>
      b.profit.comparedTo(a.profit),
    ),
    total = totals(bookings);
  const segments = ['High value', 'Regular', 'New & occasional', 'Inactive'].map((name) => ({
    name,
    value: cs.filter((c) => c.segment === name).reduce((s, c) => s + c.revenue.toNumber(), 0),
    count: cs.filter((c) => c.segment === name).length,
  }));
  const concentration = total.revenue.gt(0)
    ? (cs.slice(0, 5).reduce((s, c) => s + c.revenue.toNumber(), 0) / total.revenue.toNumber()) *
      100
    : 0;
  const margins = [
    { name: 'Negative', min: -Infinity, max: 0 },
    { name: '0–5%', min: 0, max: 5 },
    { name: '5–15%', min: 5, max: 15 },
    { name: '15–25%', min: 15, max: 25 },
    { name: '25%+', min: 25, max: Infinity },
  ].map((bin) => ({
    ...bin,
    value: bookings.filter((b) => {
      const f = totals([b]);
      return f.margin.gte(bin.min) && f.margin.lt(bin.max);
    }).length,
  }));
  return (
    <>
      <div className="intelligence-banner">
        <span className="spark">
          <Sparkles size={24} />
        </span>
        <div>
          <h3>More than numbers. Your next decision.</h3>
          <p>
            Explainable insights from {bookings.length} bookings. Every flag is a prompt for review.
          </p>
        </div>
        <Badge tone="mint">Live calculations</Badge>
      </div>
      <div className="kpi-grid">
        <Kpi
          label="Repeat customer rate"
          value={
            (cs.length ? (cs.filter((c) => c.bookings > 1).length / cs.length) * 100 : 0).toFixed(
              1,
            ) + '%'
          }
          sub="Customers with 2+ bookings"
          icon={<Users size={18} />}
        />
        <Kpi
          label="Average gross profit"
          value={inr(total.bookings ? total.profit.div(total.bookings) : 0)}
          sub="Per booking, after adjustments"
          icon={<TrendingUp size={18} />}
        />
        <Kpi
          label="Top 5 concentration"
          value={concentration.toFixed(1) + '%'}
          sub="Share of customer revenue"
          icon={<Target size={18} />}
        />
        <Kpi
          label="Records to review"
          value={String(flags.length)}
          sub="Explainable statistical flags"
          icon={<Info size={18} />}
          accent
        />
      </div>
      <div className="two-columns">
        <Card title="Who keeps you moving?" subtitle="RFM groups · revenue contribution">
          <Bars data={segments} />
          <div className="segment-legend">
            {segments.map((s) => (
              <span key={s.name}>
                <b>{s.count}</b>
                {s.name}
              </span>
            ))}
          </div>
        </Card>
        <Card title="Your most profitable routes" subtitle="Gross profit after adjustments">
          <div className="rank-list">
            {routes.slice(0, 5).map((r, i) => (
              <div key={r.name}>
                <span className="rank-number">0{i + 1}</span>
                <div>
                  <strong>{r.name}</strong>
                  <small>
                    {r.bookings} bookings · {r.margin.toFixed(1)}% margin
                  </small>
                </div>
                <b>{inr(r.profit)}</b>
              </div>
            ))}
            {!routes.length && <Empty />}
          </div>
        </Card>
      </div>
      <div className="two-columns">
        <Card title="Airline profitability" subtitle="Top airlines by total gross profit">
          <div className="rank-list">
            {airlines.slice(0, 5).map((a) => (
              <div key={a.name}>
                <span className="airline-icon">↗</span>
                <div>
                  <strong>{a.name}</strong>
                  <small>{a.bookings} bookings</small>
                </div>
                <b>{inr(a.profit)}</b>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Margin distribution" subtitle="Number of bookings in each gross-margin band">
          <Bars data={margins} keys={[{ key: 'value', name: 'Bookings', color: '#28a993' }]} />
        </Card>
      </div>
      <Card
        title="A second look"
        subtitle="Negative or low margins, unusually high charges, duplicate references and route-cost changes"
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Booking</th>
                <th>Customer</th>
                <th>Reason for review</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {flags.slice(0, 30).map(({ booking: b, reasons }) => (
                <tr key={b.id}>
                  <td>{b.pnr || b.id.slice(0, 8)}</td>
                  <td>{b.customerName}</td>
                  <td>{reasons.join(' · ')}</td>
                  <td>
                    <button
                      className="icon-button"
                      aria-label={`Review ${b.pnr}`}
                      onClick={() => onSelect(b)}
                    >
                      <ArrowUpRight size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!flags.length && <Empty text="No records meet the current anomaly rules." />}
        </div>
        {flags.length > 30 && (
          <p className="footnote">Showing the first 30 of {flags.length} flagged records.</p>
        )}
      </Card>
      <p className="footnote">
        RFM: inactive after 180 days; high value with 5+ bookings and ₹1 lakh revenue; regular with
        3+ bookings. Descriptive rules, not a trained clustering model. Robust outliers require 20
        records; route-cost rules require 10 earlier comparable bookings.
      </p>
    </>
  );
}
export function Forecasting({ bookings, today }: { bookings: Booking[]; today: string }) {
  const [metric, setMetric] = useState<'revenue' | 'profit' | 'bookings'>('revenue');
  const months = monthly(bookings).filter((m) => m.month < today.slice(0, 7));
  // Include zero-activity complete months after the last booking; never use the partial current month.
  if (months.length) {
    const cursor = new Date(months.at(-1)!.month + '-01T00:00:00Z');
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    while (cursor.toISOString().slice(0, 7) < today.slice(0, 7)) {
      const month = cursor.toISOString().slice(0, 7);
      months.push({ month, label: month, revenue: 0, cost: 0, profit: 0, bookings: 0 });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
  }
  const activeMonths = months.filter((m) => m.bookings > 0).length;
  const bookingCount = months.reduce((n, m) => n + m.bookings, 0);
  const result =
    activeMonths >= 12 && bookingCount >= 36 ? forecast(months.map((m) => m[metric])) : null;
  const display = (n: number) => (metric === 'bookings' ? n.toFixed(1) : inr(n));
  return (
    <>
      <div className="intelligence-banner">
        <span className="spark">
          <TrendingUp size={24} />
        </span>
        <div>
          <h3>A measured look ahead.</h3>
          <p>Monthly booking-date totals. Complete calendar months only.</p>
        </div>
        <select
          aria-label="Forecast metric"
          value={metric}
          onChange={(e) => setMetric(e.target.value as typeof metric)}
        >
          <option value="revenue">Revenue</option>
          <option value="profit">Gross profit</option>
          <option value="bookings">Bookings</option>
        </select>
      </div>
      {!result ? (
        <Card>
          <Empty
            text={`Forecasts require 18 complete months, 12 months with activity and 36 bookings. Current history: ${months.length} complete months, ${activeMonths} active months and ${bookingCount} bookings.`}
          />
        </Card>
      ) : (
        <>
          <div className="kpi-grid">
            <Kpi
              label="Selected method"
              value={result.method}
              sub={`${result.validationOrigins} rolling validation origins`}
              icon={<Sparkles size={18} />}
            />
            <Kpi
              label="Holdout MAE"
              value={display(result.test.mae)}
              sub="Average absolute error · last 3 months"
              icon={<Target size={18} />}
            />
            <Kpi
              label="Holdout RMSE"
              value={display(result.test.rmse)}
              sub="Larger errors receive greater weight"
              icon={<TrendingUp size={18} />}
            />
            <Kpi
              label="Holdout WAPE"
              value={result.test.wape === null ? 'Not defined' : result.test.wape.toFixed(1) + '%'}
              sub="Zero totals handled explicitly"
              icon={<Info size={18} />}
              accent
            />
          </div>
          <div className="two-columns">
            <Card
              title="Three months ahead"
              subtitle={`${result.trainingMonths} months of history · point estimates`}
            >
              <Bars
                data={result.future.map((value, i) => {
                  const d = new Date(today.slice(0, 7) + '-01T00:00:00Z');
                  d.setUTCMonth(d.getUTCMonth() + i);
                  return {
                    name: d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
                    value: Number(value.toFixed(2)),
                  };
                })}
                keys={[{ key: 'value', name: 'Projected ' + metric, color: '#697cf0' }]}
              />
            </Card>
            <Card title="Method comparison" subtitle="Validation scores used for model selection">
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Method</th>
                      <th>MAE</th>
                      <th>RMSE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.scores.map((s) => (
                      <tr key={s.method}>
                        <td>
                          {s.method}
                          {s.method === result.method && <Badge tone="mint">Selected</Badge>}
                        </td>
                        <td>{display(s.mae)}</td>
                        <td>{display(s.rmse)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="footnote">
                Models see only earlier months at each evaluation origin. The final three months are
                reserved for evaluation after method selection.
              </p>
            </Card>
          </div>
          <div className="notice">
            <Info size={18} />
            <div>
              No uncertainty interval is shown: three holdout observations are too few to validate
              interval coverage. These baselines support planning; they do not account for changing
              prices, holidays or external shocks. Seasonal naive becomes eligible only with 24
              months at every validation origin.
            </div>
          </div>
        </>
      )}
    </>
  );
}
export function Simulator() {
  const [count, setCount] = useState(100),
    [charge, setCharge] = useState('25000'),
    [cost, setCost] = useState('21000'),
    [cancel, setCancel] = useState(5),
    [growth, setGrowth] = useState(10);
  const safeCharge = charge && Number(charge) >= 0 ? charge : '0',
    safeCost = cost && Number(cost) >= 0 ? cost : '0';
  const projection = simulate(count, safeCharge, safeCost, cancel, growth),
    base = simulate(count, safeCharge, safeCost, 0, 0);
  return (
    <>
      <div className="intelligence-banner">
        <span className="spark">
          <Sparkles size={24} />
        </span>
        <div>
          <h3>Small changes. See the bigger picture.</h3>
          <p>Explore a monthly scenario before making a business decision.</p>
        </div>
        <Badge tone="amber">Simulation, not a forecast</Badge>
      </div>
      <div className="simulator-layout">
        <Card title="Build your scenario" subtitle="Adjust the assumptions below">
          <div className="sim-controls">
            <Field label={`Expected monthly bookings · ${count}`}>
              <input
                type="range"
                min="0"
                max="1000"
                step="5"
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
              />
            </Field>
            <Field label="Average customer charge (₹)">
              <input
                type="number"
                min="0"
                max="999999999"
                step="0.01"
                value={charge}
                onChange={(e) => setCharge(e.target.value)}
              />
            </Field>
            <Field label="Average agency cost (₹)">
              <input
                type="number"
                min="0"
                max="999999999"
                step="0.01"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
              />
            </Field>
            <Field label="Average gross profit per booking (₹)">
              <input
                type="number"
                step="0.01"
                value={D(safeCharge).minus(safeCost).toFixed(2)}
                onChange={(e) => {
                  const profit = Number(e.target.value);
                  if (Number.isFinite(profit) && profit <= Number(safeCharge))
                    setCost(D(safeCharge).minus(profit).toFixed(2));
                }}
              />
            </Field>
            <Field label={`Expected cancellation rate · ${cancel}%`}>
              <input
                type="range"
                min="0"
                max="100"
                value={cancel}
                onChange={(e) => setCancel(Number(e.target.value))}
              />
            </Field>
            <Field label={`Expected growth rate · ${growth}%`}>
              <input
                type="range"
                min="-100"
                max="100"
                value={growth}
                onChange={(e) => setGrowth(Number(e.target.value))}
              />
            </Field>
            <button
              onClick={() => {
                setCount(100);
                setCharge('25000');
                setCost('21000');
                setCancel(5);
                setGrowth(10);
              }}
            >
              Reset assumptions
            </button>
          </div>
        </Card>
        <div>
          <div className="kpi-grid two">
            <Kpi
              label="Projected revenue"
              value={inr(projection.revenue)}
              sub={`${projection.volume.toFixed(1)} expected fulfilled bookings`}
              icon={<TrendingUp size={18} />}
            />
            <Kpi
              label="Projected gross profit"
              value={inr(projection.profit)}
              sub="Before operating expenses and taxes"
              icon={<Target size={18} />}
              accent
            />
          </div>
          <Card title="Baseline vs your scenario" subtitle="Monthly revenue and gross profit">
            <Bars
              data={[
                {
                  name: 'Baseline',
                  revenue: base.revenue.toNumber(),
                  profit: base.profit.toNumber(),
                },
                {
                  name: 'Your scenario',
                  revenue: projection.revenue.toNumber(),
                  profit: projection.profit.toNumber(),
                },
              ]}
              keys={[
                { key: 'revenue', name: 'Revenue', color: '#627aed' },
                { key: 'profit', name: 'Gross profit', color: '#28aa92' },
              ]}
            />
          </Card>
          <p className="footnote">
            Fulfilled bookings = volume × (1 + growth) × (1 − cancellation rate). This simplified
            scenario assumes cancellations incur no revenue or costs. Fractional bookings represent
            an expectation, not actual transactions.
          </p>
        </div>
      </div>
    </>
  );
}
