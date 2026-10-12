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
