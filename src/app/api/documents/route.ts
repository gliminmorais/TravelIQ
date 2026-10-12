import { actor, endpoint, sameOrigin, rateLimit, storageClient, HttpError } from '@/lib/server';
import { scoped, loadBookings } from '@/db/repository';
import { documents, auditLogs } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
export async function GET() {
  return endpoint(async () => {
    const a = await actor();
    return scoped(a, (tx) =>
      tx
        .select({
          id: documents.id,
          bookingId: documents.bookingId,
          name: documents.name,
          createdAt: documents.createdAt,
        })
        .from(documents)
        .where(eq(documents.agencyId, a.agencyId)),
    );
  });
}
export async function POST(req: Request) {
  return endpoint(async () => {
    sameOrigin(req);
    const a = await actor();
    await rateLimit('upload:' + a.userId, 10);
    // Vercel also enforces a 4.5 MB transport limit; count bytes independently for local/custom hosts.
    const reader = req.body?.getReader();
    if (!reader) throw new HttpError(400, 'File is missing');
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 4 * 1024 * 1024 + 20000) {
        await reader.cancel();
        throw new HttpError(413, 'PDF must be 4 MB or smaller');
      }
      chunks.push(value);
    }
    const form = await new Response(Buffer.concat(chunks), {
      headers: { 'content-type': req.headers.get('content-type') || '' },
    }).formData();
    const bookingId = z.uuid().parse(form.get('bookingId')),
      file = form.get('file');
    if (
      !(file instanceof File) ||
      file.type !== 'application/pdf' ||
      file.size > 4 * 1024 * 1024 ||
      !file.name.toLowerCase().endsWith('.pdf')
    )
      throw new HttpError(400, 'Choose a PDF up to 4 MB');
    const data = Buffer.from(await file.arrayBuffer());
    if (data.subarray(0, 5).toString() !== '%PDF-') throw new HttpError(400, 'Invalid PDF');
    return scoped(a, async (tx) => {
      const [booking] = await loadBookings(tx, a.agencyId, [bookingId]);
      if (!booking || booking.archived) throw new HttpError(404, 'Booking not found');
      const id = crypto.randomUUID(),
        path = `${a.agencyId}/${bookingId}/${id}.pdf`,
        store = storageClient().storage.from(process.env.STORAGE_BUCKET || 'tickets');
      const { error } = await store.upload(path, data, {
        contentType: 'application/pdf',
        upsert: false,
      });
      if (error) throw Error('Storage failure');
      try {
        await tx
          .insert(documents)
          .values({
            id,
            agencyId: a.agencyId,
            bookingId,
            name: file.name.replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 120),
            storagePath: path,
          });
        await tx
          .insert(auditLogs)
          .values({
            agencyId: a.agencyId,
            userId: a.userId,
            action: 'document.uploaded',
            recordId: id,
            details: { bookingId },
          });
      } catch (e) {
        await store.remove([path]);
        throw e;
      }
      return { id };
    });
  });
}
