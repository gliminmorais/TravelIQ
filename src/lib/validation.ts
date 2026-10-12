import { z } from 'zod';
export const money = z
  .string()
  .regex(/^\d{1,9}(\.\d{1,2})?$/, 'Use a non-negative amount with up to 2 decimal places');
export const signedMoney = z
  .string()
  .regex(/^-?\d{1,9}(\.\d{1,2})?$/, 'Use an amount with up to 2 decimal places');
export const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) => !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
    'Enter a valid date',
  );
const localTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
  .refine(
    (v) =>
      day.safeParse(v.slice(0, 10)).success &&
      Number(v.slice(11, 13)) < 24 &&
      Number(v.slice(14, 16)) < 60,
    'Enter a valid local flight time',
  );
export const segmentSchema = z
  .object({
    airline: z.string().trim().min(1).max(80),
    flightNumber: z.string().trim().max(16),
    origin: z.string().regex(/^[A-Z]{3}$/, 'Use a three-letter IATA code'),
    destination: z.string().regex(/^[A-Z]{3}$/),
    departure: localTime,
    arrival: z.union([localTime, z.literal('')]),
  })
  .refine((s) => s.origin !== s.destination, 'Origin and destination must differ');
export const bookingSchema = z.object({
  customerName: z.string().trim().min(2).max(100),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{7,20}$/, 'Enter a valid contact number'),
  email: z.union([z.email().max(200), z.literal('')]),
  pnr: z.string().trim().max(20),
  bookedOn: day,
  status: z.enum(['pending', 'confirmed', 'cancelled', 'refunded']),
  currency: z.literal('INR'),
  agencyCost: money,
  customerCharged: money,
  passengers: z
    .array(z.object({ name: z.string().trim().min(2).max(100), ticketNumber: z.string().max(30) }))
    .min(1)
    .max(20),
  segments: z.array(segmentSchema).min(1).max(12),
  acknowledgeDuplicate: z.boolean().optional(),
  version: z.number().int().positive().optional(),
});
export type BookingInput = z.infer<typeof bookingSchema>;
export const transactionSchema = z
  .object({
    type: z.enum(['payment', 'refund', 'adjustment']),
    amount: signedMoney,
    costAdjustment: signedMoney.optional(),
    date: day,
    note: z.string().trim().min(3).max(300),
  })
  .superRefine((t, c) => {
    if (t.type !== 'adjustment' && (Number(t.amount) <= 0 || t.costAdjustment))
      c.addIssue({
        code: 'custom',
        message: 'Payments and refunds must be positive and cannot adjust costs',
      });
    if (t.type === 'adjustment' && Number(t.amount) === 0 && Number(t.costAdjustment || 0) === 0)
      c.addIssue({ code: 'custom', message: 'An adjustment must change the charge or cost' });
  });
