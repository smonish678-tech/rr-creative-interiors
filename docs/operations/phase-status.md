# RR Creative Interiors operations build — phase status

**Audited branch:** ops/phase0-1-foundation  
**Audited source baseline:** main at 5dd2846695695c98fe6d5ddc1c2f71975d1be269  
**Current scope:** operations control added incrementally to the existing Next.js admin; this does not replace the public website.

## Status matrix

| Phase | Status | Delivered | Still required before the phase can be called complete |
|---|---|---|---|
| 0 — source and policy audit | **Partially complete / blocked by source inputs** | Issue register lists quote, payment terms, beneficiary, tax, cancellation, delivery and warranty inconsistencies with approval owners. | RR must reattach the quotation and warranty workbooks for formula/cell reinspection. RR, CA and Legal must approve the unresolved commercial terms recorded in the issue register. |
| 1 — CRM and finance safeguards | **Foundation implemented; release validation ongoing** | Canonical customer linkage, server-side won-stage checks, signed-contract and verified-advance evidence checks, receipt-awaiting-verification default, immutable invoice history, allocation/total/pending caps, optimistic workspace revisions, audit events and automated tests. | The single encrypted Blob workspace is still not a transactional database. Confirm ifMatch in production and run concurrent-write, recovery and backup/restore tests before relying on it as an accounting ledger. |
| 2 — documents and commercial policy | **Workflow implemented; operational configuration required** | Versioned PDF metadata, authenticated document downloads, private Blob upload endpoint, evidence reference capture, commercial policy drafts with percentage checks, staged RR → CA → Legal review records. | Create a separate **private** Vercel Blob store and set OPERATIONS_PRIVATE_BLOB_READ_WRITE_TOKEN for Preview and Production. Obtain actual signed evidence from each authorised reviewer. The app records admin-supplied identity/evidence and does not independently authenticate signers. |
| 3 — project/site and production controls | **Core gated lifecycle implemented** | Winning an eligible sale creates a blocked project and site record; site address must be confirmed; milestone transitions proceed one step at a time and check for linked supporting evidence. | End-to-end user acceptance tests with real project records, customer-confirmed address, approved quotation/design, production specification/QC and production-completion documents remain required. |
| 4 — installation, handover and warranty | **Evidence gates implemented; policy and templates blocked** | Installation sign-off, customer handover acceptance and warranty certificate evidence are required to pass later milestones. | RR/Legal must approve the blank warranty master and category coverage/exclusions. Validate certificate fields and date calculation against the actual approved template before generating customer documents. An uploaded PDF is evidence; automated certificate generation is not implemented. Warranty claim/service-case tracking is not implemented. |
| 5 — production-grade rollout | **Not complete** | Branch checks and preview deployment signal are available through GitHub/Vercel integration. No production branch change is made by this branch. | A relational database/transactional model, role-separated RR/CA/Legal authentication, migration strategy, private-storage setup, security review, integration/UAT, backup/restore tests and authorised production release are outstanding. Vercel team API access must also be granted to this assistant connection to inspect/promote production directly. |

## Release controls

- Do not merge to main based only on unit tests or a successful build.
- Do not create an approved payment policy, quote, works contract or warranty master without its external decision and source evidence.
- Do not treat a saved receipt as bank settlement. The current verification route records manual reconciliation evidence; it does not query a bank/gateway.
- Private document uploads must fail closed until the separate private-store token exists; never switch customer contracts to the public media store as a fallback.
- After environment setup and source decisions are resolved, run the existing CI suite plus a realistic admin UAT checklist against Preview before production promotion.
