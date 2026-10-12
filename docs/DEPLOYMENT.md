# Local setup and two Vercel deployments

The repository was built locally. No remote repository or deployment has been created. The following steps require the owner's accounts. Keep credentials in local ignored environment files or provider dashboards, never in chat or source code.

## Public demo

1. Create an empty GitHub repository and push this directory's source (exclude node_modules, .next and local environments). Review staged filenames before the first push.
2. Import that repository into a Vercel project named, for example, `traveliq-demo`. Select Next.js, Node 24, install command `npm ci`, build command `npm run build` and the default output directory.
3. Set `APP_MODE=demo` and `APP_URL=https://YOUR-DEMO-HOST`. Do not attach Supabase integrations, shared production environment groups, database URLs or any agency keys.
4. Deploy. Check `/api/bookings`, `/api/documents`, `/api/audit` return 404; create a fictional booking, reload, reset the demo and test all sample PDFs.
5. Add the returned URL to the README and GitHub repository description. The demo needs no database or object store.

Optional Git commands, after configuring your own Git name/email:

```sh
git init -b main
git add .
git diff --cached --stat
git commit -m "Build TravelIQ agency and portfolio workspace"
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```

## Private Supabase project

1. Create a **separate agency Supabase project** in your chosen region. Never use it for public demo or untrusted preview builds.
2. In Auth, disable new user signup and anonymous sign-in. Configure the exact agency Site URL and allowlist its `/auth/callback` redirect. Set a minimum password length of at least 12 and configure SMTP, recovery rate limits and session policies appropriate to the agency. Protect Supabase/Vercel administrator accounts with MFA.
3. Copy `.env.agency.example` to ignored `.env.local`. Fill SUPABASE_URL, server-only SUPABASE_ANON_KEY, server-only SUPABASE_SERVICE_ROLE_KEY, APP_URL and a **privileged direct/session migration connection** in MIGRATION_DATABASE_URL. The service-role key is used only for private storage in server code. It must never be prefixed NEXT_PUBLIC_.
4. Run `npm run db:migrate` using a trusted owner/migrator with BYPASSRLS capability (Supabase's administrative connection). This applies checksummed, transactionally locked migrations and creates `traveliq_app` as NOLOGIN with restricted grants.
5. In Supabase's SQL editor, provision a long random password and enable login on that role. Do not save the literal password in a script:

```sql
ALTER ROLE traveliq_app WITH LOGIN PASSWORD 'REPLACE_WITH_RANDOM_SECRET';
ALTER ROLE traveliq_app SET statement_timeout = '15s';
ALTER ROLE traveliq_app SET idle_in_transaction_session_timeout = '20s';
```

6. Set DATABASE_URL to the managed PostgreSQL **transaction pooler** using the restricted role. Supabase pooler usernames commonly include the project reference (`traveliq_app.PROJECT_REF`); use the provider's connection instructions and URL-encode the password. Keep `sslmode=require`; postgres.js disables prepared statements for pooler compatibility. On direct connections, use the plain role name. The request guard checks `current_user = traveliq_app` and refuses privileged application connections.
7. Create a private Storage bucket called `tickets`; set a 4 MB file limit and allow only `application/pdf`. **Public must be off.** Do not create public/anonymous read policies. The server service-role client uploads and signs downloads after application authorization. Database backups do not replace object backups.

## Initial administrator and staff

Create or invite a user using the Supabase Authentication dashboard. Copy its authentication UUID, then set temporary local variables and run the bootstrap CLI:

```powershell
$env:ADMIN_USER_ID='AUTH_USER_UUID'
$env:ADMIN_NAME='Agency administrator'
$env:AGENCY_NAME='Your agency name'
npm run db:bootstrap
```

The CLI verifies the user exists in `auth.users`, creates an empty agency and grants admin membership. It does not create synthetic business records. Save the returned agency UUID in your administrative records. Variables contain identifiers only; never pass a password in command arguments.

For additional staff, create/invite their Supabase user first, set `EXISTING_AGENCY_ID`, `ADMIN_USER_ID`, `ADMIN_NAME`, `AGENCY_NAME` and `MEMBER_ROLE=staff`, then rerun the CLI. Invitations are sent through Supabase, not by an unauthenticated application endpoint. For another administrator set `MEMBER_ROLE=admin`. To revoke application access, set that membership's `active=false` using the trusted database administration interface; every request checks it.

For email invitations and recovery links, configure Supabase templates to point to the application's server verification route, using Supabase's actual template variables:

```text
Invitation: {{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=invite
Recovery:   {{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery
```

The callback also accepts PKCE `code` exchanges. It redirects to the authenticated password-setting page after verification. The user must already have an active membership to use that page. Complete membership onboarding before the user opens the invite.

## Private Vercel project

Import the same GitHub repository again as `traveliq-agency`. Use Node 24 and the same install/build commands. Set **only in this project's production environment**:

```text
APP_MODE=agency
APP_URL=https://YOUR-AGENCY-HOST
DATABASE_URL=restricted pooled connection
SUPABASE_URL=agency project URL
SUPABASE_ANON_KEY=agency project publishable/anon key
SUPABASE_SERVICE_ROLE_KEY=server-only storage key
STORAGE_BUCKET=tickets
```

Do **not** install MIGRATION_DATABASE_URL in Vercel; the build explicitly rejects it there. Migrations are a deliberate pre-deploy step using a trusted environment, not an operation performed by web requests. Back up before schema changes. Review generated schema migrations before applying them; the explicit RLS/security migration remains authoritative.

Use a separate staging Supabase project with fictional data for agency preview deployments. Do not inherit production secrets into pull requests or fork builds. APP_URL must match the intended deployment origin exactly; a custom domain therefore needs an updated APP_URL and Supabase redirect allowlist. Test before routing the live domain.

## Required live acceptance checks

- Anonymous requests cannot read pages, APIs or storage objects. Do not test with real documents initially.
- Admin and staff can sign in/out; recovery and invite links work once and expire correctly; revoked members lose data access.
- Staff cannot refund, adjust or archive; admin can. Original charges remain immutable.
- Two fictional agencies cannot read or mutate each other's booking/document UUIDs, including direct requests.
- A real PostgreSQL migration and restricted-role smoke test succeeds. Repeat a failed migration safely; modified applied files are rejected.
- A fictional PDF uploads only after choosing retention, its bucket URL is not public, its download link expires, and expired sessions cannot mint new links.
- Cross-origin writes fail. Rate limiting works across serverless invocations.
- Backup and object restoration is exercised into a separate project, not over production.

These managed-service checks remain unexecuted until accounts are connected. The local PostgreSQL-engine and mock-auth tests do not replace them.

## Troubleshooting

**Demo build refused:** remove every private env key, including empty provider integrations that inject database credentials. Use separate Vercel projects.

**Sign-in fails:** verify signups are disabled but the user already exists, membership is active, email/password are correct and Supabase SMTP/session settings are valid. No application registration endpoint exists.

**Origin rejected:** match APP_URL with the browser origin, including protocol and port. Use `http://localhost:3000` consistently for local agency work; do not browse the numeric loopback origin with a different APP_URL.

**Restricted role error:** DATABASE_URL is using the owner/pooler default account. Switch it to traveliq_app, not MIGRATION_DATABASE_URL.

**PDF not extracted:** inspect warnings; confirm selectable text, supported layout, <=4 MB and <=20 pages. Enter missing fields manually. The three parser families are conservative.

**Booking saved but PDF missing:** retry attachment in Documents. Storage is a separate managed-service operation; a saved booking is retained if upload fails. Audit and reconcile unreferenced storage objects after infrastructure failures.

**Windows sandbox path errors during build:** run `npm run build` in an ordinary local terminal with access to the project directory. This is a local sandbox/Next compiler interaction, not an application runtime requirement.

References checked for implementation: [Next.js installation](https://nextjs.org/docs/app/getting-started/installation), [Supabase server authentication](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [Vercel function limits](https://vercel.com/docs/functions/limitations). Vercel's documented request limit is 4.5 MB, so the application uses a 4 MB PDF cap with room for upload metadata.
