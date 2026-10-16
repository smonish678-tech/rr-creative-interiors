# RR Creative Interiors — Fully customised interiors, thoughtfully priced

A light editorial website and admin workspace for RR Creative Interiors, with a position built around fully customised interiors, considered budgets and clear project scope.

## Current implementation
- Warm light editorial palette with clay, ink and restrained brass accents.
- Scroll-led eight-scene hero; each image can be replaced from the admin portal.
- Copy focused on bespoke scope, budget priorities and clear decisions rather than discount language.
- Responsive desktop/tablet/mobile navigation and reduced-motion support.
- Services, process, testimonials, journal, contact and local-business SEO.
- Admin overview, lead pipeline, invoice/cash receipt UI, portfolio media manager and a Website & brand asset portal.

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


## Website & brand assets

Use **Admin → Website & brand** to replace the public website's horizontal logo, brand mark/favicon and photo slots. The portal manages:
- Primary logo and brand mark.
- All eight scroll-hero scenes.
- Main living, kitchen and bedroom photography.
- Proportion, material, lighting and material-palette imagery.

Images are uploaded to Vercel Blob, and the selected URLs are saved in an encrypted manifest. Replacing a photo in this portal changes the live site without a code deployment. Layout, typography or copy edits still require a deployment.

Use **Admin → Portfolio library** for actual project photos or videos shown in the portfolio gallery. Once published gallery items exist, they replace the bundled reference gallery rather than being mixed with it. Do not describe a visual reference as a completed RR project.

## Brand positioning

Core promise: **Fully customised interiors, thoughtfully priced.** The copy explains how the work is tailored to each brief, how choices are prioritised around a budget, and why scope/material/finish decisions should be agreed before execution. It intentionally avoids “cheap”, unsupported fixed-rate claims, and unverified delivery/warranty promises.
