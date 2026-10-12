# Delivery milestones

| Milestone | Implemented code | Verification |
|---|---|---|
| 1 — Data model and bookings | Normalized Drizzle schema, constraints, migrations, transactional booking creation/update/archive, responsive workspace | PostgreSQL-engine CRUD/isolation/version tests and browser creation/edit forms |
| 2 — Documents and customers | Three parser families, PDF.js worker, side-by-side review, customer defaults, five synthetic PDFs and customer history | Actual PDF-byte comparison; multi-passenger/segment and phone-label tests; browser manual-amount/verification flow |
| 3 — Financial reporting | Decimal-safe prices, immutable cash ledger and adjustments, KPI/route/month reports, filters and CSV exports | Money, balance, refund/adjustment, grouping and CSV-injection tests |
| 4 — Descriptive intelligence | RFM groups, concentration, repeat behavior, first-route/airline profit, margin bands and explainable record anomalies | Deterministic synthetic-data and analytics unit tests; browser navigation |
| 5 — Forecasts and simulation | Monthly baselines, rolling validation/holdout, Python reproduction and what-if inputs | No-leakage/zero-history tests; measured JSON reports; independent Python scores |
| 6 — Agency isolation and release preparation | Server-side identity/membership, protected endpoints, role/RLS boundaries, rate limits, private-storage handlers, recovery UI, CI and deployment docs | Auth-boundary tests, restricted-role PostgreSQL tests, demo endpoint/CSRF browser tests, lint/typecheck and optimized build |

Live GitHub/Vercel publication and Supabase-provider acceptance were deferred at the owner's request. All private-service configuration and verification steps are documented; they are not represented as completed deployments. Advanced ML, OCR, FX conversion and period-close accounting remain documented limitations.
