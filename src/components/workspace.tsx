'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Plane,
  LayoutDashboard,
  Ticket,
  Users,
  Wallet,
  ChartNoAxesCombined,
  TrendingUp,
  SlidersHorizontal,
  Files,
  Settings,
  Search,
  Plus,
  Upload,
  ArrowUpRight,
  ArrowRight,
  Download,
  CalendarDays,
  ChevronDown,
  Sun,
  Moon,
  Menu,
  LogOut,
  ShieldCheck,
  Sparkles,
  RotateCcw,
  IndianRupee,
  Clock,
  Check,
  FileText,
  Archive,
  Mail,
  Phone,
} from 'lucide-react';
import { Toaster, toast } from 'sonner';
import type { Booking, Viewer, DocumentRecord, Transaction } from '@/lib/model';
import type { BookingInput } from '@/lib/validation';
import { transactionSchema } from '@/lib/validation';
import type { Mode } from '@/lib/config';
import { demoBookings, DEMO_TODAY } from '@/lib/demo';
import { financials, inr, csv, D, validateTransaction } from '@/lib/finance';
import { totals, monthly, ranked, customers } from '@/lib/analytics';
import { BookingForm } from './booking-form';
import { Card, Kpi, Badge, Modal, Field, Empty } from './ui';
import { TrendChart } from './charts';
import { Intelligence, Forecasting, Simulator } from './intelligence';
const navigation = [
  { id: 'dashboard', label: 'Overview', icon: LayoutDashboard },
  { id: 'bookings', label: 'Bookings', icon: Ticket },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'financials', label: 'Financials', icon: Wallet },
  { id: 'analytics', label: 'Analytics & insights', icon: ChartNoAxesCombined },
  { id: 'forecasting', label: 'Forecasting', icon: TrendingUp },
  { id: 'simulator', label: 'What-if simulator', icon: SlidersHorizontal },
  { id: 'documents', label: 'Documents', icon: Files },
  { id: 'settings', label: 'Settings', icon: Settings },
];
const titles: Record<string, [string, string]> = {
  dashboard: [
    'Your business, in focus.',
    'A clear view of your agency. A confident start to your day.',
  ],
  bookings: ['Every journey starts here.', 'Manage the details. Keep your travellers moving.'],
  customers: ['Know your travellers.', 'Build lasting relationships, one journey at a time.'],
  financials: [
    'A healthier bottom line.',
    'Track charges, costs, receipts and refunds with confidence.',
  ],
  analytics: [
    'Find the story in your data.',
    'Understand what works, what changes and where to look next.',
  ],
  forecasting: ['Plan your next chapter.', 'Evaluated baselines. Transparent assumptions.'],
  simulator: ['What if you could see ahead?', 'Turn a business idea into a measurable scenario.'],
  documents: [
    'All the details, together.',
    'Review tickets and keep supporting documents with their bookings.',
  ],
  settings: ['Make this workspace yours.', 'Appearance, data controls and agency access.'],
};
const storeKey = 'traveliq-demo-v1';
async function api(path: string, method = 'GET', body?: unknown) {
  const r = await fetch(path, {
    method,
    headers:
      body instanceof FormData
        ? undefined
        : body
          ? { 'Content-Type': 'application/json' }
          : undefined,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const data = await r.json();
  if (!r.ok) throw Error(data.error || 'Request failed');
  return data;
}
function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' })),
    a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function dateLabel(v: string) {
  return new Date(v.slice(0, 10) + 'T12:00:00Z').toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
export function Workspace({ mode, viewer }: { mode: Mode; viewer: Viewer }) {
  const router = useRouter();
  const demo = mode === 'demo',
    today = demo
      ? DEMO_TODAY
      : new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const [view, setView] = useState('dashboard'),
    [bookings, setBookings] = useState<Booking[]>([]),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(''),
    [dark, setDark] = useState(false),
    [mobile, setMobile] = useState(false),
    [query, setQuery] = useState(''),
    [start, setStart] = useState(today.slice(0, 4) + '-01-01'),
    [end, setEnd] = useState(''),
    [status, setStatus] = useState('all'),
    [airline, setAirline] = useState('all'),
    [destination, setDestination] = useState('all'),
    [basis, setBasis] = useState<'booking' | 'departure'>('booking'),
    [filterOpen, setFilterOpen] = useState(false),
    [form, setForm] = useState<{ existing?: Booking; upload: boolean } | null>(null),
    [selected, setSelected] = useState<string | null>(null),
    [payment, setPayment] = useState<Booking | null>(null),
    [customer, setCustomer] = useState<string | null>(null),
    [confirm, setConfirm] = useState<'reset' | 'archive' | null>(null),
    [documents, setDocuments] = useState<DocumentRecord[]>([]),
    [sort, setSort] = useState('date'),
    [page, setPage] = useState(1),
    [audit, setAudit] = useState<
      { id: string; action: string; recordId: string; createdAt: string }[]
    >([]),
    [saving, setSaving] = useState(false);
  const navigate = (id: string) => {
    setView(id);
    setSort('date');
    setPage(1);
    setMobile(false);
    history.replaceState(null, '', '?view=' + id);
  };
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      if (demo) {
        const saved = localStorage.getItem(storeKey);
        let value: Booking[];
        try {
          value = saved ? JSON.parse(saved) : demoBookings();
          if (!Array.isArray(value)) throw Error();
        } catch {
          value = demoBookings();
          toast.info('The demo was reset because its saved data could not be read.');
        }
        setBookings(value);
      } else {
        let cursor: string | null = null;
        const all: Booking[] = [];
        do {
          const data = await api('/api/bookings' + (cursor ? '?cursor=' + cursor : ''));
          all.push(...data.bookings);
          cursor = data.nextCursor;
        } while (cursor);
        setBookings(all);
        setDocuments(await api('/api/documents'));
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load records');
    } finally {
      setLoading(false);
    }
  }, [demo]);
  useEffect(() => {
    const v = new URLSearchParams(location.search).get('view');
    if (v && navigation.some((n) => n.id === v)) setView(v);
    setDark(localStorage.getItem('traveliq-theme') === 'dark');
    void load();
  }, [load]);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    localStorage.setItem('traveliq-theme', dark ? 'dark' : 'light');
  }, [dark]);
  function persist(next: Booking[]) {
    if (demo) localStorage.setItem(storeKey, JSON.stringify(next));
    setBookings(next);
  }
  const current = selected ? bookings.find((b) => b.id === selected) : undefined;
  const filtered = useMemo(
    () =>
      bookings.filter((b) => {
        const day = basis === 'booking' ? b.bookedOn : b.segments[0]?.departure.slice(0, 10) || '';
        return (
          (!start || day >= start) &&
          (!end || day <= end) &&
          (status === 'all' || b.status === status) &&
          (airline === 'all' || b.segments.some((s) => s.airline === airline)) &&
          (destination === 'all' || b.segments.some((s) => s.destination === destination)) &&
          (!query ||
            [
              b.customerName,
              b.pnr,
              b.id,
              ...b.segments.flatMap((s) => [s.airline, s.origin, s.destination, s.flightNumber]),
            ]
              .join(' ')
              .toLowerCase()
              .includes(query.toLowerCase()))
        );
      }),
    [bookings, basis, start, end, status, airline, destination, query],
  );
  const active = filtered.filter((b) => !b.archived),
    summary = totals(filtered),
    trend = monthly(filtered, basis).slice(-12),
    destinations = ranked(filtered, (b) => b.segments[0]?.destination || '—').sort(
      (a, b) => b.bookings - a.bookings,
    ),
    allCustomers = customers(bookings, today),
    visibleCustomers = customers(filtered, today),
    upcoming = bookings
      .filter(
        (b) =>
          !b.archived &&
          b.status === 'confirmed' &&
          b.segments.some((s) => s.departure.slice(0, 10) >= today),
      )
      .sort((a, b) => a.segments[0].departure.localeCompare(b.segments[0].departure));
  const sorted = [...active].sort((a, b) =>
    sort === 'name'
      ? a.customerName.localeCompare(b.customerName)
      : sort === 'revenue'
        ? financials(b).revenue.comparedTo(financials(a).revenue)
        : sort === 'departure'
          ? (a.segments[0]?.departure || '').localeCompare(b.segments[0]?.departure || '')
          : b.bookedOn.localeCompare(a.bookedOn),
  );
  async function save(data: BookingInput, id?: string, file?: File) {
    let saved: Booking;
    if (demo) {
      const old = id ? bookings.find((b) => b.id === id) : undefined,
        match = bookings.find(
          (b) =>
            b.customerName.trim().toLowerCase() === data.customerName.trim().toLowerCase() &&
            b.phone.replace(/\D/g, '') === data.phone.replace(/\D/g, ''),
        );
      saved = {
        ...data,
        id: id || crypto.randomUUID(),
        customerId: match?.customerId || crypto.randomUUID(),
        agencyCost: D(data.agencyCost).toFixed(2),
        customerCharged: D(data.customerCharged).toFixed(2),
        transactions: old?.transactions || [],
        archived: false,
        version: (old?.version || 0) + 1,
        createdAt: old?.createdAt || new Date().toISOString(),
      };
    } else
      saved = await api(id ? '/api/bookings/' + id : '/api/bookings', id ? 'PUT' : 'POST', data);
    persist(id ? bookings.map((b) => (b.id === id ? saved : b)) : [...bookings, saved]);
    toast.success(id ? 'Booking updated' : 'Booking created');
    if (file) {
      if (demo) toast.info('Demo PDFs are temporary and are not uploaded.');
      else {
        try {
          const body = new FormData();
          body.set('bookingId', saved.id);
          body.set('file', file);
          await api('/api/documents', 'POST', body);
          setDocuments(await api('/api/documents'));
        } catch {
          toast.error('Booking saved, but the PDF was not retained. Retry from Documents.');
        }
      }
    }
  }
  function exportRows() {
    download(
      'traveliq-bookings.csv',
      csv(
        filtered.map((b) => {
          const f = financials(b);
          return {
            booking_id: b.id,
            customer: b.customerName,
            pnr: b.pnr,
            booked_on: b.bookedOn,
            departure: b.segments[0]?.departure,
            airline: b.segments[0]?.airline,
            destination: b.segments[0]?.destination,
            status: b.status,
            currency: b.currency,
            original_charge: b.customerCharged,
            original_cost: b.agencyCost,
            adjusted_revenue: f.revenue.toFixed(2),
            adjusted_cost: f.cost.toFixed(2),
            gross_profit: f.profit.toFixed(2),
            gross_margin: f.margin.toFixed(2),
            payments: f.paid.toFixed(2),
            refunds: f.refunds.toFixed(2),
            outstanding: f.outstanding.toFixed(2),
            customer_credit: f.credit.toFixed(2),
            archived: b.archived,
          };
        }),
      ),
    );
    toast.success('Booking report downloaded');
  }
  async function transact(t: Omit<Transaction, 'id'>) {
    if (!payment) return;
    const next = {
      ...payment,
      transactions: [...payment.transactions, { ...t, id: crypto.randomUUID() }],
      version: payment.version + 1,
    };
    validateTransaction(payment, next.transactions.at(-1)!);
    const updated = demo ? next : await api(`/api/bookings/${payment.id}/transactions`, 'POST', t);
    persist(bookings.map((b) => (b.id === payment.id ? updated : b)));
    setPayment(null);
    toast.success('Financial transaction recorded');
  }
  async function confirmAction() {
    setSaving(true);
    try {
      if (confirm === 'reset') {
        localStorage.removeItem(storeKey);
        setBookings(demoBookings());
        setDocuments([]);
        toast.success('Your fictional demo data has been reset');
      } else if (current) {
        if (!financials(current).balance.isZero())
          throw Error('Settle the balance or customer credit before archiving.');
        if (!demo) await api('/api/bookings/' + current.id, 'DELETE');
        persist(bookings.map((b) => (b.id === current.id ? { ...b, archived: true } : b)));
        setSelected(null);
        toast.success('Booking archived. Financial history is retained.');
      }
      setConfirm(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Unable to complete action');
    } finally {
      setSaving(false);
    }
  }
  const bookingTable = (rows: Booking[], compact = false) => (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>
              <button className="table-sort" onClick={() => setSort('name')}>
                Traveller
              </button>
            </th>
            <th>Route / airline</th>
            <th>
              <button className="table-sort" onClick={() => setSort('departure')}>
                Departure
              </button>
            </th>
            <th>
              <button className="table-sort" onClick={() => setSort('revenue')}>
                Customer charged
              </button>
            </th>
            {!compact && <th>Gross profit</th>}
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((b) => {
            const f = financials(b),
              s = b.segments[0];
            return (
              <tr key={b.id}>
                <td>
                  <div className="person-cell">
                    <span className={'avatar avatar-' + (b.customerName.length % 4)}>
                      {b.customerName
                        .split(' ')
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join('')}
                    </span>
                    <div>
                      <button className="table-link" onClick={() => setSelected(b.id)}>
                        {b.customerName}
                      </button>
                      <small>
                        {b.pnr || b.id.slice(0, 8)} · {b.passengers.length} traveller
                        {b.passengers.length > 1 ? 's' : ''}
                      </small>
                    </div>
                  </div>
                </td>
                <td>
                  <strong>
                    {s?.origin} <span className="route-arrow">→</span> {s?.destination}
                  </strong>
                  <small>
                    {s?.airline}
                    {b.segments.length > 1 ? ` · +${b.segments.length - 1} leg` : ''}
                  </small>
                </td>
                <td>
                  {s ? dateLabel(s.departure) : '—'}
                  <small>{s?.departure.slice(11)} local</small>
                </td>
                <td className="money">
                  {inr(f.revenue)}
                  <small>{f.paymentStatus}</small>
                </td>
                {!compact && (
                  <td className={f.profit.lt(0) ? 'negative' : 'positive'}>
                    {inr(f.profit)}
                    <small>{f.margin.toFixed(1)}% margin</small>
                  </td>
                )}
                <td>
                  <Badge
                    tone={
                      b.status === 'confirmed'
                        ? 'mint'
                        : b.status === 'pending'
                          ? 'amber'
                          : 'neutral'
                    }
                  >
                    {b.status}
                  </Badge>
                </td>
                <td>
                  <button
                    className="icon-button"
                    aria-label={`Open booking ${b.pnr}`}
                    onClick={() => setSelected(b.id)}
                  >
                    <ArrowUpRight size={17} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!rows.length && <Empty />}
    </div>
  );
  return (
    <div className="app-shell">
      <Toaster position="bottom-right" richColors />
      {mobile && (
        <button
          className="sidebar-shade"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className={'sidebar ' + (mobile ? 'open' : '')}>
        <Link href="/" className="brand">
          <span className="brand-mark">
            <Plane size={23} />
          </span>
          Travel<span>IQ</span>
          <span className="brand-dot" />
        </Link>
        <div className="workspace-switch">
          <div className="workspace-avatar">T</div>
          <div>
            <strong>{demo ? 'Explorer workspace' : 'Agency workspace'}</strong>
            <small>{demo ? 'Portfolio demonstration' : 'Private business workspace'}</small>
          </div>
          <ChevronDown size={14} />
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav>
          {navigation.map((n, i) => (
            <div key={n.id}>
              {i === 4 && <p className="nav-label">INTELLIGENCE</p>}
              {i === 7 && <div className="nav-divider" />}
              <button
                aria-label={n.label}
                className={'nav-item ' + (view === n.id ? 'active' : '')}
                onClick={() => navigate(n.id)}
              >
                <n.icon size={18} />
                <span>{n.label}</span>
                {n.id === 'analytics' && <span className="new-pill">NEW</span>}
              </button>
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="insight-card">
            <Sparkles size={19} />
            <strong>A little insight goes a long way.</strong>
            <p>Find the patterns behind your best journeys.</p>
            <button onClick={() => navigate('analytics')}>
              Explore intelligence <ArrowRight size={14} />
            </button>
          </div>
          <div className="user-card">
            <span className="user-avatar">{viewer.name[0]}</span>
            <div>
              <strong>{viewer.name}</strong>
              <small>{demo ? 'Demo administrator' : viewer.role}</small>
            </div>
            <ShieldCheck size={16} />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={20} />
            </button>
            <span>Workspace</span>
            <span>/</span>
            <strong>{navigation.find((n) => n.id === view)?.label}</strong>
          </div>
          <div className="top-actions">
            <span className={'mode-pill ' + (!demo ? 'private' : '')}>
              <span />
              {demo ? 'Demo mode' : 'Private agency'}
            </span>
            <button
              className="icon-button"
              aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
              onClick={() => setDark(!dark)}
            >
              {dark ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            {!demo && (
              <button
                className="icon-button"
                aria-label="Sign out"
                onClick={() => {
                  void api('/api/auth', 'POST', { action: 'logout' })
                    .then(() => {
                      router.push('/');
                      router.refresh();
                    })
                    .catch((e) => toast.error(e.message));
                }}
              >
                <LogOut size={18} />
              </button>
            )}
            <span className="top-avatar">{viewer.name[0]}</span>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <div className="eyebrow">
                {view === 'dashboard'
                  ? 'THE BIG PICTURE'
                  : navigation.find((n) => n.id === view)?.label.toUpperCase()}
              </div>
              <h1>{titles[view]?.[0]}</h1>
              <p>{titles[view]?.[1]}</p>
            </div>
            <div className="heading-actions">
              <button onClick={() => setForm({ upload: true })}>
                <Upload size={16} />
                Import ticket
              </button>
              <button className="primary" onClick={() => setForm({ upload: false })}>
                <Plus size={17} />
                New booking
              </button>
            </div>
          </div>
          {demo && (
            <div className="demo-banner">
              <span>
                <span className="demo-dot" />A real workspace. Entirely fictional data.
              </span>
              <span>
                Explore freely. Changes stay in this browser.
                <button onClick={() => setConfirm('reset')}>
                  Reset demo <RotateCcw size={12} />
                </button>
              </span>
            </div>
          )}
          {['dashboard', 'bookings', 'customers', 'financials', 'analytics'].includes(view) && (
            <>
              <div className="filter-bar">
                <div className="date-filter">
                  <CalendarDays size={16} />
                  <input
                    aria-label="Start date"
                    type="date"
                    value={start}
                    onChange={(e) => {
                      setStart(e.target.value);
                      setPage(1);
                    }}
                  />
                  <span>—</span>
                  <input
                    aria-label="End date"
                    type="date"
                    value={end}
                    onChange={(e) => {
                      setEnd(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>
                <select
                  aria-label="Reporting date basis"
                  value={basis}
                  onChange={(e) => setBasis(e.target.value as typeof basis)}
                >
                  <option value="booking">Booking date</option>
                  <option value="departure">Departure date</option>
                </select>
                <button
                  className={filterOpen ? 'selected-button' : ''}
                  onClick={() => setFilterOpen(!filterOpen)}
                >
                  <SlidersHorizontal size={15} />
                  Filters
                  {status !== 'all' || airline !== 'all' || destination !== 'all' ? ' •' : ''}
                </button>
                <button className="export-button" onClick={exportRows} disabled={!filtered.length}>
                  <Download size={15} />
                  Export CSV
                </button>
              </div>
              {filterOpen && (
                <div className="expanded-filters">
                  <Field label="Booking status">
                    <select
                      value={status}
                      onChange={(e) => {
                        setStatus(e.target.value);
                        setPage(1);
                      }}
                    >
                      {['all', 'pending', 'confirmed', 'cancelled', 'refunded'].map((s) => (
                        <option key={s} value={s}>
                          {s === 'all' ? 'All statuses' : s}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Airline">
                    <select
                      value={airline}
                      onChange={(e) => {
                        setAirline(e.target.value);
                        setPage(1);
                      }}
                    >
                      <option value="all">All airlines</option>
                      {[...new Set(bookings.flatMap((b) => b.segments.map((s) => s.airline)))]
                        .sort()
                        .map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                    </select>
                  </Field>
                  <Field label="Destination">
                    <select
                      value={destination}
                      onChange={(e) => {
                        setDestination(e.target.value);
                        setPage(1);
                      }}
                    >
                      <option value="all">All destinations</option>
                      {[...new Set(bookings.flatMap((b) => b.segments.map((s) => s.destination)))]
                        .sort()
                        .map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                    </select>
                  </Field>
                  <button
                    onClick={() => {
                      setStatus('all');
                      setAirline('all');
                      setDestination('all');
                      setStart('');
                      setEnd('');
                      setQuery('');
                      setPage(1);
                    }}
                  >
                    Clear filters
                  </button>
                </div>
              )}
              {start && end && start > end && (
                <p className="error">Start date must be before end date.</p>
              )}
            </>
          )}
          {loading ? (
            <Card>
              <div className="empty">
                <div className="loader" />
                <p>Loading your workspace…</p>
              </div>
            </Card>
          ) : loadError ? (
            <Card>
              <Empty text={loadError} />
              <button onClick={() => void load()}>Retry loading</button>
            </Card>
          ) : (
            <>
              {view === 'dashboard' && (
                <>
                  <div className="kpi-grid">
                    <Kpi
                      label="Total revenue"
                      value={inr(summary.revenue)}
                      sub="Charges, including adjustments"
                      icon={<IndianRupee size={19} />}
                    />
                    <Kpi
                      label="Gross profit"
                      value={inr(summary.profit)}
                      sub={`${summary.margin.toFixed(1)}% gross profit margin`}
                      icon={<TrendingUp size={19} />}
                      accent
                    />
                    <Kpi
                      label="Total bookings"
                      value={summary.bookings.toLocaleString('en-IN')}
                      sub={`${filtered.reduce((n, b) => n + b.passengers.length, 0)} travellers booked`}
                      icon={<Ticket size={19} />}
                    />
                    <Kpi
                      label="Outstanding payments"
                      value={inr(summary.outstanding)}
                      sub={`${filtered.filter((b) => financials(b).outstanding.gt(0)).length} bookings awaiting payment`}
                      icon={<Clock size={19} />}
                    />
                  </div>
                  <div className="dashboard-charts">
                    <Card
                      title="Business performance"
                      subtitle={`Revenue & gross profit · ${basis} date · last 12 displayed months`}
                      action={
                        <div className="chart-key">
                          <span>Revenue</span>
                          <span>Gross profit</span>
                        </div>
                      }
                    >
                      {trend.length ? <TrendChart data={trend} /> : <Empty />}
                      <div className="chart-footer">
                        <span>
                          Total agency costs <strong>{inr(summary.cost)}</strong>
                        </span>
                        <span>
                          Customer credits <strong>{inr(summary.credit)}</strong>
                        </span>
                        <span className="subtle">INR · gross, before overheads</span>
                      </div>
                    </Card>
                    <Card
                      title="Where the world takes you"
                      subtitle="Most booked destinations"
                      action={<Plane size={18} className="subtle" />}
                    >
                      <div className="destination-list">
                        {destinations.slice(0, 5).map((d, i) => (
                          <div className="destination-item" key={d.name}>
                            <div>
                              <span className="destination-icon">
                                {['◈', '⌁', '◇', '◎', '▧'][i]}
                              </span>
                              <span>
                                <strong>
                                  {(
                                    {
                                      DXB: 'Dubai',
                                      SIN: 'Singapore',
                                      GOI: 'Goa',
                                      DEL: 'New Delhi',
                                      BKK: 'Bangkok',
                                      CMB: 'Colombo',
                                      LHR: 'London',
                                    } as Record<string, string>
                                  )[d.name] || d.name}
                                </strong>
                                <small>{d.name}</small>
                              </span>
                              <b>
                                {d.bookings}
                                <small>bookings</small>
                              </b>
                            </div>
                            <div className="progress-track">
                              <span
                                style={{
                                  width: `${(d.bookings / (destinations[0]?.bookings || 1)) * 100}%`,
                                }}
                              />
                            </div>
                          </div>
                        ))}
                        {!destinations.length && <Empty />}
                      </div>
                      <button className="card-bottom-link" onClick={() => navigate('analytics')}>
                        Explore route insights
                        <ArrowRight size={15} />
                      </button>
                    </Card>
                  </div>
                  <div className="dashboard-lower">
                    <Card
                      title="Recent bookings"
                      subtitle="The latest journeys on your books"
                      action={
                        <button className="text-button" onClick={() => navigate('bookings')}>
                          View all <ArrowRight size={14} />
                        </button>
                      }
                    >
                      {bookingTable(sorted.slice(0, 5), true)}
                    </Card>
                    <Card
                      title="Taking off soon"
                      subtitle={`${upcoming.length} upcoming confirmed journeys · all dates`}
                    >
                      <div className="journey-list">
                        {upcoming.slice(0, 3).map((b) => (
                          <button key={b.id} onClick={() => setSelected(b.id)}>
                            <span className="journey-date">
                              <strong>{b.segments[0].departure.slice(8, 10)}</strong>
                              <small>
                                {new Date(b.segments[0].departure).toLocaleDateString('en-IN', {
                                  month: 'short',
                                })}
                              </small>
                            </span>
                            <span>
                              <strong>
                                {b.segments[0].origin}
                                <span> → </span>
                                {b.segments[0].destination}
                              </strong>
                              <small>{b.customerName}</small>
                              <small>
                                {b.segments[0].flightNumber} · {b.segments[0].departure.slice(11)}
                              </small>
                            </span>
                            <Plane size={17} />
                          </button>
                        ))}
                        {!upcoming.length && <Empty text="No upcoming confirmed journeys." />}
                      </div>
                      <div className="journey-note">
                        <span className="green-dot" />
                        All flight times are local
                      </div>
                    </Card>
                  </div>
                  <p className="footnote">
                    Reports include archived bookings to preserve financial history. Cancellation
                    status alone does not change revenue: record a charge/cost adjustment and any
                    cash refund separately.
                  </p>
                </>
              )}
              {view === 'bookings' && (
                <Card
                  title="Your bookings"
                  subtitle={`${active.length} active records in this view`}
                  action={
                    <div className="search-box">
                      <Search size={16} />
                      <input
                        aria-label="Search bookings"
                        placeholder="Name, PNR, airline, destination…"
                        value={query}
                        onChange={(e) => {
                          setQuery(e.target.value);
                          setPage(1);
                        }}
                      />
                    </div>
                  }
                >
                  {bookingTable(sorted.slice((page - 1) * 20, page * 20))}
                  <div className="pagination">
                    <span>
                      Page {page} of {Math.max(1, Math.ceil(sorted.length / 20))} · sorted by{' '}
                      {sort === 'date' ? 'booking date' : sort}
                    </span>
                    <div>
                      <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
                        Previous
                      </button>
                      <button
                        disabled={page * 20 >= sorted.length}
                        onClick={() => setPage(page + 1)}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </Card>
              )}
              {view === 'customers' && (
                <Card
                  title="The people behind the journeys"
                  subtitle={`${visibleCustomers.length} customers · metrics follow the selected booking cohort`}
                  action={
                    <div className="search-box">
                      <Search size={16} />
                      <input
                        aria-label="Search customers"
                        placeholder="Search customer name…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </div>
                  }
                >
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Customer</th>
                          <th>Segment</th>
                          <th>Bookings</th>
                          <th>Total spending</th>
                          <th>Gross profit</th>
                          <th>Last booking</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {visibleCustomers.map((c) => (
                          <tr key={c.id}>
                            <td>
                              <button className="table-link" onClick={() => setCustomer(c.id)}>
                                {c.name}
                              </button>
                              <small>{c.phone}</small>
                            </td>
                            <td>
                              <Badge tone={c.segment === 'High value' ? 'mint' : 'neutral'}>
                                {c.segment}
                              </Badge>
                            </td>
                            <td>{c.bookings}</td>
                            <td>{inr(c.revenue)}</td>
                            <td>{inr(c.profit)}</td>
                            <td>{dateLabel(c.lastBooking)}</td>
                            <td>
                              <button
                                className="icon-button"
                                aria-label={`View customer ${c.name}`}
                                onClick={() => setCustomer(c.id)}
                              >
                                <ArrowUpRight size={16} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!visibleCustomers.length && <Empty />}
                  </div>
                </Card>
              )}
              {view === 'financials' && (
                <>
                  <div className="kpi-grid">
                    <Kpi
                      label="Agency costs"
                      value={inr(summary.cost)}
                      sub="Original costs plus adjustments"
                      icon={<Wallet size={18} />}
                    />
                    <Kpi
                      label="Gross profit"
                      value={inr(summary.profit)}
                      sub={`${summary.margin.toFixed(1)}% of adjusted charges`}
                      icon={<TrendingUp size={18} />}
                      accent
                    />
                    <Kpi
                      label="Net customer cash"
                      value={inr(summary.cash)}
                      sub="Payments received less cash refunds"
                      icon={<IndianRupee size={18} />}
                    />
                    <Kpi
                      label="Outstanding balance"
                      value={inr(summary.outstanding)}
                      sub={`${inr(summary.credit)} customer credit`}
                      icon={<Clock size={18} />}
                    />
                  </div>
                  <Card
                    title="Cash movement"
                    subtitle="Selected booking cohort · grouped by payment/refund date, across all transaction dates"
                  >
                    <TrendChart cash data={monthly(filtered, 'payment').slice(-12)} />
                  </Card>
                  <Card
                    title="Financial ledger"
                    subtitle="Amounts are immutable entries. Use an adjustment to correct a charge or agency cost."
                    action={
                      <button
                        onClick={() => {
                          download(
                            'traveliq-transactions.csv',
                            csv(
                              filtered.flatMap((b) =>
                                b.transactions.map((t) => ({
                                  booking_id: b.id,
                                  pnr: b.pnr,
                                  currency: b.currency,
                                  ...t,
                                })),
                              ),
                            ),
                          );
                          toast.success('Transaction ledger downloaded');
                        }}
                      >
                        <Download size={15} />
                        Export transactions
                      </button>
                    }
                  >
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Booking / customer</th>
                            <th>Revenue</th>
                            <th>Agency cost</th>
                            <th>Gross profit</th>
                            <th>Net cash</th>
                            <th>Outstanding / credit</th>
                            <th />
                          </tr>
                        </thead>
                        <tbody>
                          {[...filtered]
                            .sort((a, b) => b.bookedOn.localeCompare(a.bookedOn))
                            .slice(0, 50)
                            .map((b) => {
                              const f = financials(b);
                              return (
                                <tr key={b.id}>
                                  <td>
                                    <button
                                      className="table-link"
                                      onClick={() => setSelected(b.id)}
                                    >
                                      {b.pnr || b.id.slice(0, 8)}
                                    </button>
                                    <small>{b.customerName}</small>
                                  </td>
                                  <td>{inr(f.revenue)}</td>
                                  <td>{inr(f.cost)}</td>
                                  <td className={f.profit.lt(0) ? 'negative' : 'positive'}>
                                    {inr(f.profit)}
                                  </td>
                                  <td>{inr(f.cash)}</td>
                                  <td>
                                    {inr(f.outstanding)}
                                    <small>
                                      {f.credit.gt(0) ? inr(f.credit) + ' credit' : f.paymentStatus}
                                    </small>
                                  </td>
                                  <td>
                                    <button disabled={b.archived} onClick={() => setPayment(b)}>
                                      Record entry
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                      {!filtered.length && <Empty />}
                    </div>
                    <p className="footnote">
                      Showing the latest {Math.min(filtered.length, 50)} of {filtered.length}{' '}
                      matching bookings. CSV includes every matching record.
                    </p>
                  </Card>
                </>
              )}
              {view === 'analytics' && (
                <Intelligence
                  bookings={filtered}
                  today={today}
                  onSelect={(b) => setSelected(b.id)}
                />
              )}
              {view === 'forecasting' && <Forecasting bookings={bookings} today={today} />}
              {view === 'simulator' && <Simulator />}
              {view === 'documents' && (
                <>
                  <div className="two-columns">
                    <Card
                      title="A ticket. A head start."
                      subtitle="PDF extraction that keeps you in control"
                    >
                      <div className="document-callout">
                        <FileText size={44} />
                        <h2>Less typing. More travelling.</h2>
                        <p>
                          Import a selectable-text ticket, review the extracted details, then enter
                          your agency cost and customer charge.
                        </p>
                        <button className="primary" onClick={() => setForm({ upload: true })}>
                          <Upload size={16} />
                          Import a ticket
                        </button>
                      </div>
                    </Card>
                    <Card
                      title="Try a fictional sample"
                      subtitle="Safe, selectable-text PDFs for your portfolio"
                    >
                      <div className="sample-list">
                        {[
                          ['single-ticket.pdf', 'One passenger · one flight'],
                          ['multi-ticket.pdf', 'Two passengers · two segments'],
                          ['alternate-ticket.pdf', 'Alternate labels · missing arrival'],
                          ['agency-table-ticket.pdf', 'Agency table · connecting flights'],
                          ['agency-card-ticket.pdf', 'Agency flight card · one passenger'],
                        ].map(([file, label]) => (
                          <a key={file} href={'/samples/' + file} download>
                            <span className="sample-icon">
                              <FileText size={22} />
                            </span>
                            <span>
                              <strong>{label}</strong>
                              <small>Fictional ticket · PDF</small>
                            </span>
                            <Download size={17} />
                          </a>
                        ))}
                      </div>
                      <p className="footnote">
                        These files contain fictional travellers and flights. No uploaded ticket is
                        sent to an AI service.
                      </p>
                    </Card>
                  </div>
                  <Card
                    title="Retained documents"
                    subtitle={
                      demo
                        ? 'Demo files are temporary. Nothing is uploaded or shared.'
                        : 'Private documents · download links expire after 60 seconds'
                    }
                  >
                    {documents.length ? (
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Document</th>
                              <th>Booking</th>
                              <th>Uploaded</th>
                              <th />
                            </tr>
                          </thead>
                          <tbody>
                            {documents.map((d) => (
                              <tr key={d.id}>
                                <td>{d.name}</td>
                                <td>
                                  {bookings.find((b) => b.id === d.bookingId)?.pnr ||
                                    d.bookingId.slice(0, 8)}
                                </td>
                                <td>{dateLabel(d.createdAt)}</td>
                                <td>
                                  <button
                                    onClick={() => {
                                      void api('/api/documents/' + d.id)
                                        .then((r) => location.assign(r.url))
                                        .catch((e) => toast.error(e.message));
                                    }}
                                  >
                                    Download
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <Empty
                        text={
                          demo
                            ? 'Try an import above. Demo documents disappear when the review closes.'
                            : 'No retained documents yet. You can attach a PDF to a saved booking below.'
                        }
                      />
                    )}
                    {!demo && (
                      <form
                        className="attach-form"
                        onSubmit={async (e) => {
                          e.preventDefault();
                          const target = e.currentTarget;
                          setSaving(true);
                          try {
                            const body = new FormData(target);
                            await api('/api/documents', 'POST', body);
                            setDocuments(await api('/api/documents'));
                            target.reset();
                            toast.success('Private document retained');
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : 'Upload failed');
                          } finally {
                            setSaving(false);
                          }
                        }}
                      >
                        <Field label="Booking">
                          <select name="bookingId" required>
                            {bookings
                              .filter((b) => !b.archived)
                              .map((b) => (
                                <option key={b.id} value={b.id}>
                                  {b.pnr} · {b.customerName}
                                </option>
                              ))}
                          </select>
                        </Field>
                        <Field label="PDF up to 4 MB">
                          <input type="file" name="file" accept="application/pdf" required />
                        </Field>
                        <button disabled={saving || !bookings.length}>Attach PDF</button>
                      </form>
                    )}
                  </Card>
                </>
              )}
              {view === 'settings' && (
                <>
                  <div className="two-columns">
                    <Card
                      title="Workspace preferences"
                      subtitle="A few things to make the day easier"
                    >
                      <div className="setting-row">
                        <div>
                          <strong>Appearance</strong>
                          <small>{dark ? 'Dark' : 'Light'} mode</small>
                        </div>
                        <button onClick={() => setDark(!dark)}>
                          {dark ? <Sun size={16} /> : <Moon size={16} />}Switch theme
                        </button>
                      </div>
                      <div className="setting-row">
                        <div>
                          <strong>Currency</strong>
                          <small>All records store an explicit currency code.</small>
                        </div>
                        <Badge>INR · Indian rupee</Badge>
                      </div>
                      <div className="setting-row">
                        <div>
                          <strong>Flight times</strong>
                          <small>Local wall time as printed on the ticket.</small>
                        </div>
                        <Badge>Local time</Badge>
                      </div>
                    </Card>
                    <Card
                      title={demo ? 'Your demo sandbox' : 'Agency security'}
                      subtitle={
                        demo
                          ? 'A separate, resettable browser workspace'
                          : 'Invitation-only access managed by your administrator'
                      }
                    >
                      <div className="setting-row">
                        <div>
                          <strong>{demo ? 'Reset all demo changes' : 'Your role'}</strong>
                          <small>
                            {demo ? 'Restore the reproducible fictional dataset.' : viewer.name}
                          </small>
                        </div>
                        {demo ? (
                          <button onClick={() => setConfirm('reset')}>
                            <RotateCcw size={15} />
                            Reset demo
                          </button>
                        ) : (
                          <Badge tone="mint">{viewer.role}</Badge>
                        )}
                      </div>
                      <div className="notice">
                        <ShieldCheck size={20} />
                        <span>
                          {demo
                            ? 'This deployment has no agency database, authentication or storage credentials. Its reference date is 12 October 2026.'
                            : 'Membership is checked on every protected request. Ask your administrator to provision staff or revoke access using the onboarding tools.'}
                        </span>
                      </div>
                      {!demo && (
                        <a className="text-button" href="/reset-password">
                          Change your password <ArrowRight size={15} />
                        </a>
                      )}
                    </Card>
                  </div>
                  {!demo && viewer.role === 'admin' && (
                    <Card
                      title="Recent audit activity"
                      subtitle="Last 100 changes · record identifiers only"
                      action={
                        <button
                          onClick={() => {
                            void api('/api/audit')
                              .then(setAudit)
                              .catch((e) => toast.error(e.message));
                          }}
                        >
                          Load audit records
                        </button>
                      }
                    >
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Action</th>
                              <th>Record</th>
                              <th>Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {audit.map((a) => (
                              <tr key={a.id}>
                                <td>{a.action}</td>
                                <td>{a.recordId}</td>
                                <td>{new Date(a.createdAt).toLocaleString('en-IN')}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  )}
                  <Card
                    title="Accounting & reporting"
                    subtitle="Transparent definitions are part of good decisions"
                  >
                    <div className="definitions">
                      <p>
                        <strong>Gross profit</strong> = adjusted customer charge − adjusted agency
                        cost. It does not include salaries, rent, taxes or other operating expenses.
                      </p>
                      <p>
                        <strong>Cash balance</strong> = payments − cash refunds. A cash refund does
                        not itself change the booking charge; use a separate adjustment when the
                        price changes.
                      </p>
                      <p>
                        <strong>Booking reports</strong> group all current adjusted amounts by the
                        original booking date or first departure date. They are operational cohort
                        reports, not period-close statutory accounts.
                      </p>
                      <p>
                        <strong>Retention</strong> Archived bookings remain in financial reports.
                        Audit logs and financial entries are retained. An administrator handles
                        legal retention and deletion requests using the documented procedure.
                      </p>
                    </div>
                  </Card>
                </>
              )}
            </>
          )}
          <footer className="page-footer">
            <span>
              <Plane size={13} />
              TravelIQ <span>·</span> A little clarity. A world of possibilities.
            </span>
            <span>
              {demo ? 'Fictional data · Portfolio edition' : 'Secure agency workspace'}
              <span className="green-dot" />
            </span>
          </footer>
        </main>
      </div>
      {form && (
        <BookingForm
          key={form.existing?.id || 'new'}
          existing={form.existing}
          all={bookings}
          today={today}
          upload={form.upload}
          onSave={save}
          onClose={() => setForm(null)}
        />
      )}
      {current && !form && !payment && (
        <Modal
          wide
          title={`${current.pnr || 'Booking'} · ${current.customerName}`}
          description={`Internal ID: ${current.id}`}
          onClose={() => setSelected(null)}
        >
          <div className="detail-body">
            <div className="detail-top">
              <Badge tone="mint">
                {current.status}
                {current.archived ? ' · archived' : ''}
              </Badge>
              <span>Booked {dateLabel(current.bookedOn)}</span>
              <span>{current.passengers.length} passenger(s)</span>
            </div>
            <div className="segment-cards">
              {current.segments.map((s, i) => (
                <div className="flight-detail" key={i}>
                  <div>
                    <small>
                      {s.airline} · {s.flightNumber}
                    </small>
                    <strong>
                      {s.origin}
                      <Plane size={20} />
                      {s.destination}
                    </strong>
                  </div>
                  <div>
                    <small>Departure · local time</small>
                    <b>{s.departure.replace('T', ' · ')}</b>
                  </div>
                  <div>
                    <small>Arrival · local time</small>
                    <b>{s.arrival ? s.arrival.replace('T', ' · ') : 'Not recorded'}</b>
                  </div>
                </div>
              ))}
            </div>
            <div className="detail-passengers">
              {current.passengers.map((p, i) => (
                <span key={i}>
                  <Users size={15} />
                  {p.name}
                  {p.ticketNumber && ' · ' + p.ticketNumber}
                </span>
              ))}
            </div>
            <div className="detail-metrics">
              {[
                ['Customer charged', financials(current).revenue],
                ['Agency cost', financials(current).cost],
                ['Gross profit', financials(current).profit],
                ['Outstanding', financials(current).outstanding],
              ].map(([label, value]) => (
                <div key={String(label)}>
                  <small>{String(label)}</small>
                  <strong>{inr(value as ReturnType<typeof D>)}</strong>
                </div>
              ))}
            </div>
            <div className="notice">
              Cancellation and refund statuses do not alter financial values. Record a charge/cost
              adjustment and any cash refund separately.
            </div>
            <h3>Transaction history</h3>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Entry</th>
                    <th>Amount</th>
                    <th>Cost adjustment</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {current.transactions.map((t) => (
                    <tr key={t.id}>
                      <td>{dateLabel(t.date)}</td>
                      <td>{t.type}</td>
                      <td>{inr(t.amount)}</td>
                      <td>{t.costAdjustment ? inr(t.costAdjustment) : '—'}</td>
                      <td>{t.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!current.transactions.length && (
                <p className="footnote">No financial entries recorded yet.</p>
              )}
            </div>
            <div className="form-footer">
              {viewer.role === 'admin' && !current.archived && (
                <button className="danger" onClick={() => setConfirm('archive')}>
                  <Archive size={15} />
                  Archive
                </button>
              )}
              <div className="spacer" />
              <button
                disabled={current.archived}
                onClick={() => setForm({ existing: current, upload: false })}
              >
                Edit booking
              </button>
              <button
                disabled={current.archived}
                className="primary"
                onClick={() => setPayment(current)}
              >
                Record financial entry
              </button>
            </div>
          </div>
        </Modal>
      )}
      {payment && (
        <TransactionForm
          booking={payment}
          role={viewer.role}
          today={today}
          onSave={transact}
          onClose={() => setPayment(null)}
        />
      )}
      {customer && (
        <Modal
          wide
          title={allCustomers.find((c) => c.id === customer)?.name || 'Customer'}
          description="Complete customer history across all dates"
          onClose={() => setCustomer(null)}
        >
          <div className="detail-body">
            <div className="customer-contact">
              <Phone size={16} />
              {allCustomers.find((c) => c.id === customer)?.phone}
              <Mail size={16} />
              {allCustomers.find((c) => c.id === customer)?.email || 'No email recorded'}
            </div>
            {bookingTable(
              bookings
                .filter((b) => b.customerId === customer)
                .sort((a, b) => b.bookedOn.localeCompare(a.bookedOn)),
              true,
            )}
          </div>
        </Modal>
      )}
      {confirm && (
        <Modal
          title={confirm === 'reset' ? 'Reset your demo workspace?' : 'Archive this booking?'}
          description={
            confirm === 'reset'
              ? 'Your local additions and edits will be replaced with the original fictional dataset.'
              : 'The booking will leave the active list. Financial entries and audit history will be retained.'
          }
          onClose={() => setConfirm(null)}
        >
          <div className="form-footer">
            <button onClick={() => setConfirm(null)}>Cancel</button>
            <button className="primary" disabled={saving} onClick={() => void confirmAction()}>
              <Check size={16} />
              {saving ? 'Working…' : confirm === 'reset' ? 'Reset demo' : 'Archive booking'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
function TransactionForm({
  booking,
  role,
  today,
  onSave,
  onClose,
}: {
  booking: Booking;
  role: string;
  today: string;
  onSave: (t: Omit<Transaction, 'id'>) => Promise<void>;
  onClose: () => void;
}) {
  const [type, setType] = useState<'payment' | 'refund' | 'adjustment'>('payment'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <Modal
      title="Record a financial entry"
      description={`${booking.pnr} · ${booking.customerName} · Outstanding ${inr(financials(booking).outstanding)}`}
      onClose={onClose}
    >
      <form
        className="transaction-form"
        onSubmit={async (e) => {
          e.preventDefault();
          setError('');
          const fd = new FormData(e.currentTarget),
            parsed = transactionSchema.safeParse({
              type,
              amount: fd.get('amount'),
              costAdjustment: type === 'adjustment' ? fd.get('costAdjustment') : undefined,
              date: fd.get('date'),
              note: fd.get('note'),
            });
          if (!parsed.success) {
            setError(parsed.error.issues.map((i) => i.message).join('; '));
            return;
          }
          setBusy(true);
          try {
            await onSave(parsed.data);
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Unable to record entry');
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Entry type">
          <select value={type} onChange={(e) => setType(e.target.value as typeof type)}>
            <option value="payment">Payment received</option>
            {role === 'admin' && (
              <>
                <option value="refund">Cash refund</option>
                <option value="adjustment">Charge / cost adjustment</option>
              </>
            )}
          </select>
        </Field>
        <div className="form-grid">
          <Field label={type === 'adjustment' ? 'Change to customer charge (₹)' : 'Amount (₹)'}>
            <input
              name="amount"
              inputMode="decimal"
              required
              placeholder={type === 'adjustment' ? '-500.00' : '500.00'}
            />
          </Field>
          {type === 'adjustment' && (
            <Field label="Change to agency cost (₹)">
              <input name="costAdjustment" inputMode="decimal" required defaultValue="0" />
            </Field>
          )}
          <Field label="Transaction date">
            <input name="date" type="date" defaultValue={today} required />
          </Field>
        </div>
        <Field label="Reason / payment reference">
          <textarea name="note" required minLength={3} maxLength={300} />
        </Field>
        <div className="notice">
          {type === 'adjustment'
            ? 'Use signed amounts: negative decreases a charge or cost. Cash is unaffected. Entries cannot be edited or deleted.'
            : type === 'refund'
              ? 'A refund returns money already received. Adjust the customer charge separately if the booking price also changes.'
              : 'Payments cannot exceed the current outstanding balance.'}
        </div>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="form-footer">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            {busy ? 'Saving…' : 'Record entry'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
