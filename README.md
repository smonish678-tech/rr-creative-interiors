# RR Creative Interiors — Beyond The Ordinary

Premium, conversion-focused static website for RR Creative Interiors.

## Current implementation
- Full-screen shader morph hero using remote Unsplash imagery.
- Three.js abstract 3D "RR Standard" section.
- Responsive desktop/tablet/mobile navigation.
- Scroll reveal, subtle tilt, progress indicator and reduced-motion support.
- Services, process, testimonials, journal, contact and local-business SEO.
- Real contact details sourced from the official RR Creative Interiors website.

## Replace the temporary visual references
The current interior photography is visual reference material, not RR project photography.

When RR project photography is ready:
- Hero: replace the URLs in the heroImgs array inside index.html.
- Space gallery: replace the three img source URLs in the spaces section.
- Keep the "Visual Reference" labels only until real RR work replaces the imagery.

Suggested asset folders for future migration:
- /assets/hero/
- /assets/projects/
- /assets/services/
- /assets/studio/
- /assets/clients/
- /assets/brand/

## SEO
The site includes:
- title/description/keywords/canonical
- Open Graph/Twitter metadata
- robots.txt
- sitemap.xml
- InteriorDesigner JSON-LD with the current RR business contact information

Ranking for a query such as "best interiors in Bangalore" cannot be guaranteed by code alone. The implementation gives Google the basic technical and local signals; continued content, citations, links, reviews and a strong Google Business Profile are still required.


## Admin workspace — media uploads

The portfolio manager is available at `/admin`. It supports multi-file photo/video uploads, project metadata, draft/publish controls, and delete. Published items appear in the website portfolio feed.

Before enabling the admin on production, configure these server-side Vercel environment variables for both Preview and Production:
- `ADMIN_EMAIL` — the administrator login email.
- `ADMIN_PASSWORD` — a strong administrator password.
- `ADMIN_SESSION_SECRET` — a unique, high-entropy value used to sign secure HttpOnly sessions.
- `BLOB_READ_WRITE_TOKEN` — created by connecting a Vercel Blob store to the project.

Do not use `NEXT_PUBLIC_` prefixes for credentials or session secrets. The media library persists metadata in a JSON manifest in Vercel Blob and stores image/video files in the same Blob store. Public portfolio URLs are public by design once an item is published.
