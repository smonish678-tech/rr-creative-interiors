# RR Creative Interiors — Instagram gallery setup

## What has been built

The homepage now includes a live photo/video section below the existing Portfolio Library.
It reads RR's published Instagram photos, videos/Reels, and carousel albums from Meta's official Instagram API.
Photos open in an on-site lightbox. Videos play on the website with native controls and muted, in-view autoplay where permitted by the browser.
It does **not** use external Instagram post links or embed frames.

New posts are fetched automatically after publication. The server caches the result for approximately 5 minutes, and the open page refreshes it every 5 minutes. New content normally appears within around 5–10 minutes, depending on Meta's availability/cache. A new website deployment is not needed for each Instagram post.

The existing manually managed portfolio remains unchanged and continues to work if Instagram is not connected or briefly unavailable.

## Activation (required once)

1. Use RR Creative Interiors' **Instagram Business or Creator** account. Personal accounts cannot use this API.
2. In Meta for Developers, create/configure an app with **Instagram API with Instagram Login**, add Business Login for Instagram, and authorize RR's Instagram account with **instagram_business_basic**. Use a long-lived Instagram User access token (server-side).
3. In Vercel project rr-creative-interiors → Settings → Environment Variables, add:
   - INSTAGRAM_ACCESS_TOKEN — long-lived Instagram User token. **Secret: never prefix with NEXT_PUBLIC_ or commit it.**
   - INSTAGRAM_USER_ID — optional account ID; if omitted, the API calls /me/media.
   - INSTAGRAM_GRAPH_API_VERSION — optional; defaults to v27.0.
4. Apply the variables to Preview/Production as appropriate, redeploy once to load them, and visit the website. If no token is set, the gallery stays hidden rather than showing fake content.
5. Publish a new Reel, video, photo, or carousel to RR's connected account; verify it appears on the website after the refresh interval.

## Maintenance and edge cases

- Long-lived Instagram tokens are time-limited (typically around 60 days). Set up a token renewal/reauthorization process before expiry; this initial integration does **not** automatically rotate credentials.
- The Instagram API has availability/rate limits. A temporary error leaves the existing gallery on the currently open page and does not affect the Portfolio Library.
- Browser autoplay rules require muted playback for automatic video start. Visitors can use native controls to play/pause or unmute.
- Meta media URLs are served from Meta's media CDN; do not cache them indefinitely or hard-code them. This integration fetches new URLs from the API on cache expiry.
- Posts must be owned and available through the authorized account. Stories, private third-party posts, and media excluded by Meta are not guaranteed.
- For long-term media durability independent of Meta's CDN, add a background archive of consented media to Vercel Blob later.
- Verify in both mobile and desktop browsers after connecting the account.

Official Meta reference:
https://developers.facebook.com/docs/instagram-platform/reference/instagram-media/
