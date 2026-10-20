# RR Creative Interiors — Beyond The Ordinary

Premium, conversion-focused website and admin workspace for RR Creative Interiors.

## Current implementation
- Cinematic/morphing hero, scroll reveal and restrained hover depth.
- Responsive desktop/tablet/mobile navigation and reduced-motion support.
- Services, process, testimonials, journal, contact and local-business SEO.
- Admin overview, lead pipeline, invoice/cash receipt UI and portfolio media manager.

## Sahya Greens motion references
The RR site retains its own RR visual language while using the same interaction vocabulary as the Sahya Greens source: Lenis smooth scrolling, composed staged reveals, subtle image depth, responsive buttons, and reduced-motion behavior. The existing RR hero remains the centerpiece.

## Admin workspace and portfolio uploads

The portfolio manager is available at `/admin`. It supports multi-file photo/video uploads, project metadata, draft/publish controls, and delete. Published items appear in the website portfolio feed.

### Configure before production

Connect **two Vercel Blob stores** to the project:

1. **Public media store** — use its read/write token as `BLOB_READ_WRITE_TOKEN`. Photo/video assets in this store can be delivered directly to site visitors once published; upload URLs use random suffixes.
2. **Private metadata store** — create a separate **private** Blob store, then save its read/write token as `RR_PORTFOLIO_MANIFEST_BLOB_TOKEN`. The JSON manifest is kept here so the draft list and publication metadata are not exposed as a public URL.

Also set these server-side environment variables for both Preview and Production:
- `ADMIN_EMAIL` — the administrator login email.
- `ADMIN_PASSWORD` — a strong administrator password.
- `ADMIN_SESSION_SECRET` — a unique, high-entropy value used to sign secure HttpOnly sessions.
- `BLOB_READ_WRITE_TOKEN` — token for the public media store.
- `RR_PORTFOLIO_MANIFEST_BLOB_TOKEN` — token for the private metadata store.

Never use `NEXT_PUBLIC_` prefixes for credentials or session secrets. Do not commit actual secrets. The admin route is not ready for real use until these Vercel environment variables and both Blob stores are configured.


## Project Passport operations system (Phases 1–5)

The branch adds a persistent operations API and a new /admin/operations workspace. Do not use this workspace for real client or financial records until the database is connected and the migrations have been applied.

### Required Preview setup

1. Create a Neon PostgreSQL database (the application uses the serverless Neon driver).
2. Set server-only Vercel Preview environment variable DATABASE_URL to the Neon connection string.
3. Apply these SQL migrations in order:
   - db/migrations/001_operations.sql
   - db/migrations/002_website_leads.sql
   - db/migrations/003_lead_conversion_guard.sql
4. Connect a separate **private Vercel Blob store** for signed contracts and documents. Set RR_PRIVATE_DOCUMENTS_BLOB_TOKEN. Never store signed customer documents in a public Blob store.
5. Set CRON_SECRET to a long random secret. The daily Vercel cron processes pending workflow events and creates message drafts only; it does not send WhatsApp or email automatically.
6. Verify /api/admin/operations/health from an authenticated admin session returns ready. Run a test enquiry, verify it appears in Enquiries, convert it once, generate a draft, upload a test signed PDF, export a backup, and validate that backup before any production cutover.

### What the operations layer covers

- Canonical customer/contact/project/lead records, duplicate checks, versioned quotes, payment milestones, transactions, documents, approvals, tasks, events, production checklists, warranties and warranty claims.
- Public website enquiry POST to /api/enquiry with an idempotency key, duplicate-aware customer reuse, a follow-up task and event. If storage is unavailable, the website preserves WhatsApp as a fallback and does not claim the enquiry was saved.
- Server-side quote arithmetic and payment-milestone sum validation; issuing a quote is blocked until the approved commercial policy exists.
- Project stage transitions enforced server-side; the admin UI cannot bypass required checks.
- Private signed-PDF storage with SHA-256 hash and audit log; public approval links are expiring, single-response acknowledgements. These approval links are not represented as qualified electronic signatures for works contracts.
- WhatsApp/email message drafts, idempotent event processing, retry/dead-letter tracking and explicit manual sent/failed outcomes.
- Production/QC/site-readiness/installation/snag/handover checklists, warranty claim triage tasks, operational reporting and authenticated JSON export/restore-structure validation.

### Phase 0 blockers

Read docs/PHASE0-OPEN-DECISIONS.md before enabling production document issuance. In particular, the quotation workbook has a broken formula at Estimate!F59 and a conflicting payment schedule in Estimate!B94 and rows 260–264. The warranty workbook contains prefilled customer data. Contract, tax and warranty language must be approved by RR and its CA/legal reviewer; the application intentionally does not guess those rules.

### Data handling and recovery

DATABASE_URL, ADMIN_* values, RR_PRIVATE_DOCUMENTS_BLOB_TOKEN and CRON_SECRET are server-only. Do not use NEXT_PUBLIC_ prefixes. Backups contain personal and financial data and must be stored with restricted access. The JSON restore endpoint is validation-only and never overwrites live data. Rehearse a database restore against a separate database before production.
