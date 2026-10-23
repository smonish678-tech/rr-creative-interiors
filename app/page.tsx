"use client";

import { AnimatePresence, motion, useReducedMotion, useScroll } from "framer-motion";
import { ArrowUpRight, ChevronRight, Mail, Menu, MessageCircle, Phone, X } from "lucide-react";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import MorphScrollHero from "@/components/morph-scroll-hero";
import { SquigglyUnderline } from "@/components/ui/squiggly-underline";
import SmoothScroll from "@/components/smooth-scroll";

const RR_LOGO = "/rr-media/logo/rr%205.png";

type PortfolioCard = { name: string; src: string; kind?: "image" | "video"; title?: string; project?: string; description?: string; id?: string };

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


const services: Array<[string, string, string, keyof typeof IMG]> = [
  ["01", "Turnkey interiors", "One considered direction from the first conversation through design, materials and execution.", "living"],
  ["02", "Residential interiors", "Homes planned around your routines, the things you own and the way you want each room to feel.", "lounge"],
  ["03", "Commercial & corporate", "Workspaces and customer-facing environments that balance identity, flow and function.", "marble"],
  ["04", "Renovation & redesign", "Keep what works, rethink what does not, and make the existing space work harder.", "bedroom"],
  ["05", "Modular kitchens", "Storage, work zones and finishes planned for your kitchen—not a standard module count.", "kitchen"],
  ["06", "Wardrobes & storage", "Made-to-measure storage that respects the room, the contents and the architecture.", "bedroom"],
  ["07", "Lighting & ceilings", "Layered light and considered ceilings that change a room without overcomplicating it.", "detail"],
  ["08", "Furniture & detailing", "TV units, studies, crockery, foyer, pooja and custom furniture shaped around the brief.", "marble"],
  ["09", "Design-only consultation", "Layouts, concepts and material direction for clients who need the design before the build.", "living"],
];

const principles = [
  ["01", "Start with the people", "We ask how you live, what is not working, what you want to keep and what you want to change. The brief belongs to you."],
  ["02", "Make it truly custom", "No two properties or people ask for the same thing. The plan, storage, finishes and details respond to the actual space."],
  ["03", "Spend with intention", "We help prioritise where a better material or detail matters—and where a simpler choice is the smarter one."],
  ["04", "Respect the agreed scope", "Design, selections and execution should follow a clear brief and a quote you can review before the work moves ahead."],
];

const journal = [
  ["01", "Custom should feel personal—not complicated", "A good brief captures how you live, what needs to change and which details matter. From there, design becomes a set of useful decisions, not a list of extras."],
  ["02", "Where a budget makes a difference", "Prioritise the things you touch, use and rely on every day. Spend where quality changes the experience; simplify where an upgrade adds little."],
  ["03", "A room has to work on Tuesday", "The reveal is one day. Storage, circulation, light and easy maintenance are what make an interior feel right through ordinary life."]
];

function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const reduceMotion = useReducedMotion() ?? false;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, transform: reduceMotion ? "none" : "translateY(14px)" }}
      whileInView={{ opacity: 1, transform: "translateY(0px)" }}
      viewport={{ once: true, margin: "-12% 0px" }}
      transition={{ duration: reduceMotion ? 0.12 : 0.55, delay: reduceMotion ? 0 : delay, ease: [0.23, 1, 0.32, 1] }}
    >
      {children}
    </motion.div>
  );
}

