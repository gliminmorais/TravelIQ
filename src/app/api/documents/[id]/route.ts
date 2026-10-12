import { actor, endpoint, HttpError, storageClient } from '@/lib/server';
import { scoped } from '@/db/repository';
import { documents } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
export async function GET(_req: Request, c: { params: Promise<{ id: string }> }) {
  return endpoint(async () => {
    const a = await actor(),
      id = z.uuid().parse((await c.params).id);
    return scoped(a, async (tx) => {
      const [d] = await tx
        .select()
        .from(documents)
        .where(and(eq(documents.id, id), eq(documents.agencyId, a.agencyId)));
      if (!d) throw new HttpError(404, 'Document not found');
      const { data, error } = await storageClient()
        .storage.from(process.env.STORAGE_BUCKET || 'tickets')
        .createSignedUrl(d.storagePath, 60, { download: d.name });
      if (error) throw Error('Document unavailable');
      return { url: data.signedUrl };
    });
  });
}
