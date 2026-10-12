# RR Creative Interiors Admin Workspace

Admin workspace route: `/admin`.

The current prototype includes a dashboard, a lead pipeline, invoice and cash receipt forms, document print-to-PDF, and prefilled Gmail compose drafts. This route still needs server-backed authentication and database integration before production use. The current UI prototype uses browser session state and example data; it does not yet ingest website enquiries or store client accounts persistently.

## Production checklist

- Implement an authentication endpoint with server-only secrets and secure, HttpOnly session cookies.
- Connect leads to persistent storage and wire the public enquiry form to create CRM records.
- Store invoice and receipt records in persistent storage and configure invoice numbering.
- Add a server-generated PDF attachment/email delivery integration if emails should send with an attached PDF automatically. Browser compose links require the user to attach the saved PDF manually.
- Configure `ADMIN_EMAIL`, `ADMIN_PASSWORD` (or hashed password), and `ADMIN_SESSION_SECRET` as server-side environment variables; never expose them as `NEXT_PUBLIC_*` variables.
