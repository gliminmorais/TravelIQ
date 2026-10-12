import {
  pgTable,
  uuid,
  text,
  date,
  timestamp,
  numeric,
  integer,
  boolean,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
const id = () => uuid('id').primaryKey().defaultRandom();
const agencyId = () =>
  uuid('agency_id')
    .notNull()
    .references(() => agencies.id);
const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
export const agencies = pgTable('agencies', {
  id: id(),
  name: text('name').notNull(),
  createdAt: createdAt(),
});
export const memberships = pgTable('memberships', {
  id: id(),
  userId: uuid('user_id').notNull().unique(),
  agencyId: agencyId(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: createdAt(),
});
export const customers = pgTable(
  'customers',
  {
    id: id(),
    agencyId: agencyId(),
    name: text('name').notNull(),
    phone: text('phone').notNull(),
    email: text('email').notNull().default(''),
    identity: text('identity').notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('customer_identity').on(t.agencyId, t.identity)],
);
export const bookings = pgTable(
  'bookings',
  {
    id: id(),
    agencyId: agencyId(),
    customerId: uuid('customer_id')
      .notNull()
      .references(() => customers.id),
    pnr: text('pnr').notNull(),
    bookedOn: date('booked_on').notNull(),
    status: text('status').notNull(),
    currency: text('currency').notNull().default('INR'),
    archived: boolean('archived').notNull().default(false),
    version: integer('version').notNull().default(1),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('booking_agency_date').on(t.agencyId, t.bookedOn),
    index('booking_agency_pnr').on(t.agencyId, t.pnr),
  ],
);
export const financialRecords = pgTable('financial_records', {
  id: id(),
  agencyId: agencyId(),
  bookingId: uuid('booking_id')
    .notNull()
    .unique()
    .references(() => bookings.id),
  agencyCost: numeric('agency_cost', { precision: 14, scale: 2 }).notNull(),
  customerCharged: numeric('customer_charged', { precision: 14, scale: 2 }).notNull(),
});
export const passengers = pgTable('passengers', {
  id: id(),
  agencyId: agencyId(),
  bookingId: uuid('booking_id')
    .notNull()
    .references(() => bookings.id),
  name: text('name').notNull(),
  ticketNumber: text('ticket_number').notNull(),
  position: integer('position').notNull(),
});
export const flightSegments = pgTable(
  'flight_segments',
  {
    id: id(),
    agencyId: agencyId(),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id),
    airline: text('airline').notNull(),
    flightNumber: text('flight_number').notNull(),
    origin: text('origin').notNull(),
    destination: text('destination').notNull(),
    departure: text('departure').notNull(),
    arrival: text('arrival').notNull(),
    position: integer('position').notNull(),
  },
  (t) => [index('segment_agency_departure').on(t.agencyId, t.departure)],
);
export const payments = pgTable('payments', {
  id: id(),
  agencyId: agencyId(),
  bookingId: uuid('booking_id')
    .notNull()
    .references(() => bookings.id),
  amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
  date: date('date').notNull(),
  note: text('note').notNull(),
  createdAt: createdAt(),
});
export const refunds = pgTable('refunds', {
  id: id(),
  agencyId: agencyId(),
  bookingId: uuid('booking_id')
    .notNull()
    .references(() => bookings.id),
  amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
  date: date('date').notNull(),
  note: text('note').notNull(),
  createdAt: createdAt(),
});
export const adjustments = pgTable('adjustments', {
  id: id(),
  agencyId: agencyId(),
  bookingId: uuid('booking_id')
    .notNull()
    .references(() => bookings.id),
  amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
  costAdjustment: numeric('cost_adjustment', { precision: 14, scale: 2 }).notNull(),
  date: date('date').notNull(),
  note: text('note').notNull(),
  createdAt: createdAt(),
});
export const documents = pgTable('documents', {
  id: id(),
  agencyId: agencyId(),
  bookingId: uuid('booking_id')
    .notNull()
    .references(() => bookings.id),
  name: text('name').notNull(),
  storagePath: text('storage_path').notNull().unique(),
  createdAt: createdAt(),
});
export const auditLogs = pgTable('audit_logs', {
  id: id(),
  agencyId: agencyId(),
  userId: uuid('user_id').notNull(),
  action: text('action').notNull(),
  recordId: uuid('record_id').notNull(),
  details: jsonb('details').notNull(),
  createdAt: createdAt(),
});
