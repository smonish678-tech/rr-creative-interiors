Build the RR Creative Interiors website in this repository from the ground up.

REPO
- GitHub: smonish678-tech/rr-creative-interiors
- The repository is currently empty, so initialize the project rather than assuming an existing app.
- Use Next.js + TypeScript + Tailwind CSS + shadcn/ui conventions.
- Keep the implementation production-ready, responsive, accessible, and optimized for Vercel.
- Do NOT make frequent small commits. Finish the complete implementation, verify it, then make ONE consolidated commit.

BRAND
RR CREATIVE INTERIORS
Use the uploaded RR logo as the primary brand reference. The uploaded assets are:
1. Glossy red/gold split emblem
2. RR Creative Interiors logo lockup
Use the red + metallic gold + deep brown/black palette from the logo, but keep the overall site restrained and sophisticated. Gold should be an accent, not a flood of gold.

TYPOGRAPHY
- Primary editorial/display font: Playfair Display.
- Pair it with a sophisticated clean sans-serif such as Manrope, Inter, or Geist Sans for navigation, labels, body copy, buttons, forms, and supporting text.
- Use typography as a major visual element: strong contrast between elegant serif headlines and precise modern sans-serif UI.

OVERALL CREATIVE DIRECTION
The website should feel like a high-end interior design studio rather than a generic local business website.
Visual references in spirit: luxury editorial, architectural magazine, premium hospitality, refined Indian contemporary interiors.
Think: quiet luxury, cinematic spacing, tactile materials, sophisticated photography, precise typography, restrained animation.
Avoid: generic gradients, loud glassmorphism, excessive rounded cards, template-looking sections, clutter, stock-looking illustrations, cheap gold effects, excessive shadows.

PRIMARY BUSINESS GOAL
The website is a conversion-focused portfolio for RR Creative Interiors.
Optimize the experience to:
1. Make visitors immediately understand the studio's premium positioning.
2. Keep visitors engaged and exploring the work.
3. Create repeated, natural calls-to-action.
4. Make calling the studio extremely easy on mobile.
5. Build enough trust that a qualified visitor feels comfortable contacting RR Creative Interiors.
Do not use fake awards, fake testimonials, fake project counts, fake clients, or unsupported claims.
Where business facts are missing, use clearly editable placeholder copy rather than inventing facts.

OPENING / HERO
The opening of the website MUST use the uploaded Morph Gallery component from the supplied prompt as the foundation for the hero visual.
Implement the supplied `MorphGallery` component at:
- /components/ui/morph-gallery.tsx
Preserve its WebGL morph/noise transition behavior and its fallback behavior.
Do not replace it with a normal carousel.
The hero should feel cinematic and premium:
- full viewport / near full viewport
- interior project images morphing slowly into one another
- subtle dark cinematic overlay/gradient where required for text legibility
- restrained copy over the visual
- premium navigation above it
- clear primary CTA and secondary CTA
- the logo should feel integrated, not pasted on top
- no cheesy animations
The first 2–3 seconds should feel like an editorial luxury reveal.

HERO COPY
Use polished placeholder copy that communicates interior design, architecture/interiors, craft, and transformation without making unverifiable claims.
Suggested direction, not mandatory exact wording:
"Spaces, considered beautifully."
"Interior environments shaped around how you live."
CTA examples:
"Book a Design Consultation"
"Explore Our Work"
The phone CTA should become highly prominent on mobile once phone number is supplied.

NAVIGATION
Create a minimal premium navigation:
- logo
- Work / Projects
- About
- Services
- Process
- Contact
- persistent CTA such as "Start a Project"
On mobile use a refined full-screen menu or elegant sheet, not a default hamburger dropdown.
Keep header behavior polished on scroll: transparent over hero, then subtly solid/blurred after scroll.

SITE STRUCTURE
Create a one-page, high-retention home experience with anchor navigation and room for future inner project pages.

Recommended flow:
1. Hero / Morph Gallery
2. Intro / Studio statement
3. Featured Projects / portfolio
4. Design philosophy / what makes RR different
5. Services
6. Process
7. Selected project storytelling / case-study style section
8. Client / brand logo strip
9. Testimonial section (ONLY if actual testimonials are later supplied; otherwise omit or keep as editable placeholder)
10. Strong contact CTA
11. Footer

PORTFOLIO
Create a premium project gallery that can be populated by real images later.
The layout should not look like a basic 3-column grid.
Use varied editorial compositions, e.g.:
- large hero project
- asymmetric split
- full-bleed project image
- text + image pair
- horizontal project row
- occasional overlapping image treatment
Keep motion subtle and purposeful.
Hover interactions can reveal project name / category / year, but do not over-animate.
Images should use Next/Image with proper loading strategy.
Above-the-fold hero imagery should prioritize LCP.

