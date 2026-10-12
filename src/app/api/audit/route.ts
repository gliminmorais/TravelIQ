import { actor, endpoint, HttpError } from '@/lib/server';
import { scoped } from '@/db/repository';
import { auditLogs } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
export async function GET() {
  return endpoint(async () => {
    const a = await actor();
    if (a.role !== 'admin') throw new HttpError(403, 'Administrator access required');
    return scoped(a, (tx) =>
      tx
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.agencyId, a.agencyId))
        .orderBy(desc(auditLogs.createdAt))
        .limit(100),
    );
  });
}
