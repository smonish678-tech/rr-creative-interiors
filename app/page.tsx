"use client";

import { AnimatePresence, motion, useScroll } from "framer-motion";
import { ArrowUpRight, ChevronRight, Mail, Menu, MessageCircle, Phone, X } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import type { SiteAssetKey } from "@/lib/site-assets";
import MorphScrollHero from "@/components/morph-scroll-hero";
import { SquigglyUnderline } from "@/components/ui/squiggly-underline";
import SmoothScroll from "@/components/smooth-scroll";

const RR_LOGO = "/rr-media/logo/rr%205.png";

type PortfolioCard = { name: string; src: string; kind?: "image" | "video"; title?: string; project?: string; description?: string; id?: string };
type SiteAssetUrls = Partial<Record<SiteAssetKey, string>>;

const PORTFOLIO: PortfolioCard[] = [
  "p1.png","p2.png","p3.png","p4.png","p5.png","p6.png","p7.png","p8.png","p9.png",
  "p10.png","p11.png","p12.png","p13.png","p14.png","p15.png","p16.png","17.png","p18.png",
  "Industrial Metal & Wood TV Consoles.jpg","Modern Modular Kitchen Ideas _ Stylish U-Shaped Kitchen Design.jpg","download (2).jpg"
].map((name) => ({
  name,
  src: "/rr-media/portfolio/" + encodeURIComponent(name)
}));

const IMG = {
  living: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1800&q=84",
  lounge: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1600&q=84",
  marble: "https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=1600&q=84",
  bedroom: "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1600&q=84",
  kitchen: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=1600&q=84",
  detail: "https://images.unsplash.com/photo-1540932239986-30128078f3c5?auto=format&fit=crop&w=1600&q=84"
};

const services = [
  ["01", "Full-home & turnkey interiors", "One considered plan for design, materials, custom furniture and on-site execution—from first brief to handover.", "living"],
  ["02", "Residential interiors", "Rooms and storage planned around your household, routines, existing furniture and the way you use the space.", "lounge"],
  ["03", "Commercial & corporate", "Client-facing spaces and workplaces with practical circulation, a clear identity and finishes chosen for everyday use.", "commercial"],
  ["04", "Renovation & reworking", "Make better use of what exists. Keep what works, change what does not, and plan the work around the site.", "bedroom"],
  ["05", "Modular kitchens", "Storage, work zones and finishes designed to fit your layout, cooking habits and maintenance preferences.", "kitchen"],
  ["06", "Wardrobes & built-in storage", "Custom internal layouts, proportions and finishes that use the available space intelligently.", "bedroom"],
  ["07", "Design-only & planning", "A thoughtful design direction, layouts and material choices for clients who need design guidance without full execution.", "proportion"],
  ["08", "Custom furniture & details", "TV units, studies, crockery units, foyer storage, pooja units, kids’ rooms and the pieces that make a space yours.", "material"]
];

const principles = [
  ["01", "Start with your brief", "Your routines, taste, practical needs and budget set the direction. A package should never make those decisions for you."],
  ["02", "Prioritise what matters", "We decide where custom work adds the most value, where a simpler choice works well, and what can be phased if needed."],
  ["03", "Make the scope clear", "Materials, work items, exclusions and finish levels are discussed before the project moves ahead. Changes are reviewed before they change the cost."],
  ["04", "Design it to be built", "The approved idea is carried through measurements, material choices, fabrication and on-site detailing—not left behind in a render."],
];

const journal = [
  ["01", "A better brief makes a better budget", "What to decide before design begins: priorities, essentials, flexibility and the pieces worth customising."],
  ["02", "Where to spend—and where not to", "Not every surface needs to be a statement. The right balance depends on what you touch, use and notice every day."],
  ["03", "A quote should answer questions", "Scope, materials, finish levels and exclusions are easier to discuss before work begins than to guess at halfway through."]
];

