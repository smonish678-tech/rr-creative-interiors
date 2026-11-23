# RR Creative Interiors — release/UAT checklist

Use a Preview deployment and non-customer test data. A successful build is necessary but not a substitute for these checks.

## 1. Deployment and configuration

- [ ] Confirm the Preview is associated with the expected feature-branch commit.
- [ ] Confirm ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_SESSION_SECRET, and BLOB_READ_WRITE_TOKEN exist only as server-side environment variables.
- [ ] Create a dedicated private Vercel Blob store, configure OPERATIONS_PRIVATE_BLOB_READ_WRITE_TOKEN in Preview and Production, and verify the store is set to private in Vercel.
- [ ] Confirm a signed-out request to every operations, payment verification, workspace save and document download route returns HTTP 401.
- [ ] Confirm a signed-in user can upload a valid PDF under 4 MB and download it through the authenticated route; confirm a public URL does not expose it.
- [ ] Confirm a non-PDF, empty file, file over 4 MB and missing private-store token are rejected without a public-store fallback.
- [ ] Confirm environment changes are deployed before declaring private uploads available.

## 2. CRM and financial invariants

- [ ] Save a lead and customer; verify the customer association uses a stable ID and conflicting email/phone matches are sent for human review.
- [ ] Attempt to move a lead to Won without each requirement in turn: canonical customer, confirmed site location, signed versioned contract evidence, verified advance transaction and approved policy milestone. Each attempt must be rejected server-side.
- [ ] Create a receipt and confirm it defaults to Awaiting verification and does not reduce the invoice balance.
- [ ] Verify an eligible receipt once using the actual bank/gateway reconciliation reference; confirm the invoice allocation changes once and the CRM advance becomes eligible only when its approved policy/milestone matches.
- [ ] Retry the same verification reference; confirm the operation is idempotent. Try a different reference against the same verified receipt; confirm the update is rejected.
- [ ] Try an over-allocation, mismatched customer/opportunity/project, duplicate record ID and an edited historical invoice field. Each must be rejected.
- [ ] Open two admin sessions, save in session A, then submit an older revision from session B. Confirm HTTP 409 and that no newer data is overwritten.

## 3. Commercial policy and documents

- [ ] Create a draft policy; confirm total percentages can be reviewed but cannot be submitted unless they total 100% and include a booking-advance milestone.
- [ ] Submit for review and try recording RR, CA and Legal approval out of sequence; confirm only the currently requested stage is accepted.
- [ ] Upload a signed approval PDF with its real external approval evidence, signer name/email, signed date and signature/audit-trail reference. Confirm the workspace says the app records supplied evidence and does not independently authenticate the signer.
- [ ] Confirm approved policy versions are immutable for the purposes of receipts; later terms require a new version and cannot retroactively alter a verified receipt's history.
- [ ] Upload successive document versions; confirm previous versions remain downloadable to an authenticated admin and the current contract pointer uses the newly signed version.

## 4. Project lifecycle

- [ ] Qualify a test sale with contract and verified advance evidence; confirm only one blocked project/site is created.
- [ ] Confirm exact customer/site address; attempt an unapproved overwrite and confirm the API rejects it.
- [ ] Try each project milestone transition with evidence missing and with evidence attached to another project. Confirm it is rejected.
- [ ] Confirm production requires approved quotation, signed design approval, production specification and production QC evidence.
- [ ] Confirm the next phases require production completion, installation sign-off, customer handover acceptance and warranty certificate evidence in order.
- [ ] Confirm each successful transition generates a server-side audit record.

## 5. Owner / CA / Legal acceptance

- [ ] RR supplies and rechecks the quotation and warranty workbooks listed in the Phase 0 issue register.
- [ ] RR resolves the 105% / zero-amount payment schedule discrepancy and confirms the correct legal beneficiary.
- [ ] CA approves supply classification, GST/HSN/SAC treatment, tax fields, rounding, logistics and extra-fee presentation.
- [ ] Legal and RR approve coherent contract, cancellation/refund, delivery timeline, liability and warranty master wording.
- [ ] Obtain written sign-off for the migrated live data, security model, private document store and rollback/backup plan.

## Release decision

Do not promote to production while Phase 0 policy/source decisions, private document storage setup, role-separated approval controls, database reliability work, or the required acceptance tests remain open.
