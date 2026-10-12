# Verification record

Executed locally on 12 October 2026. All test inputs stored in the repository are fictional.

| Check                        | Result                                                                                                                                                                                                                           |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ESLint                       | Passed, no warnings after final source cleanup                                                                                                                                                                                   |
| TypeScript                   | Passed                                                                                                                                                                                                                           |
| Vitest                       | 38 passing tests across core, authentication and database suites                                                                                                                                                                 |
| PostgreSQL integration       | Both migrations applied to PGlite's real PostgreSQL engine; scoped CRUD, isolation, grants, cross-tenant constraints, stale updates, duplicate warnings, immutable ledgers, archive settlement and atomic rate limiting verified |
| PDF bytes → field comparison | 64/64 exact fields across five generated PDFs                                                                                                                                                                                    |
| Python evaluation tests      | 5 passed                                                                                                                                                                                                                         |
| Browser workflows            | 3 Playwright tests passed: navigation/themes/mobile, PDF import/manual amounts/customer prefill/payment/persistence/visitor isolation, and public API separation/CSRF                                                            |
| Production build             | Next.js optimized build succeeded                                                                                                                                                                                                |
| Production dependencies      | npm audit reported zero known vulnerabilities at the time checked                                                                                                                                                                |
| Visual review                | Desktop/mobile dashboard and all five sample PDF pages inspected                                                                                                                                                                 |

The browser PDF test checks customer name = Passenger 1, the labelled customer phone is filled, email stays blank, and both financial fields stay empty. It then edits customer details, enters manual amounts, verifies the ticket, creates a booking, records a partial payment, reloads and checks that another visitor's browser context cannot see the change.

The fixture result is exact-match regression coverage, **not a statistically representative extraction-accuracy estimate**. The three supplied agency PDFs were checked privately for parsing; the repository contains only newly generated fictional versions of the layouts. The samples are never used to seed the agency database.

Authentication tests mock Supabase identity validation and use server-owned membership records; they verify anonymous rejection, revoked/missing membership, distrust of user metadata and refusal of privileged runtime DB credentials. They do not prove email delivery or live provider behavior.

## Outstanding deployment acceptance

GitHub publication, both Vercel deployments, production Supabase migration/role wiring, invitation/recovery email delivery, real session lifecycle, managed private storage, signed URL expiry and backup restoration remain unexecuted because account connection was deferred by the owner. Follow DEPLOYMENT.md and use fictional staging data for those checks. No live deployment or real-business usage is claimed.

There is no claim that tests eliminate security risk or cover every airline format. Before real agency use, review the documented limitations and perform the managed-service acceptance checks.
