'use client';
import { useState, useEffect } from 'react';
import { Plus, Trash2, Upload, FileText, CheckCircle2 } from 'lucide-react';
import { Modal, Field } from './ui';
import type { Booking, Segment } from '@/lib/model';
import { bookingSchema, type BookingInput } from '@/lib/validation';
import { duplicateBookings, inr, D } from '@/lib/finance';
import { extractPdf } from '@/lib/pdf/extract';
import { customerDefaults } from '@/lib/pdf/parser';
import { PdfPreview } from './pdf-preview';
const emptySegment: Segment = {
  airline: '',
  flightNumber: '',
  origin: '',
  destination: '',
  departure: '',
  arrival: '',
};
export function BookingForm({
  existing,
  all,
  today,
  upload,
  onSave,
  onClose,
}: {
  existing?: Booking;
  all: Booking[];
  today: string;
  upload: boolean;
  onSave: (data: BookingInput, id?: string, file?: File) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState<BookingInput>(
      existing
        ? { ...existing }
        : {
            customerName: '',
            phone: '',
            email: '',
            pnr: '',
            bookedOn: today,
            status: 'confirmed',
            currency: 'INR',
            agencyCost: '',
            customerCharged: '',
            passengers: [{ name: '', ticketNumber: '' }],
            segments: [{ ...emptySegment }],
          },
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [warnings, setWarnings] = useState<string[]>([]),
    [file, setFile] = useState<File>(),
    [preview, setPreview] = useState(''),
    [verified, setVerified] = useState(!upload);
  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const update = <K extends keyof BookingInput>(k: K, v: BookingInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const duplicates = duplicateBookings(all, form, existing?.id);
  const profit =
    /^\d+(\.\d{1,2})?$/.test(form.customerCharged) && /^\d+(\.\d{1,2})?$/.test(form.agencyCost)
      ? D(form.customerCharged).minus(form.agencyCost)
      : null;
  async function load(file: File) {
    setBusy(true);
    setError('');
    try {
      const result = await extractPdf(file);
      setFile(file);
      setVerified(false);
      setWarnings(result.warnings);
      setForm((f) => ({
        ...f,
        ...customerDefaults(result),
        pnr: result.pnr,
        passengers: result.passengers.length ? result.passengers : [{ name: '', ticketNumber: '' }],
        segments: result.segments.length ? result.segments : [{ ...emptySegment }],
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'PDF could not be read');
    } finally {
      setBusy(false);
    }
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const result = bookingSchema.safeParse(form);
    if (!result.success) {
      setError(result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
      return;
    }
    if (!verified) {
      setError('Verify the extracted ticket details before saving.');
      return;
    }
    if (duplicates.length && !form.acknowledgeDuplicate) {
      setError('Review and acknowledge the possible duplicate before saving.');
      return;
    }
    setBusy(true);
    try {
      await onSave(result.data, existing?.id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      wide
      title={
        existing ? 'Edit booking' : upload ? 'Turn a ticket into a booking' : 'Create a booking'
      }
      description="Flight times use the local time printed on the ticket. All amounts are in INR."
      onClose={onClose}
    >
      <div className={'booking-review ' + (preview ? 'with-preview' : '')}>
        {preview && (
          <aside className="pdf-preview">
            <div>
              <FileText size={16} />
              {file?.name}
            </div>
            {file && <PdfPreview key={file.name + file.lastModified} file={file} />}
          </aside>
        )}
        <form onSubmit={save} className="booking-form">
          {!existing && (
            <label className="upload-zone">
              <Upload size={23} />
              <strong>
                {busy ? 'Reading your ticket…' : 'Drop in the details. Start with a PDF.'}
              </strong>
              <span>Selectable text · Up to 4 MB · Processed on this device</span>
              <input
                aria-label="Upload ticket PDF"
                type="file"
                accept="application/pdf"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void load(f);
                }}
              />
            </label>
          )}
          {warnings.length > 0 && (
            <div className="notice">
              {warnings.map((w) => (
                <p key={w}>{w}</p>
              ))}
            </div>
          )}
          <h4>
            01 <span>Booking & customer</span>
          </h4>
          <div className="form-grid">
            <Field label="Customer name">
              <input
                value={form.customerName}
                required
                onChange={(e) => update('customerName', e.target.value)}
              />
            </Field>
            <Field label="Contact number">
              <input
                value={form.phone}
                required
                onChange={(e) => update('phone', e.target.value)}
                placeholder="+91…"
              />
            </Field>
            <Field label="Email (optional)">
              <input
                type="email"
                value={form.email}
                onChange={(e) => update('email', e.target.value)}
              />
            </Field>
            <Field label="PNR / booking reference">
              <input
                value={form.pnr}
                onChange={(e) => update('pnr', e.target.value.toUpperCase())}
              />
            </Field>
            <Field label="Booking date">
              <input
                type="date"
                value={form.bookedOn}
                required
                onChange={(e) => update('bookedOn', e.target.value)}
              />
            </Field>
            <Field label="Booking status">
              <select
                value={form.status}
                onChange={(e) => update('status', e.target.value as BookingInput['status'])}
              >
                {['pending', 'confirmed', 'cancelled', 'refunded'].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
          </div>
          <h4>
            02 <span>Passengers</span>
          </h4>
          {form.passengers.map((p, i) => (
            <div className="repeat-row" key={i}>
              <Field label={`Passenger ${i + 1}`}>
                <input
                  required
                  value={p.name}
                  onChange={(e) =>
                    update(
                      'passengers',
                      form.passengers.map((v, j) => (i === j ? { ...v, name: e.target.value } : v)),
                    )
                  }
                />
              </Field>
              <Field label="Ticket number (optional)">
                <input
                  value={p.ticketNumber}
                  onChange={(e) =>
                    update(
                      'passengers',
                      form.passengers.map((v, j) =>
                        i === j ? { ...v, ticketNumber: e.target.value } : v,
                      ),
                    )
                  }
                />
              </Field>
              {form.passengers.length > 1 && (
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Remove passenger ${i + 1}`}
                  onClick={() =>
                    update(
                      'passengers',
                      form.passengers.filter((_, j) => i !== j),
                    )
                  }
                >
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            className="text-button"
            disabled={form.passengers.length >= 20}
            onClick={() =>
              update('passengers', [...form.passengers, { name: '', ticketNumber: '' }])
            }
          >
            <Plus size={15} />
            Add passenger
          </button>
          <h4>
            03 <span>Flight segments</span>
          </h4>
          {form.segments.map((s, i) => (
            <div className="segment-form" key={i}>
              <div className="section-line">
                <strong>Segment {i + 1}</strong>
                {form.segments.length > 1 && (
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Remove segment ${i + 1}`}
                    onClick={() =>
                      update(
                        'segments',
                        form.segments.filter((_, j) => i !== j),
                      )
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              <div className="form-grid">
                {(
                  [
                    'airline',
                    'flightNumber',
                    'origin',
                    'destination',
                    'departure',
                    'arrival',
                  ] as const
                ).map((k) => (
                  <Field
                    key={k}
                    label={
                      {
                        airline: 'Airline',
                        flightNumber: 'Flight number',
                        origin: 'Origin (IATA)',
                        destination: 'Destination (IATA)',
                        departure: 'Departure · local time',
                        arrival: 'Arrival · local time (optional)',
                      }[k]
                    }
                  >
                    <input
                      type={k === 'departure' || k === 'arrival' ? 'datetime-local' : 'text'}
                      required={['airline', 'origin', 'destination', 'departure'].includes(k)}
                      value={s[k]}
                      onChange={(e) =>
                        update(
                          'segments',
                          form.segments.map((v, j) =>
                            j === i
                              ? {
                                  ...v,
                                  [k]: ['origin', 'destination'].includes(k)
                                    ? e.target.value.toUpperCase()
                                    : e.target.value,
                                }
                              : v,
                          ),
                        )
                      }
                    />
                  </Field>
                ))}
              </div>
            </div>
          ))}
          <button
            type="button"
            className="text-button"
            disabled={form.segments.length >= 12}
            onClick={() => update('segments', [...form.segments, { ...emptySegment }])}
          >
            <Plus size={15} />
            Add flight segment
          </button>
          <h4>
            04 <span>Manual financial entry</span>
          </h4>
          <div className="notice">
            {existing
              ? 'Original amounts are locked. Record a financial adjustment to change a charge or cost.'
              : 'Enter what your agency paid and what you charged the customer. These values are never populated from a ticket.'}
          </div>
          <div className="form-grid">
            <Field label="Agency cost (₹)">
              <input
                required
                inputMode="decimal"
                value={form.agencyCost}
                readOnly={!!existing}
                onChange={(e) => update('agencyCost', e.target.value)}
              />
            </Field>
            <Field label="Customer charged (₹)">
              <input
                required
                inputMode="decimal"
                value={form.customerCharged}
                readOnly={!!existing}
                onChange={(e) => update('customerCharged', e.target.value)}
              />
            </Field>
          </div>
          <div className="profit-preview">
            <span>Gross profit</span>
            <strong>{profit ? inr(profit) : '—'}</strong>
            <small>
              {profit && !D(form.customerCharged).isZero()
                ? profit.div(form.customerCharged).mul(100).toFixed(1) + '% margin'
                : '0% margin'}
            </small>
          </div>
          {duplicates.length > 0 && (
            <label className="notice checkbox">
              <input
                type="checkbox"
                checked={!!form.acknowledgeDuplicate}
                onChange={(e) => update('acknowledgeDuplicate', e.target.checked)}
              />
              I reviewed {duplicates.length} possible duplicate booking(s) and want to save this
              record.
            </label>
          )}
          {file && (
            <>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={verified}
                  onChange={(e) => setVerified(e.target.checked)}
                />
                I have verified the extracted details against the original ticket.
              </label>
              <p className="footnote">
                The PDF stays on your device and is not retained after review.
              </p>
            </>
          )}
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <footer className="form-footer">
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button className="primary" disabled={busy}>
              <CheckCircle2 size={16} />
              {busy ? 'Working…' : existing ? 'Save changes' : 'Create booking'}
            </button>
          </footer>
        </form>
      </div>
    </Modal>
  );
}