ASSET PLACEHOLDERS
Create a clean content/config layer so I can replace images without touching component structure.
Create an obvious folder structure such as:
- /public/images/hero/
- /public/images/projects/
- /public/images/services/
- /public/images/studio/
- /public/images/clients/
- /public/brand/
Put comments or a content config file showing exactly where assets belong.
Use placeholder local paths where appropriate.

IMPORTANT: In the final response, explicitly tell me exactly which folders/files I should put:
- hero/interior photography
- project photography
- service images
- studio/team images
- client/brand logos
- the RR logo files

LOGOS / CLIENTS
Add a premium client-logo section that is easy to update from data.
Use placeholders only until I provide the actual brands.
Do not invent client relationships.

CTA STRATEGY
Use multiple but tasteful conversion points:
- hero primary CTA
- sticky mobile call/contact CTA
- project section CTA
- services CTA
- final full-width CTA
- footer contact CTA
The copy should move the visitor from inspiration -> trust -> action.
Make CTA buttons accessible and visually obvious.
Once phone/email/WhatsApp/location are supplied, make:
- tel: phone links
- WhatsApp deep link
- mailto
- Google Maps/location link
Do not hardcode fake contact details.

CONTACT
Build a premium inquiry section with:
- name
- phone
- email
- project type
- approximate budget
- city/location
- message
- submit CTA
For now implement the UI and a clean validation-ready structure, but keep the form backend easily swappable.
Also provide direct call / WhatsApp actions.
Make the mobile experience frictionless.

SCROLL / MOTION
Use Framer Motion only where it creates genuine visual improvement, or use lightweight CSS/IntersectionObserver where more appropriate.
Motion language:
- slow fades
- elegant vertical reveals
- subtle image scale/parallax
- text masking/reveal
- editorial section transitions
No excessive bouncing, rotating, or attention-seeking motion.
Respect prefers-reduced-motion.
The MorphGallery shader is the hero's signature transition.

RESPONSIVE REQUIREMENTS
This is critical.
Make the website robust across:
- small mobile
- large mobile
- tablets
- laptops
- wide desktops
- unusual aspect ratios
- very tall phones
- very wide desktop screens
Do not design only for one desktop width.
No horizontal overflow.
Typography must scale gracefully.
Hero composition, CTA positions, image crops, navigation, gallery controls, and section spacing must adapt to viewport dimensions.
Use CSS clamp/container queries where helpful.
Test at common widths such as 320, 375, 390, 430, 768, 1024, 1280, 1440, 1920.

PERFORMANCE
- next/image
- correct sizes attributes
- lazy-load noncritical images
- prioritize hero images
- avoid unnecessary client components
- avoid loading huge assets for thumbnails
- minimize JS where possible
- preserve MorphGallery fallback
- no layout shift
- semantic HTML
- accessible keyboard focus
- alt text
- reduced motion support

SEO
Implement proper metadata for RR Creative Interiors:
- title
- description
- Open Graph
- Twitter metadata
- favicon/app icons hooks
- semantic heading hierarchy
- LocalBusiness / InteriorDesign business structured-data placeholder that can be populated with actual contact/location data later
Do not fabricate address, phone, ratings, awards, or review counts.

CONTENT / BRAND VOICE
Tone:
- refined
- confident
- warm
- intelligent
- architectural
- emotionally resonant
Avoid salesy clichés such as "We are the best", "No.1", "world-class" unless later supported by real evidence.
The design should communicate premium quality visually instead of making unsupported boasts.

SHADCN / COMPONENT STRUCTURE
Use:
- /components/ui for reusable UI components
- /components/sections for page sections
- /components for larger shared components
- /lib for utilities/content/config
- /public for assets
Keep components composable and easy to edit.
The supplied MorphGallery component belongs in /components/ui/morph-gallery.tsx.

INITIAL PROJECT SETUP
If needed initialize using modern Next.js App Router + TypeScript + Tailwind.
Set up path aliases such as @/*.
Install/configure shadcn-style component conventions.
Use a clean global theme and CSS variables.

DELIVERABLE
Build the complete first version, not a scaffold.
The result must look like a premium interior design studio website even before I provide final contact details.
Use tasteful placeholder content/data where necessary.
At the end:
- run lint/typecheck/build
- fix issues
- verify no obvious responsive overflow problems
- then create ONE consolidated commit with all completed changes
- do not create a series of tiny commits

CONTENT CONFIG
Create an obvious file such as /lib/site-data.ts where I can later replace:
- phone
- WhatsApp
- email
- location
- Instagram
- project entries
- services
- client logos
- testimonials
- hero images
Use null/placeholder values where details are not yet available.

FINAL NOTE
I will later provide the real phone number, WhatsApp number, email, location, social links, interior photography, project portfolio, and client/brand logos. Design the architecture so adding these is a data/asset update, not a redesign.
