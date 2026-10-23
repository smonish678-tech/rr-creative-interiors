# RR Creative Interiors — Beyond The Ordinary

Premium, conversion-focused website and admin workspace for RR Creative Interiors.

## Current implementation
- Light editorial palette with an eight-scene image-transition hero, restrained reveals and reduced-motion support.
- Brand-led copy built around fully customised interiors, thoughtful value and a clear agreed scope.
- Responsive navigation, residential and commercial services, design principles, working process, journal, enquiry capture and Bengaluru local-business SEO.
- Admin overview, connected lead pipeline, invoice/receipt workflow, portfolio manager and Website Studio for logo and section photography.

## Sahya Greens motion references
The RR site retains its own RR visual language while using the same interaction vocabulary as the Sahya Greens source: Lenis smooth scrolling, composed staged reveals, subtle image depth, responsive buttons, and reduced-motion behavior. The existing RR hero remains the centerpiece.

## Admin workspace and portfolio uploads

The admin workspace is available at `/admin`. The portfolio manager supports multi-file photo/video uploads, project metadata, draft/publish controls, and delete. Published items appear in the website portfolio feed.

### Configure before production

Connect one **public Vercel Blob store** to the project for portfolio photos and videos. Vercel adds its read/write token as `BLOB_READ_WRITE_TOKEN`. Portfolio media URLs use random suffixes, so unpublished items are not listed on the public site unless published through the admin workspace.

The portfolio manifest is encrypted with AES-256-GCM before it is written to the Blob store; the public URL contains ciphertext rather than draft titles, descriptions, or publication states. The encryption key is derived from the server-only Blob token, so the manifest is decrypted only inside server routes that have the token. Do not publish or expose the token.

Also set these server-side environment variables for both Preview and Production:
- `ADMIN_EMAIL` — the administrator login email.
- `ADMIN_PASSWORD` — a strong administrator password.
- `ADMIN_SESSION_SECRET` — a unique, high-entropy value used to sign secure HttpOnly sessions.
- `BLOB_READ_WRITE_TOKEN` — generated when the public Blob store is connected.

Never use `NEXT_PUBLIC_` prefixes for credentials or session secrets. Do not commit actual secrets. Redeploy after changing environment variables so the new deployment receives them.


## Website Studio — logos and section photography

After signing in at `/admin`, open **Website Studio**. Upload the new logo or real project photography (JPG, PNG, WebP, AVIF or HEIC, up to 30 MB per image), then assign each upload to the relevant slot. The portal supports:

- Main logo: website header, footer, favicon and organisation metadata.
- Eight scroll-story image beats in the opening hero.
- Living space, kitchen, bedroom and materials/finish images.
- Three designer-detail images for proportion, material and lighting.

Assignments are saved to an encrypted manifest in Vercel Blob. Only the selected image URLs are exposed by the public asset endpoint. Uploading a file does not change the public site until you assign it to a slot; existing images remain as fallback until the replacement is assigned. An image that is currently in use cannot be deleted until it is unassigned.

The separate **Portfolio library** remains the place to add completed project photos/videos to the gallery; use Website Studio when you want to choose which specific photo fills a particular website section.

## Brand copy direction

Lead with **“Fully customised interiors. Thoughtfully priced.”** The supporting message is that design starts with the person and the actual property, then makes purposeful decisions about layout, storage, materials and finishes against an agreed scope. Avoid bargain/cheap language and unsupported promises about fixed prices, timelines or warranties. Explain value through clear choices and scope, not discount language.


## Project Operations (Phases 1-5)

The protected **Project Operations** section inside `/admin` adds a linked Project Passport without changing the existing lead/invoice save format. Operations data is stored separately and encrypted with AES-256-GCM. A project links to a canonical CRM customer and one CRM lead; the API prevents a CRM lead being converted to more than one Project Passport.

### Phase 0 must be approved before final commercial documents or production

The policy starts deliberately **unapproved**. An initial quotation can be drafted and issued as a preliminary estimate, but its total is labelled indicative when tax policy is not approved. Final quotations, contract/invoice/receipt/warranty issuance and production stage transitions remain blocked until payment milestones sum to 100%, GST/tax fields, delivery trigger, warranty rules, contract/cancellation wording, CA review, legal/stamp-duty review and message templates are approved.

### Operations features

- Project lifecycle: Initial quotation, Booking, Design, Final sign-off, Production, Execution, Handover, Warranty, Closed; one-step transitions are enforced against server-side gate checks.
- Versioned quote records with subtotal reconciliation and preflight flags; draft documents generated from a project/customer/quote snapshot; print-to-PDF; signed PDF evidence stored in a **private** Blob store.
- Payment milestones with pending verification, transaction reference, independent-credit evidence and ledger-derived paid amounts. Verification generates a receipt draft; it is not automatically treated as tax-issued.
- Exact-version design/quote/contract approvals; tasks and dated QC/site/dispatch/installation/handover checklists; a separate communications queue with idempotency keys and manual WhatsApp/email sends; warranty registration and claims; overdue/document/policy reports.
- Authenticated JSON backup/restore for CRM and Project Passport. A daily encrypted snapshot is scheduled via Vercel Cron at approximately 01:00 Asia/Kolkata (Hobby Cron timing can vary by up to 59 minutes).

### Additional Vercel configuration

- Connect a separate **private Vercel Blob store** for signed project PDFs. Copy its read/write token into `RR_PORTFOLIO_MANIFEST_BLOB_TOKEN` for Preview and Production. Signed PDF uploads are limited to 4 MB per file in the current UI/server endpoint. If this variable is absent, signed-file upload fails safely and a document cannot be marked signed without external signature-envelope evidence.
- Set `CRON_SECRET` to a unique random value of at least 32 characters in Vercel Environment Variables. The daily backup endpoint rejects requests unless the bearer token matches this secret.
- The built-in WhatsApp/email queue prepares drafts, opens the official app/mail client and records the owner-confirmed status. It does not claim to auto-send; official API automation requires provider/account configuration.

Important: the operation store has a revision check for stale tabs, but Vercel Blob is still object storage, not a transactional relational database. It is appropriate for this single-owner pilot; if multiple people concurrently edit a project's money, contract or scope records, move these records to a database with transactional writes before enabling multi-user editing.
