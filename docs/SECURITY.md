# Security and operations

Private agency deployment remains pending configuration and live integration checks. Start with fictional staging records before approving business use.

## Implemented controls

- Server-verified Supabase user plus active membership on every protected data endpoint.
- No public registration endpoint; signup disabled in the provider configuration.
- Admin-only refunds, financial adjustments, archives and audit viewing. Staff can create/edit booking details and record payments.
- Exact-origin checks on mutations, HttpOnly/SameSite cookies, HTTPS Secure cookies in production and no-store private responses.
- Parameterized Drizzle queries, Zod validation, escaped React rendering, CSV formula neutralization and bounded request/PDF input.
- Explicit agency filters, transaction-local RLS context, composite tenant foreign keys and a restricted non-owner database role.
- Immutable original financial records, cash/adjustment rows and audit records, with conflict/version handling and transaction locks.
- Private object paths and authorized 60-second attachment URLs. No direct browser storage credentials.
- Database-backed minute rate limits for auth and write endpoints, plus Supabase's native auth throttling.
- Security headers and a CSP limiting network, worker and frame sources. Next's current configuration still permits inline scripts/styles; nonce-based hardening is a future improvement, not claimed here.

## Administration

Use independent demo/staging/agency deployments and credentials. Do not set privileged migration credentials in Vercel. Restrict access to the Supabase service-role key and rotate it if exposed. App role credentials, membership identity context and storage service credentials are trusted server material; RLS does not protect against complete server compromise.

Review provider authentication failures and generic application error events without logging request bodies, tickets or passenger/contact details. Signed URL query strings are sensitive and should not be retained in access logs. For a security incident revoke memberships/sessions, rotate affected keys, preserve relevant audit metadata and investigate provider access logs.

Application rate limits are an additional control, not DDoS protection; use platform edge protections and provider quotas for internet abuse. Recovery intentionally gives a generic response to avoid revealing account existence. Configure actual SMTP delivery and verify it in staging.

## Backups and recovery

Choose an agency-specific retention schedule. Enable managed database backups/PITR when available on the chosen plan; do not assume a free tier includes the desired recovery window. Keep encrypted periodic logical exports in a private controlled destination. Back up private object storage separately and retain the document ID/path mapping.

Test restoration into an isolated staging database and bucket at least after schema changes. Verify row counts, ledger totals, customer/booking relationships, membership access and document retrieval before declaring a restore successful. Set recovery-point and recovery-time objectives with the agency; this application does not invent them.

Archive preserves financial history and is not an erasure mechanism. Personal-data correction, deletion and legal retention decisions require an authorized administrative procedure covering customers, passengers, documents, backups and provider auth. Record and review that operation; never run an unreviewed cascading deletion in production.

Storage upload and database commit cannot be one distributed transaction. A failed metadata insert triggers best-effort removal of the newly uploaded object; infrastructure/commit failures may still leave an orphan. Reconcile bucket objects against document metadata periodically using a trusted administrative environment. Do not make buckets public to solve download issues.

## Not yet verified with managed services

Real email invitation/recovery delivery, live session refresh and logout, deployed Supabase role/pooler configuration, private object retention/signed downloads and backup restoration require connected accounts. Local tests validate application logic and an actual embedded PostgreSQL engine; they do not prove every provider setting is correct.
