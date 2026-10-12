import { loadEnvConfig } from '@next/env';
import postgres from 'postgres';
import { z } from 'zod';
loadEnvConfig(process.cwd());
// Provision authentication in Supabase first. This CLI binds a verified auth UUID to an agency.
async function main() {
  if (process.env.APP_MODE !== 'agency' || !process.env.MIGRATION_DATABASE_URL)
    throw Error('Agency migration environment required');
  const userId = z.uuid().parse(process.env.ADMIN_USER_ID),
    name = z.string().min(2).max(100).parse(process.env.ADMIN_NAME),
    agencyName = z.string().min(2).max(100).parse(process.env.AGENCY_NAME),
    role = z.enum(['admin', 'staff']).parse(process.env.MEMBER_ROLE || 'admin');
  const db = postgres(process.env.MIGRATION_DATABASE_URL, { max: 1, prepare: false });
  try {
    await db.begin(async (tx) => {
      const [authUser] = await tx`select id from auth.users where id=${userId}`;
      if (!authUser) throw Error('Create this user in Supabase Auth first');
      let agencyId = process.env.EXISTING_AGENCY_ID;
      if (agencyId) z.uuid().parse(agencyId);
      else {
        if (role !== 'admin') throw Error('First account must be an administrator');
        const [agency] = await tx`insert into agencies(name) values(${agencyName}) returning id`;
        agencyId = agency.id;
      }
      await tx`insert into memberships(user_id,agency_id,name,role) values(${userId},${agencyId!},${name},${role})`;
      console.log('Membership created. Agency ID: ' + agencyId);
    });
  } finally {
    await db.end();
  }
}
main().catch(() => {
  console.error(
    'Onboarding failed. Verify the auth UUID, role, agency ID and migration connection. No credentials are printed.',
  );
  process.exitCode = 1;
});