function Nav({ logoUrl }: { logoUrl: string }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("Home");
  const { scrollYProgress } = useScroll();

  const navigation = useMemo(() => [
    { name: "Home", href: "#top", id: "top" },
    { name: "About", href: "#about", id: "about" },
    { name: "Spaces", href: "#spaces", id: "spaces" },
    { name: "Portfolio", href: "#portfolio", id: "portfolio" },
    { name: "The Eye", href: "#eye", id: "eye" },
    { name: "Services", href: "#services", id: "services" },
    { name: "Process", href: "#process", id: "process" },
    { name: "Notes", href: "#journal", id: "journal" },
    { name: "Contact", href: "#contact", id: "contact" }
  ], []);

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
  }, [navigation]);

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
  const [contactConsent, setContactConsent] = useState(false);
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
          serviceType: values.type, budget: values.budget, message: values.message, companyWebsite, contactConsent,
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

  const budgetOptions = ["Below ₹10L", "₹10–20L", "₹20–40L", "₹40L+"];

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
            <span>A brief built around you</span>
            <h3>Tell us what needs to work.<br /><em>We’ll start there.</em></h3>
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

        <label className="rr-enquiry-consent"><input type="checkbox" required checked={contactConsent} onChange={(event) => setContactConsent(event.target.checked)} /><span>I agree RR Creative Interiors may contact me about this project enquiry.</span></label>

        <div className="rr-form-foot">
          <div className="rr-form-note">
            <span className="rr-signal"></span>
            A thoughtful first conversation. No package pitch.
          </div>
          <button type="submit" className="rr-form-submit" disabled={saving || sent || !contactConsent}>
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
  const [hasPublishedPortfolio, setHasPublishedPortfolio] = useState(false);
  const [siteAssets, setSiteAssets] = useState<Record<string, string>>({});
  const images = useMemo(() => ({
    ...IMG,
    living: siteAssets.livingSpace || IMG.living,
    lounge: siteAssets.livingSpace || IMG.lounge,
    kitchen: siteAssets.kitchen || IMG.kitchen,
    bedroom: siteAssets.bedroom || IMG.bedroom,
    marble: siteAssets.eyeMaterial || IMG.marble,
    detail: siteAssets.eyeLighting || IMG.detail,
    proportion: siteAssets.eyeProportion || IMG.living,
    materials: siteAssets.materialsBoard || IMG.detail,
  }), [siteAssets]);
  const heroSceneImages = useMemo(() => Array.from({ length: 8 }, (_, index) => siteAssets[`heroScene${index + 1}`]), [siteAssets]);

  useEffect(() => {
    let active = true;
    fetch("/api/site-assets", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => { if (active && data?.assets && typeof data.assets === "object") setSiteAssets(data.assets as Record<string, string>); })
      .catch(() => {});
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
        setHasPublishedPortfolio(uploaded.length > 0);
        setPortfolioItems(uploaded.length ? uploaded : PORTFOLIO);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify({"@context":"https://schema.org","@graph":[{"@type":"WebSite","@id":"https://rrcreativeinteriors.in/#website","url":"https://rrcreativeinteriors.in/","name":"RR Creative Interiors","alternateName":"RR Interiors","description":"Fully customised residential, commercial and turnkey interiors in Bengaluru, thoughtfully priced around each client brief.","inLanguage":"en-IN"},{"@type":"Organization","@id":"https://rrcreativeinteriors.in/#organization","name":"RR Creative Interiors","alternateName":"RR Interiors","url":"https://rrcreativeinteriors.in/","logo":{"@type":"ImageObject","url":"https://rrcreativeinteriors.in/api/site-assets/logo","contentUrl":"https://rrcreativeinteriors.in/api/site-assets/logo"},"telephone":["+919901592929","+919110241957"],"email":"sales@rrcreativeinteriors.in","address":{"@type":"PostalAddress","streetAddress":"32, 2nd Cross Rd, KNB Aaradya layout, Kommaghatta","addressLocality":"Bengaluru","addressRegion":"Karnataka","postalCode":"560060","addressCountry":"IN"},"areaServed":{"@type":"City","name":"Bengaluru"},"description":"Fully customised residential, commercial and turnkey interiors in Bengaluru, thoughtfully priced around each client brief.","knowsAbout":["Residential interior design","Commercial interior design","Turnkey interiors","Modular kitchens","Wardrobes and storage","Lighting and ceiling design"]}]})}} />
      <SmoothScroll />
      <Nav logoUrl={siteAssets.logo || RR_LOGO} />
      <main id="top">
        <MorphScrollHero sceneImages={heroSceneImages} />

        <section id="about" className="relative bg-[#fbf8f2] text-[#29211b]">
          <div className="mx-auto grid max-w-[1380px] gap-12 px-6 py-28 md:px-10 lg:grid-cols-[.8fr_1.2fr] lg:py-40">
            <Reveal>
              <p className="text-[10px] uppercase tracking-[0.25em] text-[#956c3d]">The RR approach</p>
              <h2 className="mt-5 max-w-xl font-serif text-5xl leading-[.94] tracking-[-.04em] md:text-7xl">Designed around you. Not a package.</h2>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="max-w-3xl">
                <p className="text-xl leading-9 text-[#514237]">Fully customised does not mean adding more for the sake of it. It means making the right decisions for your space, your taste and your budget.</p>
                <p className="mt-8 text-base leading-8 text-[#6c5d50]">We start by understanding how you live or work, what needs to change and what matters most. From layout and storage to finishes and lighting, each choice has a reason—and a place in the agreed scope.</p>
              </div>
            </Reveal>
          </div>
        </section>

        <section id="spaces" className="bg-[#f1ebe1] text-[#29211b]">
          <div className="mx-auto max-w-[1380px] px-6 py-28 md:px-10 md:py-36">
            <Reveal>
              <div className="flex items-end justify-between gap-8">
                <div>
                  <p className="text-[10px] uppercase tracking-[.25em] text-[#956c3d]">A custom fit, down to the details</p>
                  <h2 className="mt-5 max-w-2xl font-serif text-5xl leading-[.94] md:text-7xl">Beautiful is personal. So is the plan.</h2>
                </div>
                <p className="hidden max-w-sm text-sm leading-7 text-[#6f6054] md:block">Every property brings different proportions, routines and priorities. The images here can be managed from Website Studio.</p>
              </div>
            </Reveal>

            <div className="mt-16 grid gap-6 lg:grid-cols-[1.12fr_.88fr]">
              <Reveal className="group relative min-h-[620px] overflow-hidden">
                <img src={images.living} alt="Living space interior design" className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.025]" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0f0a08]/80 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-8 md:p-10">
                  <p className="text-[9px] uppercase tracking-[.2em] text-white/90">Living · Made around you</p>
                  <h3 className="mt-3 font-serif text-4xl md:text-5xl">Room for your kind of life.</h3>
                </div>
              </Reveal>
              <div className="grid gap-6">
                <Reveal className="group relative min-h-[300px] overflow-hidden">
                  <img src={images.kitchen} alt="Custom kitchen interior design" className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.025]" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
                  <div className="absolute bottom-0 p-7">
                    <p className="text-[9px] uppercase tracking-[.2em] text-white/90">Kitchen · Planned to fit</p>
                    <h3 className="mt-2 font-serif text-3xl">Every inch has a job.</h3>
                  </div>
                </Reveal>
                <Reveal className="group relative min-h-[300px] overflow-hidden">
                  <img src={images.bedroom} alt="Bedroom interior design" className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.025]" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
                  <div className="absolute bottom-0 p-7">
                    <p className="text-[9px] uppercase tracking-[.2em] text-white/90">Private · Thought through</p>
                    <h3 className="mt-2 font-serif text-3xl">Calm, without the clutter.</h3>
                  </div>
                </Reveal>
              </div>
            </div>
          </div>
        </section>


        <section id="portfolio" className="relative overflow-hidden bg-[#fbf8f2] text-[#29211b]">
          <div className="mx-auto max-w-[1380px] px-6 py-28 md:px-10 md:py-40">
            <Reveal>
              <div className="flex items-end justify-between gap-10">
                <div>
                  <p className="text-[10px] uppercase tracking-[.25em] text-[#956c3d]">Portfolio · Selected images</p>
                  <h2 className="mt-5 max-w-4xl font-serif text-6xl leading-[.9] tracking-[-.045em] md:text-8xl">{hasPublishedPortfolio ? <>Selected work.<br /><em className="text-[#a13b2e]">Specific solutions.</em></> : <>Design references.<br /><em className="text-[#a13b2e]">Ideas made personal.</em></>}</h2>
                </div>
                <p className="hidden max-w-sm text-sm leading-7 text-[#6f6054] md:block">{hasPublishedPortfolio ? "A selection of RR project photographs. Each room answers a different brief, not a fixed package." : "A visual starting point for talking about layout, texture and atmosphere—not a template for your space. Publish RR project photos from the Portfolio Library when they are ready."}</p>
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
                        className="block aspect-[4/5] w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.025]"
                      />
                    ) : (
                      <img
                        src={item.src}
                        alt={item.title || item.project || `Interior design reference ${i + 1}`}
                        loading="lazy"
                        className="block h-auto w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.025]"
                      />
                    )}
                    <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent opacity-0 transition-opacity duration-220 ease-out group-hover:opacity-100" />
                    <div className="pointer-events-none absolute bottom-4 left-4 right-4 flex items-center justify-between translate-y-2 opacity-0 transition duration-220 ease-out group-hover:translate-y-0 group-hover:opacity-100">
                      <span className="text-[8px] uppercase tracking-[.18em] text-white">{item.id || item.project ? `${item.project || "RR project"}${item.title ? ` · ${item.title}` : ""}` : "Interior design reference"}</span>
                      <ArrowUpRight size={14} className="text-[#edca83]" />
                    </div>
                  </figure>
                </Reveal>
              ))}
            </div>

            <div className="mt-12 flex items-center justify-between border-t border-[#2b211a]/15 pt-5">
              <span className="text-[8px] uppercase tracking-[.18em] text-[#956c3d]">{hasPublishedPortfolio ? "RR project photography · updated as new work is published" : "Visual references · real RR work appears here when published"}</span>
              <a href="#contact" className="inline-flex items-center gap-2 text-[9px] uppercase tracking-[.18em] text-[#1d1713] hover:text-[#9d1714]">Discuss your space <ArrowUpRight size={14} /></a>
            </div>
          </div>
        </section>

        <section id="eye" className="relative overflow-hidden bg-[#f1ebe1] text-[#29211b]">
          <div className="mx-auto grid max-w-[1380px] gap-16 px-6 py-28 md:px-10 md:py-40 lg:grid-cols-[.56fr_1.44fr]">
            <Reveal className="lg:sticky lg:top-28 lg:self-start">
              <p className="text-[10px] uppercase tracking-[.25em] text-[#956c3d]">The details that do the work</p>
              <h2 className="mt-5 font-serif text-6xl leading-[.88] tracking-[-.04em] md:text-8xl">Good design is<br /><em className="text-[#a13b2e]">felt in the details.</em></h2>
              <p className="mt-8 max-w-md text-sm leading-7 text-[#6f6054]">A room need not look expensive to feel considered. Proportion, light, storage and the meeting point between materials quietly shape how it works every day.</p>
            </Reveal>

            <div className="grid gap-8">
              {[
                {img: images.proportion, tag:"01 · PROPORTION", title:"A layout should make sense before it makes an impression.", note:"Sightlines, furniture and circulation are arranged around the room—not forced into a template."},
                {img: images.marble, tag:"02 · MATERIAL", title:"Choose materials for more than the photograph.", note:"Weigh look, touch, upkeep and cost together so a finish earns its place in the brief."},
                {img: images.detail, tag:"03 · LIGHT", title:"Light changes how a room lives.", note:"Daylight, task lighting and softer evening layers bring out the architecture without unnecessary complexity."}
              ].map((item, i) => (
                <Reveal key={item.tag} delay={i * 0.06} className="group grid gap-6 border-t border-[#2b211a]/15 pt-7 md:grid-cols-[.95fr_1.05fr] md:items-center">
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <img src={item.img} alt={item.title} className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.025]" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                    <div className="absolute left-5 top-5 text-[8px] uppercase tracking-[.2em] text-white">{item.tag}</div>
                  </div>
                  <div>
                    <h3 className="max-w-xl font-serif text-4xl leading-[.98] tracking-[-.03em] md:text-5xl">{item.title}</h3>
                    <p className="mt-5 max-w-lg text-sm leading-7 text-[#6f6054]">{item.note}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="philosophy" className="bg-[#fbf8f2] text-[#29211b]">
          <div className="mx-auto grid max-w-[1380px] gap-16 px-6 py-28 md:px-10 md:py-40 lg:grid-cols-[.7fr_1.3fr]">
            <Reveal>
              <p className="text-[10px] uppercase tracking-[.25em] text-[#956c3d]">Our philosophy</p>
              <h2 className="mt-5 font-serif text-6xl leading-[.9] md:text-8xl">Custom by design.<br /><em className="text-[#a13b2e]">Thoughtful by nature.</em></h2>
            </Reveal>
            <Reveal delay={0.08}>
              <div className="grid gap-0 border-t border-[#1d1713]/15">
                {principles.map(([n, h, p]) => (
                  <div key={n} className="grid gap-5 border-b border-[#2b211a]/15 py-8 md:grid-cols-[64px_280px_1fr] md:items-start">
                    <span className="text-[10px] tracking-[.2em] text-[#956c3d]">{n}</span>
                    <h3 className="font-serif text-3xl">{h}</h3>
                    <p className="max-w-xl text-sm leading-7 text-[#6f6054]">{p}</p>
                  </div>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        <section id="services" className="bg-[#eee7dd] text-[#29211b]">
          <div className="mx-auto max-w-[1380px] px-6 py-28 md:px-10 md:py-36">
            <Reveal>
              <div className="flex items-end justify-between gap-8">
                <div><p className="text-[10px] uppercase tracking-[.25em] text-[#956c3d]">What we do</p><h2 className="mt-5 font-serif text-5xl leading-[.94] md:text-7xl">Full service. No fixed formula.</h2></div>
                <p className="hidden max-w-md text-sm leading-7 text-[#6f6054] md:block">From one carefully planned room to a full turnkey project, the scope is shaped around what you actually need.</p>
              </div>
            </Reveal>

            <div className="mt-14 border-t border-[#2b211a]/15">
              {services.map(([n, name, desc, img]) => (
                <div key={n} className="service-row group relative grid gap-5 border-b border-[#2b211a]/15 py-8 md:grid-cols-[70px_1fr_1fr_32px] md:items-center">
                  <span className="text-[10px] tracking-[.2em] text-[#956c3d]">{n}</span>
                  <h3 className="font-serif text-3xl md:text-4xl">{name}</h3>
                  <p className="max-w-lg text-sm leading-7 text-[#6f6054]">{desc}</p>
                  <ArrowUpRight className="service-row-arrow text-[#a13b2e]" size={19} />
                  <div className="service-preview pointer-events-none absolute right-[4%] top-1/2 z-20 hidden aspect-[4/3] w-[250px] -translate-y-1/2 overflow-hidden shadow-[0_30px_90px_rgba(0,0,0,.4)] md:block">
                    <img src={images[img]} alt="" className="h-full w-full object-cover opacity-0" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="process" className="bg-[#fbf8f2] text-[#29211b]">
          <div className="mx-auto grid max-w-[1380px] gap-14 px-6 py-28 md:px-10 md:py-36 lg:grid-cols-[.62fr_1.38fr]">
            <Reveal className="lg:sticky lg:top-28 lg:self-start">
              <p className="text-[10px] uppercase tracking-[.25em] text-[#956c3d]">How we work</p>
              <h2 className="mt-5 font-serif text-6xl leading-[.9] md:text-8xl">A clear brief. Considered choices.</h2>
              <p className="mt-7 max-w-md text-sm leading-7 text-[#6f6054]">Custom work should still feel clear. We agree the priorities and scope, refine the design with you, then move into execution with the decisions visible.</p>
            </Reveal>
            <div className="border-t border-[#1d1713]/15">
              {[["01","Brief & priorities","Understand the property, your routine, what must change and the budget you want the design to respect."],["02","Design & options","Refine layout, storage, finishes and lighting into a direction that feels right for you."],["03","Scope & approval","Review the proposal, inclusions, material choices and price before work begins. Changes are discussed before they change the scope."],["04","Execution & handover","Coordinate the work, review the details and resolve the final items before the space is handed over."]].map(([n,h,p],i)=>(
                <Reveal delay={i*.05} key={n} className="grid gap-5 border-b border-[#2b211a]/15 py-10 md:grid-cols-[70px_240px_1fr]">
                  <span className="text-[10px] tracking-[.2em] text-[#956c3d]">{n}</span>
                  <h3 className="font-serif text-3xl md:text-4xl">{h}</h3>
                  <p className="text-sm leading-7 text-[#6f6054]">{p}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#f1ebe1] text-[#29211b]">
          <div className="mx-auto grid max-w-[1380px] gap-8 px-6 py-28 md:px-10 md:py-36 lg:grid-cols-[.85fr_1.15fr] lg:items-center">
            <Reveal>
              <p className="text-[10px] uppercase tracking-[.25em] text-[#956c3d]">Materials · Finish · Value</p>
              <h2 className="mt-5 font-serif text-6xl leading-[.9] md:text-8xl">Choose for the room you will live in.</h2>
            </Reveal>
            <Reveal delay={0.08} className="relative min-h-[540px] overflow-hidden">
              <img src={images.materials} alt="Interior materials and finishes" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/48 via-transparent to-transparent" />
              <div className="absolute bottom-7 left-7 right-7 flex items-end justify-between">
                <div><p className="text-[9px] uppercase tracking-[.2em] text-white/90">Finish · Texture · Maintenance</p><p className="mt-2 max-w-md text-sm leading-6 text-white/90">The right choice balances appearance, day-to-day use, upkeep and the agreed budget. Not every surface needs the most expensive option.</p></div>
                <span className="font-serif text-5xl text-white/35">RR</span>
              </div>
            </Reveal>
          </div>
        </section>

        <section id="journal" className="bg-[#fbf8f2] text-[#29211b]">
          <div className="mx-auto max-w-[1380px] px-6 py-28 md:px-10 md:py-36">
            <Reveal>
              <p className="text-[10px] uppercase tracking-[.25em] text-[#956c3d]">A few things worth getting right</p>
              <h2 className="mt-5 max-w-3xl font-serif text-6xl leading-[.9] md:text-8xl">The details are personal.</h2>
            </Reveal>
            <div className="mt-14 grid gap-0 border-t border-[#2b211a]/15 md:grid-cols-3">
              {journal.map(([n,h,p])=>(
                <article key={n} className="border-b border-[#2b211a]/15 p-8 md:border-r md:last:border-r-0">
                  <span className="text-[9px] tracking-[.2em] text-[#a17745]">{n}</span>
                  <h3 className="mt-12 font-serif text-3xl leading-tight">{h}</h3>
                  <p className="mt-5 text-sm leading-7 text-[#695d53]">{p}</p>
                  <a href="#contact" className="mt-8 inline-flex items-center gap-2 text-[9px] uppercase tracking-[.16em] text-[#a13b2e]">Discuss your project <ChevronRight size={14} /></a>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="contact" className="bg-[#efe7dc] text-[#29211b]">
          <div className="mx-auto grid max-w-[1380px] gap-16 px-6 py-28 md:px-10 md:py-36 lg:grid-cols-[.82fr_1.18fr]">
            <Reveal>
              <p className="text-[10px] uppercase tracking-[.25em] text-[#956c3d]">Tell us what you have in mind</p>
              <h2 className="mt-5 font-serif text-6xl leading-[.9] md:text-8xl">Your space. Your brief. Your budget.</h2>
              <p className="mt-8 max-w-xl text-lg leading-8 text-[#6f6054]">Tell us about the property, the changes you want and the budget you would like us to work within. We will start with the brief—not a pre-set package.</p>
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
              <p className="rr-footer-kicker">Fully customised · thoughtfully priced</p>
              <h2>Make it yours.<br /><em>Make it make sense.</em></h2>
            </div>
            <a href="#contact" className="rr-footer-cta-orbit" aria-label="Start a project">
              <span>START<br />A PROJECT</span>
              <ArrowUpRight size={22} />
            </a>
          </div>
          <div className="rr-footer-cta-line">
            <span>Residential · Commercial · Renovation · Turnkey</span>
            <span>Bengaluru · Karnataka</span>
          </div>
        </section>

        <div className="mx-auto grid max-w-[1380px] gap-12 px-6 py-16 md:px-10 md:grid-cols-[1.2fr_.8fr_.8fr]">
          <div>
            <img
              src={siteAssets.logo || RR_LOGO}
              alt="RR Creative Interiors"
              className="h-14 w-auto object-contain"
            />
            <p className="mt-6 max-w-md text-sm leading-7 text-[#6f6054]">
              Fully customised residential and commercial interiors, planned around your brief, your priorities and an agreed scope.
            </p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-[.2em] text-[#956c3d]">Explore</p>
            <div className="mt-5 grid gap-3 text-sm text-[#514237]">
              <a href="#spaces">Spaces</a>
              <a href="#eye">The Eye</a>
              <a href="#services">Services</a>
              <a href="#process">Process</a>
              <a href="#journal">Notes</a>
            </div>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-[.2em] text-[#956c3d]">Contact</p>
            <div className="mt-5 grid gap-3 text-sm text-[#514237]">
              <a href="tel:+919901592929">+91 99015 92929</a>
              <a href="mailto:sales@rrcreativeinteriors.in">sales@rrcreativeinteriors.in</a>
              <a href="https://wa.me/919901592929" target="_blank" rel="noopener noreferrer">WhatsApp ↗</a>
            </div>
          </div>
        </div>
        <div className="border-t border-[#2b211a]/15 px-6 py-5 text-[8px] uppercase tracking-[.18em] text-[#6f6054] md:px-10">
          © 2026 RR Creative Interiors · Bengaluru · Fully customised interiors, thoughtfully priced.
        </div>
      </footer>
    </>
  );
}