function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-12% 0px" }}
      transition={{ duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

function Nav({ logoUrl }: { logoUrl: string }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("Home");
  const { scrollYProgress } = useScroll();

  const navigation = [
    { name: "Home", href: "#top", id: "top" },
    { name: "About", href: "#about", id: "about" },
    { name: "Spaces", href: "#spaces", id: "spaces" },
    { name: "Portfolio", href: "#portfolio", id: "portfolio" },
    { name: "The Eye", href: "#eye", id: "eye" },
    { name: "Services", href: "#services", id: "services" },
    { name: "Process", href: "#process", id: "process" },
    { name: "Journal", href: "#journal", id: "journal" },
    { name: "Contact", href: "#contact", id: "contact" }
  ];

  useEffect(() => {
    const targets = navigation
      .filter((item) => item.id !== "top")
      .map((item) => document.getElementById(item.id))
      .filter((node): node is HTMLElement => Boolean(node));

    if (!targets.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (visible?.target?.id) {
          const item = navigation.find((navItem) => navItem.id === visible.target.id);
          if (item) setActive(item.name);
        }
      },
      { rootMargin: "-28% 0px -58% 0px", threshold: [0.1, 0.25, 0.5] }
    );

    targets.forEach((target) => observer.observe(target));
    return () => observer.disconnect();
  }, []);

  return (
    <motion.header className="rr-header fixed inset-x-0 top-0 z-50">
      <div className="rr-header-inner">
        <a href="#top" className="rr-brand" aria-label="RR Creative Interiors home" onClick={() => setActive("Home")}>
          <img
            src={logoUrl}
            alt="RR Creative Interiors"
          />
        </a>

        <div className="rr-desktop-nav">
          <SquigglyUnderline
            items={navigation.map(({ name, href }) => ({ name, href }))}
            active={active}
            onSelect={setActive}
          />
        </div>

        <a href="#contact" className="rr-nav-cta" onClick={() => setActive("Contact")}>
          Start a project
          <ArrowUpRight size={14} />
        </a>

        <button
          className="rr-mobile-toggle"
          onClick={() => setOpen(!open)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X size={19} /> : <Menu size={19} />}
        </button>
      </div>

      <motion.div className="rr-header-progress" style={{ scaleX: scrollYProgress }} aria-hidden="true" />

      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="rr-mobile-nav">
            {navigation.map((item) => (
              <a
                key={item.name}
                href={item.href}
                className={item.name === active ? "is-active" : ""}
                onClick={() => {
                  setActive(item.name);
                  setOpen(false);
                }}
              >
                <span>{item.name}</span>
                <ArrowUpRight size={15} />
              </a>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}

function ContactForm() {
  const [sent, setSent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submissionError, setSubmissionError] = useState("");
  const [whatsAppHref, setWhatsAppHref] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [values, setValues] = useState({ name: "", phone: "", email: "", type: "", budget: "", message: "" });

  const update = (key: keyof typeof values, value: string) => {
    setValues((current) => ({ ...current, [key]: value }));
    setSent(false);
    setWhatsAppHref("");
    setSubmissionError("");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving || sent) return;
    setSaving(true);
    setSubmissionError("");

    const submissionId = window.crypto.randomUUID();
    try {
      const response = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId, name: values.name, phone: values.phone, email: values.email,
          serviceType: values.type, budget: values.budget, message: values.message, companyWebsite,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.accepted !== true) {
        throw new Error(typeof result.error === "string" ? result.error : "We could not save your enquiry. Please try again.");
      }

      const text = [
        "Hello RR Creative Interiors,",
        "Website enquiry received by RR CRM.",
        "Name: " + values.name,
        "Phone: " + values.phone,
        "Email: " + (values.email || "Not provided"),
        "Project: " + (values.type || "Not selected"),
        "Budget: " + (values.budget || "Not specified"),
        "Message: " + values.message,
        result.reference ? "Enquiry reference: " + result.reference : "",
      ].filter(Boolean).join("\\n");
      setWhatsAppHref("https://wa.me/919901592929?text=" + encodeURIComponent(text));
      setSent(true);
    } catch (error) {
      setSubmissionError(error instanceof Error ? error.message : "We could not save your enquiry. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const budgetOptions = ["₹10–20L", "₹20–40L", "₹40–70L", "₹70L+"];

  return (
    <div className="rr-enquiry-shell">
      <div className="rr-contact-rail">
        <a className="rr-contact-action" href="tel:+919901592929">
          <span className="rr-contact-icon"><Phone size={16} /></span>
          <span><small>Call the studio</small><strong>+91 99015 92929</strong></span>
          <ArrowUpRight size={15} />
        </a>
        <a className="rr-contact-action" href="https://wa.me/919901592929" target="_blank" rel="noopener noreferrer">
          <span className="rr-contact-icon rr-whatsapp"><MessageCircle size={16} /></span>
          <span><small>WhatsApp</small><strong>Start a quick enquiry</strong></span>
          <ArrowUpRight size={15} />
        </a>
        <a className="rr-contact-action" href="mailto:sales@rrcreativeinteriors.in">
          <span className="rr-contact-icon"><Mail size={16} /></span>
          <span><small>Email</small><strong>sales@rrcreativeinteriors.in</strong></span>
          <ArrowUpRight size={15} />
        </a>
      </div>

      <form onSubmit={submit} className="rr-enquiry-card">
        <div className="rr-form-head">
          <div>
            <span>Tell us where you&apos;re starting</span>
            <h3>A little context.<br /><em>Then we take it from there.</em></h3>
          </div>
          <div className="rr-form-mark">RR<span>↗</span></div>
        </div>

        <div className="rr-enquiry-honeypot" aria-hidden="true">
          <label>Leave this field empty<input name="companyWebsite" type="text" tabIndex={-1} autoComplete="off" value={companyWebsite} onChange={(event) => setCompanyWebsite(event.target.value)} /></label>
        </div>

        <div className="rr-field-grid">
          <label className="rr-field">
            <span>01 · Name</span>
            <input required maxLength={100} autoComplete="name" value={values.name} onChange={(event) => update("name", event.target.value)} placeholder="Your name" />
          </label>
          <label className="rr-field">
            <span>02 · Phone</span>
            <input required type="tel" maxLength={30} autoComplete="tel" value={values.phone} onChange={(event) => update("phone", event.target.value)} placeholder="+91" />
          </label>
          <label className="rr-field">
            <span>03 · Email</span>
            <input type="email" maxLength={254} autoComplete="email" value={values.email} onChange={(event) => update("email", event.target.value)} placeholder="you@email.com" />
          </label>
          <label className="rr-field">
            <span>04 · Project</span>
            <select value={values.type} onChange={(event) => update("type", event.target.value)}>
              <option value="">Choose a direction</option>
              <option>Residential interior</option>
              <option>Turnkey interior</option>
              <option>Commercial interior</option>
              <option>Corporate interior</option>
              <option>Renovation</option>
            </select>
          </label>
        </div>

        <div className="rr-budget">
          <div className="rr-budget-label"><span>05 · Indicative budget</span><strong>{values.budget || "Choose a range"}</strong></div>
          <div className="rr-budget-grid">
            {budgetOptions.map((item) => (
              <button type="button" key={item} className={values.budget === item ? "rr-budget-chip is-selected" : "rr-budget-chip"} onClick={() => update("budget", item)}>
                {item}
              </button>
            ))}
          </div>
        </div>

        <label className="rr-field rr-field-message">
          <span>06 · Tell us about the space</span>
          <textarea required minLength={10} maxLength={2500} rows={4} value={values.message} onChange={(event) => update("message", event.target.value)} placeholder="Property, approximate size, what you are planning, and when you&apos;d like to begin." />
        </label>

        <div className="rr-form-foot">
          <div className="rr-form-note">
            <span className="rr-signal"></span>
            Your enquiry is saved to our CRM first. WhatsApp is optional.
          </div>
          <button type="submit" className="rr-form-submit" disabled={saving || sent}>
            <span>{saving ? "Saving enquiry…" : sent ? "Enquiry received" : "Send enquiry"}</span>
            <MessageCircle size={18} />
            <ArrowUpRight size={16} />
          </button>
        </div>

        {submissionError && <p className="rr-form-error" role="alert">{submissionError}</p>}
        {sent && (
          <div className="rr-form-success" role="status">
            <p>Your enquiry has been saved. RR can now see it in the CRM pipeline.</p>
            <a href={whatsAppHref} target="_blank" rel="noopener noreferrer">Continue on WhatsApp <ArrowUpRight size={14} /></a>
          </div>
        )}
      </form>
    </div>
  );
}

export default function Page() {
  const [portfolioItems, setPortfolioItems] = useState<PortfolioCard[]>(PORTFOLIO);
  const [siteAssets, setSiteAssets] = useState<SiteAssetUrls>({});
  const hasUploadedPortfolio = portfolioItems.some((item) => Boolean(item.id));
  const sitePhotos = {
    living: siteAssets.spacesLiving || IMG.living,
    lounge: siteAssets.spacesLiving || IMG.lounge,
    marble: siteAssets.eyeMaterial || IMG.marble,
    bedroom: siteAssets.spacesBedroom || IMG.bedroom,
    kitchen: siteAssets.spacesKitchen || IMG.kitchen,
    detail: siteAssets.eyeLighting || IMG.detail,
    proportion: siteAssets.eyeProportion || IMG.living,
    material: siteAssets.eyeMaterial || IMG.marble,
    lighting: siteAssets.eyeLighting || IMG.detail,
    commercial: siteAssets.spacesLiving || IMG.detail,
    moodboard: siteAssets.materialMoodboard || IMG.marble,
  };
  const logoUrl = siteAssets.brandLogo || RR_LOGO;

  useEffect(() => {
    let active = true;
    fetch("/api/site-assets", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (active && data?.assets && typeof data.assets === "object") setSiteAssets(data.assets); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const mark = siteAssets.brandMark;
    if (!mark) return;
    const links = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"], link[rel="apple-touch-icon"]'));
    const previous = links.map((link) => ({ link, href: link.href }));
    links.forEach((link) => { link.href = mark; });
    return () => previous.forEach(({ link, href }) => { link.href = href; });
  }, [siteAssets.brandMark]);

  useEffect(() => {
    let active = true;
    fetch("/api/portfolio", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!active || !Array.isArray(data?.items) || data.items.length === 0) return;
        const uploaded: PortfolioCard[] = data.items
          .filter((item: { url?: unknown; kind?: unknown }) => typeof item.url === "string" && (item.kind === "image" || item.kind === "video"))
          .map((item: { id?: string; url: string; kind: "image" | "video"; title?: string; project?: string; description?: string }) => ({
            id: item.id,
            name: item.title || item.project || "RR project",
            src: item.url,
            kind: item.kind,
            title: item.title,
            project: item.project,
            description: item.description,
          }));
        setPortfolioItems(uploaded.length ? uploaded : PORTFOLIO);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify({"@context":"https://schema.org","@graph":[{"@type":"WebSite","@id":"https://rrcreativeinteriors.in/#website","url":"https://rrcreativeinteriors.in/","name":"RR Creative Interiors","alternateName":"RR Interiors","description":"RR Creative Interiors creates fully customised interiors in Bengaluru, thoughtfully planned around each client’s brief and budget.","inLanguage":"en-IN"},{"@type":"Organization","@id":"https://rrcreativeinteriors.in/#organization","name":"RR Creative Interiors","alternateName":"RR Interiors","url":"https://rrcreativeinteriors.in/","logo":{"@type":"ImageObject","url":siteAssets.brandLogo || "https://rrcreativeinteriors.in/rr-media/logo/rr%205.png","contentUrl":siteAssets.brandLogo || "https://rrcreativeinteriors.in/rr-media/logo/rr%205.png"},"telephone":["+919901592929","+919110241957"],"email":"sales@rrcreativeinteriors.in","address":{"@type":"PostalAddress","streetAddress":"32, 2nd Cross Rd, KNB Aaradya layout, Kommaghatta","addressLocality":"Bengaluru","addressRegion":"Karnataka","postalCode":"560060","addressCountry":"IN"},"areaServed":{"@type":"City","name":"Bengaluru"},"description":"Interior design studio in Bengaluru offering residential, commercial and turnkey interior design services.","knowsAbout":["Residential interior design","Commercial interior design","Turnkey interiors","Modular kitchens","Wardrobes and storage","Lighting and ceiling design"]}]})}} />
      <SmoothScroll />
      <Nav logoUrl={logoUrl} />
      <main id="top">
        <MorphScrollHero assets={siteAssets} />

        <section id="about" className="relative bg-[#f7f4ee] text-[#27231f]">
          <div className="mx-auto grid max-w-[1380px] gap-12 px-6 py-28 md:px-10 lg:grid-cols-[.8fr_1.2fr] lg:py-40">
            <Reveal>
              <p className="text-[10px] uppercase tracking-[0.25em] text-[#98683f]">THE RR APPROACH</p>
              <h2 className="mt-5 max-w-xl font-serif text-5xl leading-[.94] tracking-[-.04em] md:text-7xl">Designed around you. Not a package.</h2>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="max-w-3xl">
                <p className="text-xl leading-9 text-[#51463d]">Fully customised interiors, thoughtfully priced.</p>
                <p className="mt-8 text-base leading-8 text-[#63584e]">We shape each project around your routines, preferences and priorities—from layout and storage to finishes and made-to-measure furniture. We discuss the scope and the budget together, so you can decide where to invest and what can wait.</p>
              </div>
            </Reveal>
          </div>
        </section>

        <section id="spaces" className="bg-[#eee8de] text-[#27231f]">
          <div className="mx-auto max-w-[1380px] px-6 py-28 md:px-10 md:py-36">
            <Reveal>
              <div className="flex items-end justify-between gap-8">
                <div>
                  <p className="text-[10px] uppercase tracking-[.25em] text-[#98683f]">SPACES, SHAPED WITH INTENT</p>
                  <h2 className="mt-5 max-w-2xl font-serif text-5xl leading-[.94] md:text-7xl">The details should fit the life.</h2>
                </div>
                <p className="hidden max-w-sm text-sm leading-7 text-[#63584e] md:block">A space comes together through the everyday decisions: how it flows, what it stores, how light falls, and which finishes earn their place.</p>
              </div>
            </Reveal>

            <div className="mt-16 grid gap-6 lg:grid-cols-[1.12fr_.88fr]">
              <Reveal className="group relative min-h-[620px] overflow-hidden">
                <img src={sitePhotos.living} alt="Contemporary living room visual reference" className="absolute inset-0 h-full w-full object-cover transition duration-1000 group-hover:scale-[1.045]" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0f0a08]/80 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-8 md:p-10">
                  <p className="text-[9px] uppercase tracking-[.2em] text-[#e3c27d]">Living · Visual study</p>
                  <h3 className="mt-3 font-serif text-4xl md:text-5xl">Quietly dramatic.</h3>
                </div>
              </Reveal>
              <div className="grid gap-6">
                <Reveal className="group relative min-h-[300px] overflow-hidden">
                  <img src={sitePhotos.kitchen} alt="Modern luxury kitchen visual reference" className="absolute inset-0 h-full w-full object-cover transition duration-1000 group-hover:scale-[1.045]" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
                  <div className="absolute bottom-0 p-7">
                    <p className="text-[9px] uppercase tracking-[.2em] text-[#e3c27d]">Kitchen · Visual study</p>
                    <h3 className="mt-2 font-serif text-3xl">Useful can still be beautiful.</h3>
                  </div>
                </Reveal>
                <Reveal className="group relative min-h-[300px] overflow-hidden">
                  <img src={sitePhotos.bedroom} alt="Modern bedroom visual reference" className="absolute inset-0 h-full w-full object-cover transition duration-1000 group-hover:scale-[1.045]" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
                  <div className="absolute bottom-0 p-7">
                    <p className="text-[9px] uppercase tracking-[.2em] text-[#e3c27d]">Private · Visual study</p>
                    <h3 className="mt-2 font-serif text-3xl">Softness without excess.</h3>
                  </div>
                </Reveal>
              </div>
            </div>
          </div>
        </section>


        <section id="portfolio" className="relative overflow-hidden bg-[#f7f4ee] text-[#27231f]">
          <div className="mx-auto max-w-[1380px] px-6 py-28 md:px-10 md:py-40">
            <Reveal>
              <div className="flex items-end justify-between gap-10">
                <div>
                  <p className="text-[10px] uppercase tracking-[.25em] text-[#98683f]">{hasUploadedPortfolio ? "SELECTED RR WORK" : "FORM · FINISH · LIGHT"}</p>
                  <h2 className="mt-5 max-w-4xl font-serif text-6xl leading-[.9] tracking-[-.045em] md:text-8xl">{hasUploadedPortfolio ? <>Made for a brief.<br /><em className="text-[#9d352a]">Built around real life.</em></> : <>A visual vocabulary of<br /><em className="text-[#9d352a]">form, finish & light.</em></>}</h2>
                </div>
                <p className="hidden max-w-sm text-sm leading-7 text-[#63584e] md:block">{hasUploadedPortfolio ? "Published images from the Portfolio library appear here. Add or replace them in the admin whenever a project is ready to share." : "These are visual references, not a claim that every image is a completed RR project. Publish your own photography through the Portfolio library to replace them."}</p>
              </div>
            </Reveal>

            <div className="mt-16 columns-1 gap-5 md:columns-2 xl:columns-3">
              {portfolioItems.map((item, i) => (
                <Reveal key={item.name} delay={(i % 3) * .03} className="group mb-5 break-inside-avoid">
                  <figure className="relative overflow-hidden bg-[#dcd0c1]">
                    {item.kind === "video" ? (
                      <video
                        src={item.src}
                        aria-label={item.title || item.project || `RR project video ${i + 1}`}
                        controls
                        preload="metadata"
                        playsInline
                        className="block aspect-[4/5] w-full object-cover transition duration-[1200ms] ease-out group-hover:scale-[1.035]"
                      />
                    ) : (
                      <img
                        src={item.src}
                        alt={item.title || item.project || `RR Creative Interiors visual study ${i + 1}`}
                        loading="lazy"
                        className="block h-auto w-full object-cover transition duration-[1200ms] ease-out group-hover:scale-[1.035]"
                      />
                    )}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent opacity-0 transition duration-500 group-hover:opacity-100" />
                    <div className="pointer-events-none absolute bottom-4 left-4 right-4 flex items-center justify-between translate-y-2 opacity-0 transition duration-500 group-hover:translate-y-0 group-hover:opacity-100">
                      <span className="text-[8px] uppercase tracking-[.18em] text-white">{item.project ? `${item.project}${item.title ? ` · ${item.title}` : ""}` : "RR visual reference"}</span>
                      <ArrowUpRight size={14} className="text-[#edca83]" />
                    </div>
                  </figure>
                </Reveal>
              ))}
            </div>

            <div className="mt-12 flex items-center justify-between border-t border-[#1d1713]/15 pt-5">
              <span className="text-[8px] uppercase tracking-[.18em] text-[#98683f]">{hasUploadedPortfolio ? `${portfolioItems.length} published project images` : "Visual references · awaiting your project photography"}</span>
              <a href="#contact" className="inline-flex items-center gap-2 text-[9px] uppercase tracking-[.18em] text-[#1d1713] hover:text-[#9d1714]">Discuss your space <ArrowUpRight size={14} /></a>
            </div>
          </div>
        </section>

        <section id="eye" className="relative overflow-hidden bg-[#eee8de] text-[#27231f]">
          <div className="mx-auto grid max-w-[1380px] gap-16 px-6 py-28 md:px-10 md:py-40 lg:grid-cols-[.56fr_1.44fr]">
            <Reveal className="lg:sticky lg:top-28 lg:self-start">
              <p className="text-[10px] uppercase tracking-[.25em] text-[#98683f]">HOW WE MAKE THE DECISIONS</p>
              <h2 className="mt-5 font-serif text-6xl leading-[.88] tracking-[-.04em] md:text-8xl">Good design lives<br /><em className="text-[#9d352a]">in the decisions.</em></h2>
              <p className="mt-8 max-w-md text-sm leading-7 text-[#63584e]">The design is more than a finish. Proportion, light, storage and the way materials meet make a room feel resolved. We look at those decisions alongside the cost of building them.</p>
            </Reveal>

            <div className="grid gap-8">
              {[
                {img: IMG.living, tag:"01 · PROPORTION", title:"A visual axis is felt before it is seen.", note:"Furniture, openings and sightlines are composed so the room reads as one quiet movement."},
                {img: IMG.kitchen, tag:"02 · MATERIAL", title:"Contrast gives restraint a pulse.", note:"Stone against timber. Matte beside reflection. Warm metal against a quieter surface."},
                {img: IMG.detail, tag:"03 · LIGHT", title:"Good lighting edits the room.", note:"Layers of light reveal depth, soften edges and change the atmosphere without changing the architecture."}
              ].map((item, i) => (
                <Reveal key={item.tag} delay={i * 0.06} className="group grid gap-6 border-t border-[#27231e]/15 pt-7 md:grid-cols-[.95fr_1.05fr] md:items-center">
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <img src={item.img} alt={item.title} className="h-full w-full object-cover transition duration-[1400ms] ease-out group-hover:scale-[1.06]" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                    <div className="absolute left-5 top-5 text-[8px] uppercase tracking-[.2em] text-[#ecd08b]">{item.tag}</div>
                  </div>
                  <div>
                    <h3 className="max-w-xl font-serif text-4xl leading-[.98] tracking-[-.03em] md:text-5xl">{item.title}</h3>
                    <p className="mt-5 max-w-lg text-sm leading-7 text-[#63584e]">{item.note}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="philosophy" className="bg-[#f7f4ee] text-[#27231f]">
          <div className="mx-auto grid max-w-[1380px] gap-16 px-6 py-28 md:px-10 md:py-40 lg:grid-cols-[.7fr_1.3fr]">
            <Reveal>
              <p className="text-[10px] uppercase tracking-[.25em] text-[#98683f]">WHAT WE BELIEVE</p>
              <h2 className="mt-5 font-serif text-6xl leading-[.9] md:text-8xl">Fully customised.<br /><em className="text-[#9d352a]">Thought through.</em></h2>
            </Reveal>
            <Reveal delay={0.08}>
              <div className="grid gap-0 border-t border-[#1d1713]/15">
                {principles.map(([n, h, p]) => (
                  <div key={n} className="grid gap-5 border-b border-[#1d1713]/15 py-8 md:grid-cols-[64px_280px_1fr] md:items-start">
                    <span className="text-[10px] tracking-[.2em] text-[#a17745]">{n}</span>
                    <h3 className="font-serif text-3xl">{h}</h3>
                    <p className="max-w-xl text-sm leading-7 text-[#665b52]">{p}</p>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        <section id="services" className="bg-[#eee8de] text-[#27231f]">
          <div className="mx-auto max-w-[1380px] px-6 py-28 md:px-10 md:py-36">
            <Reveal>
              <div className="flex items-end justify-between gap-8">
                <div><p className="text-[10px] uppercase tracking-[.25em] text-[#98683f]">ONE STUDIO · THE RIGHT SCOPE</p><h2 className="mt-5 font-serif text-5xl leading-[.94] md:text-7xl">The service should fit the project.</h2></div>
                <p className="hidden max-w-md text-sm leading-7 text-[#63584e] md:block">From one focused room to a complete turnkey brief, we tailor the work to what your property actually needs.</p>
              </div>
            </Reveal>

            <div className="mt-14 border-t border-[#27231e]/15">
              {services.map(([n, name, desc, imageKey]) => (
                <div key={n} className="service-row group relative grid gap-5 border-b border-[#28231e]/15 py-8 md:grid-cols-[70px_1fr_1fr_32px] md:items-center" >
                  <span className="text-[10px] tracking-[.2em] text-[#98683f]">{n}</span>
                  <h3 className="font-serif text-3xl md:text-4xl">{name}</h3>
                  <p className="max-w-lg text-sm leading-7 text-[#63584e]">{desc}</p>
                  <ArrowUpRight className="text-[#9d352a] transition group-hover:translate-x-1 group-hover:-translate-y-1" size={19} />
                  <div className="service-preview pointer-events-none absolute right-[4%] top-1/2 z-20 hidden aspect-[4/3] w-[250px] -translate-y-1/2 overflow-hidden border border-[#28231e]/10 shadow-[0_24px_70px_rgba(45,34,22,.12)] md:block">
                    <img src={sitePhotos[imageKey as keyof typeof sitePhotos]} alt="" className="h-full w-full object-cover opacity-0 transition duration-250 group-hover:opacity-100" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="process" className="bg-[#f7f4ee] text-[#27231f]">
          <div className="mx-auto grid max-w-[1380px] gap-14 px-6 py-28 md:px-10 md:py-36 lg:grid-cols-[.62fr_1.38fr]">
            <Reveal className="lg:sticky lg:top-28 lg:self-start">
              <p className="text-[10px] uppercase tracking-[.25em] text-[#98683f]">A CLEAR WAY FORWARD</p>
              <h2 className="mt-5 font-serif text-6xl leading-[.9] md:text-8xl">Clear decisions.<br />Better control.</h2>
              <p className="mt-7 max-w-md text-sm leading-7 text-[#63584e]">You should know what is being designed, what is included and what needs a decision next. We keep those conversations visible as the work progresses.</p>
            </Reveal>
            <div className="border-t border-[#1d1713]/15">
              {[["01","Understand","Your property, requirements, priorities, budget and what you want to change."],["02","Design & cost","Develop the layout, finishes and custom details; review the scope and estimate together."],["03","Approve","Confirm the design, inclusions, materials and milestones before execution begins."],["04","Execute & hand over","Coordinate the agreed work, check the finish and resolve details before handover."]].map(([n,h,p],i)=>(
                <Reveal delay={i*.05} key={n} className="grid gap-5 border-b border-[#1d1713]/15 py-10 md:grid-cols-[70px_240px_1fr]">
                  <span className="text-[10px] tracking-[.2em] text-[#a17745]">{n}</span>
                  <h3 className="font-serif text-3xl md:text-4xl">{h}</h3>
                  <p className="text-sm leading-7 text-[#695d53]">{p}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#eee8de] text-[#27231f]">
          <div className="mx-auto grid max-w-[1380px] gap-8 px-6 py-28 md:px-10 md:py-36 lg:grid-cols-[.85fr_1.15fr] lg:items-center">
            <Reveal>
              <p className="text-[10px] uppercase tracking-[.25em] text-[#98683f]">MATERIALS · FINISH · MAINTENANCE</p>
              <h2 className="mt-5 font-serif text-6xl leading-[.9] md:text-8xl">Choose the finish.<br /><em className="text-[#9d352a]">Understand the trade-off.</em></h2>
            </Reveal>
            <Reveal delay={0.08} className="relative min-h-[540px] overflow-hidden">
              <img src={sitePhotos.moodboard} alt="Luxury materials moodboard visual reference" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#f7f4ee]/90 via-[#f7f4ee]/8 to-transparent" />
              <div className="absolute bottom-7 left-7 right-7 flex items-end justify-between">
                <div><p className="text-[9px] uppercase tracking-[.2em] text-[#87552f]">Marble · timber · metal · stone</p><p className="mt-2 max-w-md text-sm leading-6 text-[#51463d]">We weigh appearance against durability, maintenance and the cost of the finish—not just how it looks in a photograph.</p></div>
                <span className="font-serif text-5xl text-[#27231f]/35">RR</span>
              </div>
            </Reveal>
          </div>
        </section>

        <section id="journal" className="bg-[#f7f4ee] text-[#27231f]">
          <div className="mx-auto max-w-[1380px] px-6 py-28 md:px-10 md:py-36">
            <Reveal>
              <p className="text-[10px] uppercase tracking-[.25em] text-[#98683f]">DESIGN & BUDGET, CONSIDERED</p>
              <h2 className="mt-5 max-w-3xl font-serif text-6xl leading-[.9] md:text-8xl">Useful things to decide early.</h2>
            </Reveal>
            <div className="mt-14 grid gap-0 border-t border-[#1d1713]/15 md:grid-cols-3">
              {journal.map(([n,h,p])=>(
                <article key={n} className="border-b border-[#1d1713]/15 p-8 md:border-r md:last:border-r-0">
                  <span className="text-[9px] tracking-[.2em] text-[#a17745]">{n}</span>
                  <h3 className="mt-12 font-serif text-3xl leading-tight">{h}</h3>
                  <p className="mt-5 text-sm leading-7 text-[#695d53]">{p}</p>
                  <a href="#contact" className="mt-8 inline-flex items-center gap-2 text-[9px] uppercase tracking-[.16em] text-[#9d352a]">Discuss your brief <ChevronRight size={14} /></a>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="contact" className="bg-[#eee8de] text-[#27231f]">
          <div className="mx-auto grid max-w-[1380px] gap-16 px-6 py-28 md:px-10 md:py-36 lg:grid-cols-[.82fr_1.18fr]">
            <Reveal>
              <p className="text-[10px] uppercase tracking-[.25em] text-[#98683f]">START WITH A CONVERSATION</p>
              <h2 className="mt-5 font-serif text-6xl leading-[.9] md:text-8xl">Tell us what you have in mind.</h2>
              <p className="mt-8 max-w-xl text-lg leading-8 text-[#63584e]">What do you need, what do you love, and what would you like us to work within? We will start with your brief—not a ready-made package.</p>
              <div className="mt-10 grid gap-3 text-sm">
                <a href="tel:+919901592929" className="inline-flex items-center gap-3"><Phone size={16} /> +91 99015 92929</a>
                <a href="https://wa.me/919901592929" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-3">WhatsApp enquiry ↗</a>
                <a href="mailto:sales@rrcreativeinteriors.in" className="inline-flex items-center gap-3">sales@rrcreativeinteriors.in</a>
                <a href="https://www.google.com/maps/search/?api=1&query=32+2nd+Cross+Rd+KNB+Aaradya+layout+Kommaghatta+Bengaluru+Karnataka+560060" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-3">32, 2nd Cross Rd, KNB Aaradya layout, Kommaghatta, Bengaluru ↗</a>
              </div>
            </Reveal>
            <Reveal delay={0.08}><ContactForm /></Reveal>
          </div>
        </section>
      </main>

      <div className="rr-floating-contact" aria-label="Quick contact">
        <a href="https://wa.me/919901592929" target="_blank" rel="noopener noreferrer" className="rr-float rr-float-wa">
          <MessageCircle size={17} />
          <span>WhatsApp</span>
        </a>
        <a href="tel:+919901592929" className="rr-float">
          <Phone size={16} />
          <span>Call</span>
        </a>
      </div>

      <footer className="rr-footer">
        <section className="rr-footer-cta">
          <div className="rr-footer-cta-glow" aria-hidden="true" />
          <div className="rr-footer-cta-inner">
            <div>
              <p className="rr-footer-kicker">FULLY CUSTOMISED · THOUGHTFULLY PRICED</p>
              <h2>Made for you.<br /><em>Planned with care.</em></h2>
            </div>
            <a href="#contact" className="rr-footer-cta-orbit" aria-label="Start a project">
              <span>START<br />A PROJECT</span>
              <ArrowUpRight size={22} />
            </a>
          </div>
          <div className="rr-footer-cta-line">
            <span>Residential · Commercial · Design-only · Turnkey</span>
            <span>Bengaluru · Karnataka</span>
          </div>
        </section>

        <div className="mx-auto grid max-w-[1380px] gap-12 px-6 py-16 md:px-10 md:grid-cols-[1.2fr_.8fr_.8fr]">
          <div>
            <img
              src={logoUrl}
              alt="RR Creative Interiors"
              className="h-14 w-auto object-contain"
            />
            <p className="mt-6 max-w-md text-sm leading-7 text-[#63584e]">
              Fully customised interiors, shaped around real life and an agreed project scope.
            </p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-[.2em] text-[#98683f]">Explore</p>
            <div className="mt-5 grid gap-3 text-sm text-[#63584e]">
              <a href="#spaces">Spaces</a>
              <a href="#eye">The Eye</a>
              <a href="#services">Services</a>
              <a href="#process">Process</a>
              <a href="#journal">Journal</a>
            </div>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-[.2em] text-[#98683f]">Contact</p>
            <div className="mt-5 grid gap-3 text-sm text-[#63584e]">
              <a href="tel:+919901592929">+91 99015 92929</a>
              <a href="mailto:sales@rrcreativeinteriors.in">sales@rrcreativeinteriors.in</a>
              <a href="https://wa.me/919901592929" target="_blank" rel="noopener noreferrer">WhatsApp ↗</a>
            </div>
          </div>
        </div>
        <div className="border-t border-[#27231e]/15 px-6 py-5 text-[8px] uppercase tracking-[.18em] text-[#63584e] md:px-10">
          © 2026 RR Creative Interiors · Bengaluru · Demo experience — replace visual references with real RR work before launch
        </div>
      </footer>
    </>
  );
}