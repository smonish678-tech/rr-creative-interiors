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

### Private operations documents

Create a **separate private Vercel Blob store** for contracts, signed approvals, quotations, production evidence and warranty documents. Do not reuse the public media store for customer documents. Configure the private store token as the server-only environment variable `OPERATIONS_PRIVATE_BLOB_READ_WRITE_TOKEN` in both Preview and Production. Never expose it with a `NEXT_PUBLIC_` prefix.

The Operations & documents area stores uploaded PDFs in private Blob storage and versioned metadata in the encrypted workspace. Downloads pass through the authenticated server route. Uploads are limited to PDFs up to 15 MB. If the private store token is missing, uploads fail closed rather than falling back to public storage.

### Operations control area

The admin navigation includes Operations & documents, with:
- Versioned commercial payment-policy drafts and percentage reconciliation before review.
- Sequential RR → CA → Legal review stages using uploaded signed approval PDFs and audit references. The application records submitted evidence; it does not independently validate the external signer's identity or digital signature, and all three reviews should be completed by the real authorised parties.
- Versioned private PDF evidence attached to leads, projects and policy records.
- Site-address confirmation and project milestone transitions guarded by linked evidence.
- Blocked project preflight by default; the control area does not manufacture missing approvals or resolve the open workbook, tax, legal or warranty decisions in the issue register.

**Storage limitation:** business metadata still lives in one encrypted Blob object. Revision checks and ETag conditional writes reduce stale overwrites, but this is not a relational database or an ACID accounting ledger. Treat this release as an operations foundation until a transactional database migration and concurrent-write/load tests are completed.


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
