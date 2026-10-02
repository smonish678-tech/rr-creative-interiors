"use client";

import { AnimatePresence, motion, useScroll, useTransform } from "framer-motion";
import { ArrowUpRight, ChevronRight, Mail, Menu, MessageCircle, Phone, X } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import MorphScrollHero from "@/components/morph-scroll-hero";
import { SquigglyUnderline } from "@/components/ui/squiggly-underline";
import SmoothScroll from "@/components/smooth-scroll";

const IMG = {
  living: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1800&q=84",
  lounge: "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1600&q=84",
  marble: "https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=1600&q=84",
  bedroom: "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1600&q=84",
  kitchen: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=1600&q=84",
  detail: "https://images.unsplash.com/photo-1540932239986-30128078f3c5?auto=format&fit=crop&w=1600&q=84"
};

const services = [
  ["01", "Turnkey Interiors", "A single design language from the first drawing to final handover.", IMG.living],
  ["02", "Residential Interiors", "Homes planned around everyday rituals, storage, comfort and light.", IMG.lounge],
  ["03", "Commercial Interiors", "Customer-facing spaces where identity, circulation and atmosphere work together.", IMG.marble],
  ["04", "Corporate Interiors", "Workspaces shaped for clarity, culture, focus and hospitality.", IMG.detail],
  ["05", "Modular Kitchens", "Efficient planning, generous storage and material depth.", IMG.kitchen],
  ["06", "Wardrobes & Storage", "Built-ins that disappear into the architecture.", IMG.bedroom],
  ["07", "Lighting & Ceiling", "Lighting layers that change the character of the room through the day.", IMG.detail],
  ["08", "Furniture & Detailing", "TV units, studies, crockery, foyer, pooja, kids rooms and more.", IMG.marble]
];

const principles = [
  ["01", "Listen first", "We start with the way you live, not a style board."],
  ["02", "Solve the plan", "Space, storage, circulation and light are resolved before surface styling."],
  ["03", "Choose with intent", "Materials are selected for how they age, wear and feel — not only how they photograph."],
  ["04", "Carry the line", "The same thinking survives the jump from 3D visual to real site."],
];

const journal = [
  ["01", "The room before the furniture", "Why the invisible decisions — circulation, proportion and light — create the strongest interiors."],
  ["02", "Luxury is not more", "A room can feel richer by removing three things and improving one."],
  ["03", "What we look for in materials", "Texture, reflection, ageing, maintenance and the moment two surfaces meet."]
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

function Nav() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("Home");
  const { scrollYProgress } = useScroll();

  const navigation = [
    { name: "Home", href: "#top", id: "top" },
    { name: "About", href: "#about", id: "about" },
    { name: "Spaces", href: "#spaces", id: "spaces" },
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
            src="https://rrcreativeinteriors.in/wp-content/uploads/2026/01/logo-landscape-1.png"
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
  const [values, setValues] = useState({
    name: "",
    phone: "",
    email: "",
    type: "",
    budget: "",
    message: ""
  });

  const update = (key: keyof typeof values, value: string) =>
    setValues((current) => ({ ...current, [key]: value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();

    const text = [
      "Hello RR Creative Interiors,",
      "Name: " + values.name,
      "Phone: " + values.phone,
      "Email: " + values.email,
      "Project: " + values.type,
      "Budget: " + values.budget,
      "Message: " + values.message
    ].join("\n");

    window.open(
      "https://wa.me/919901592929?text=" + encodeURIComponent(text),
      "_blank",
      "noopener,noreferrer"
    );
    setSent(true);
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
            <span>Tell us where you're starting</span>
            <h3>A little context.<br /><em>Then we take it from there.</em></h3>
          </div>
          <div className="rr-form-mark">RR<span>↗</span></div>
        </div>

        <div className="rr-field-grid">
          <label className="rr-field">
            <span>01 · Name</span>
            <input
              required
              value={values.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="Your name"
            />
          </label>
          <label className="rr-field">
            <span>02 · Phone</span>
            <input
              required
              type="tel"
              value={values.phone}
              onChange={(e) => update("phone", e.target.value)}
              placeholder="+91"
            />
          </label>
          <label className="rr-field">
            <span>03 · Email</span>
            <input
              type="email"
              value={values.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="you@email.com"
            />
          </label>
          <label className="rr-field">
            <span>04 · Project</span>
            <select value={values.type} onChange={(e) => update("type", e.target.value)}>
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
              <button
                type="button"
                key={item}
                className={values.budget === item ? "rr-budget-chip is-selected" : "rr-budget-chip"}
                onClick={() => update("budget", item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <label className="rr-field rr-field-message">
          <span>06 · Tell us about the space</span>
          <textarea
            required
            rows={4}
            value={values.message}
            onChange={(e) => update("message", e.target.value)}
            placeholder="Property, approximate size, what you are planning, and when you'd like to begin."
          />
        </label>

        <div className="rr-form-foot">
          <div className="rr-form-note">
            <span className="rr-signal"></span>
            Usually easier to begin on WhatsApp — this form prepares the enquiry for you.
          </div>
          <button type="submit" className="rr-form-submit">
            <span>Send enquiry</span>
            <MessageCircle size={18} />
            <ArrowUpRight size={16} />
          </button>
        </div>

        {sent && (
          <p className="rr-form-success">
            Your WhatsApp enquiry is ready in a new tab.
          </p>
        )}
      </form>
    </div>
  );
}

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{__html: JSON.stringify({"@context":"https://schema.org","@type":"InteriorDesigner","name":"RR Creative Interiors","url":"https://rrcreativeinteriors.in/","telephone":["+919901592929","+919110241957"],"email":"sales@rrcreativeinteriors.in","address":{"@type":"PostalAddress","streetAddress":"32, 2nd Cross Rd, KNB Aaradya layout, Kommaghatta","addressLocality":"Bengaluru","addressRegion":"Karnataka","postalCode":"560060","addressCountry":"IN"},"areaServed":"Bengaluru","description":"Interior design studio in Bangalore offering residential, commercial and turnkey interior design services."})}} />
      <SmoothScroll />
      <Nav />
      <main id="top">
        <MorphScrollHero />

        <section id="about" className="relative bg-[#eee5d9] text-[#1d1713]">
          <div className="mx-auto grid max-w-[1380px] gap-12 px-6 py-28 md:px-10 lg:grid-cols-[.8fr_1.2fr] lg:py-40">
            <Reveal>
              <p className="text-[10px] uppercase tracking-[0.25em] text-[#98764d]">05 · The studio</p>
              <h2 className="mt-5 max-w-xl font-serif text-5xl leading-[.94] tracking-[-.04em] md:text-7xl">A room should feel inevitable.</h2>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="max-w-3xl">
                <p className="text-xl leading-9 text-[#62564e]">Not staged. Not overloaded. Not designed for a photograph before it is designed for a life.</p>
                <p className="mt-8 text-base leading-8 text-[#6c6056]">RR Creative Interiors works from the inside out: understand the person, solve the plan, choose the material, then carry the idea through the site.</p>
              </div>
            </Reveal>
          </div>
        </section>

        <section id="spaces" className="bg-[#15100d] text-white">
          <div className="mx-auto max-w-[1380px] px-6 py-28 md:px-10 md:py-36">
            <Reveal>
              <div className="flex items-end justify-between gap-8">
                <div>
                  <p className="text-[10px] uppercase tracking-[.25em] text-[#dcb66d]">06 · Spatial studies</p>
                  <h2 className="mt-5 max-w-2xl font-serif text-5xl leading-[.94] md:text-7xl">The mood is part of the architecture.</h2>
                </div>
                <p className="hidden max-w-sm text-sm leading-7 text-white/48 md:block">Temporary demo imagery — these are visual studies, not claimed RR projects. Replace with real project shoots as they arrive.</p>
              </div>
            </Reveal>

            <div className="mt-16 grid gap-6 lg:grid-cols-[1.12fr_.88fr]">
              <Reveal className="group relative min-h-[620px] overflow-hidden">
                <img src={IMG.living} alt="Contemporary living room visual reference" className="absolute inset-0 h-full w-full object-cover transition duration-1000 group-hover:scale-[1.045]" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0f0a08]/80 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-8 md:p-10">
                  <p className="text-[9px] uppercase tracking-[.2em] text-[#e3c27d]">Living · Visual study</p>
                  <h3 className="mt-3 font-serif text-4xl md:text-5xl">Quietly dramatic.</h3>
                </div>
              </Reveal>
              <div className="grid gap-6">
                <Reveal className="group relative min-h-[300px] overflow-hidden">
                  <img src={IMG.kitchen} alt="Modern luxury kitchen visual reference" className="absolute inset-0 h-full w-full object-cover transition duration-1000 group-hover:scale-[1.045]" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
                  <div className="absolute bottom-0 p-7">
                    <p className="text-[9px] uppercase tracking-[.2em] text-[#e3c27d]">Kitchen · Visual study</p>
                    <h3 className="mt-2 font-serif text-3xl">Useful can still be beautiful.</h3>
                  </div>
                </Reveal>
                <Reveal className="group relative min-h-[300px] overflow-hidden">
                  <img src={IMG.bedroom} alt="Modern bedroom visual reference" className="absolute inset-0 h-full w-full object-cover transition duration-1000 group-hover:scale-[1.045]" />
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


        <section id="eye" className="relative overflow-hidden bg-[#16100d] text-white">
          <div className="mx-auto grid max-w-[1380px] gap-16 px-6 py-28 md:px-10 md:py-40 lg:grid-cols-[.56fr_1.44fr]">
            <Reveal className="lg:sticky lg:top-28 lg:self-start">
              <p className="text-[10px] uppercase tracking-[.25em] text-[#dcb66d]">07 · The designer's eye</p>
              <h2 className="mt-5 font-serif text-6xl leading-[.88] tracking-[-.04em] md:text-8xl">We see the<br /><em className="text-[#e3bd71]">quiet decisions.</em></h2>
              <p className="mt-8 max-w-md text-sm leading-7 text-white/48">A premium room rarely announces why it works. The proportion, the visual axis, the light, the edge of a material — those are the decisions we want you to notice only after you feel them.</p>
            </Reveal>

            <div className="grid gap-8">
              {[
                {img: IMG.living, tag:"01 · PROPORTION", title:"A visual axis is felt before it is seen.", note:"Furniture, openings and sightlines are composed so the room reads as one quiet movement."},
                {img: IMG.kitchen, tag:"02 · MATERIAL", title:"Contrast gives restraint a pulse.", note:"Stone against timber. Matte beside reflection. Warm metal against a quieter surface."},
                {img: IMG.detail, tag:"03 · LIGHT", title:"Good lighting edits the room.", note:"Layers of light reveal depth, soften edges and change the atmosphere without changing the architecture."}
              ].map((item, i) => (
                <Reveal key={item.tag} delay={i * 0.06} className="group grid gap-6 border-t border-white/12 pt-7 md:grid-cols-[.95fr_1.05fr] md:items-center">
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <img src={item.img} alt={item.title} className="h-full w-full object-cover transition duration-[1400ms] ease-out group-hover:scale-[1.06]" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                    <div className="absolute left-5 top-5 text-[8px] uppercase tracking-[.2em] text-[#ecd08b]">{item.tag}</div>
                  </div>
                  <div>
                    <h3 className="max-w-xl font-serif text-4xl leading-[.98] tracking-[-.03em] md:text-5xl">{item.title}</h3>
                    <p className="mt-5 max-w-lg text-sm leading-7 text-white/45">{item.note}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="philosophy" className="bg-[#e9dfd2] text-[#1d1713]">
          <div className="mx-auto grid max-w-[1380px] gap-16 px-6 py-28 md:px-10 md:py-40 lg:grid-cols-[.7fr_1.3fr]">
            <Reveal>
              <p className="text-[10px] uppercase tracking-[.25em] text-[#8c6f4f]">08 · Philosophy</p>
              <h2 className="mt-5 font-serif text-6xl leading-[.9] md:text-8xl">The room before the room.</h2>
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

        <section id="services" className="bg-[#17110e] text-white">
          <div className="mx-auto max-w-[1380px] px-6 py-28 md:px-10 md:py-36">
            <Reveal>
              <div className="flex items-end justify-between gap-8">
                <div><p className="text-[10px] uppercase tracking-[.25em] text-[#dcb66d]">09 · Services</p><h2 className="mt-5 font-serif text-5xl leading-[.94] md:text-7xl">Everything beneath the surface.</h2></div>
                <p className="hidden max-w-md text-sm leading-7 text-white/45 md:block">A complete design and execution vocabulary — without forcing every project into the same mould.</p>
              </div>
            </Reveal>

            <div className="mt-14 border-t border-white/12">
              {services.map(([n, name, desc, img]) => (
                <motion.div key={n} className="service-row group relative grid gap-5 border-b border-white/12 py-8 md:grid-cols-[70px_1fr_1fr_32px] md:items-center" whileHover={{ x: 8 }}>
                  <span className="text-[10px] tracking-[.2em] text-[#d9ad5c]">{n}</span>
                  <h3 className="font-serif text-3xl md:text-4xl">{name}</h3>
                  <p className="max-w-lg text-sm leading-7 text-white/48">{desc}</p>
                  <ArrowUpRight className="text-[#e1c078] transition group-hover:translate-x-1 group-hover:-translate-y-1" size={19} />
                  <div className="service-preview pointer-events-none absolute right-[4%] top-1/2 z-20 hidden aspect-[4/3] w-[250px] -translate-y-1/2 overflow-hidden shadow-[0_30px_90px_rgba(0,0,0,.4)] md:block">
                    <img src={img} alt="" className="h-full w-full object-cover opacity-0 transition duration-500 group-hover:opacity-100" />
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        <section id="process" className="bg-[#eee5d9] text-[#1d1713]">
          <div className="mx-auto grid max-w-[1380px] gap-14 px-6 py-28 md:px-10 md:py-36 lg:grid-cols-[.62fr_1.38fr]">
            <Reveal className="lg:sticky lg:top-28 lg:self-start">
              <p className="text-[10px] uppercase tracking-[.25em] text-[#8c6f4f]">10 · Process</p>
              <h2 className="mt-5 font-serif text-6xl leading-[.9] md:text-8xl">Clear enough to trust.</h2>
              <p className="mt-7 max-w-md text-sm leading-7 text-[#695d53]">The goal is not to make the process feel complicated. It is to make complex work feel calm from the outside.</p>
            </Reveal>
            <div className="border-t border-[#1d1713]/15">
              {[["01","Discover","Understand the property, the people, the routine, the constraints and the ambition."],["02","Design","Layout, 3D, materials, lighting and details are refined into one visual language."],["03","Build","Fabrication, site coordination and quality checks keep the design honest in the real world."],["04","Handover","The final space is resolved down to the small things before it becomes yours."]].map(([n,h,p],i)=>(
                <Reveal delay={i*.05} key={n} className="grid gap-5 border-b border-[#1d1713]/15 py-10 md:grid-cols-[70px_240px_1fr]">
                  <span className="text-[10px] tracking-[.2em] text-[#a17745]">{n}</span>
                  <h3 className="font-serif text-3xl md:text-4xl">{h}</h3>
                  <p className="text-sm leading-7 text-[#695d53]">{p}</p>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#16100d] text-white">
          <div className="mx-auto grid max-w-[1380px] gap-8 px-6 py-28 md:px-10 md:py-36 lg:grid-cols-[.85fr_1.15fr] lg:items-center">
            <Reveal>
              <p className="text-[10px] uppercase tracking-[.25em] text-[#dcb66d]">11 · Material study</p>
              <h2 className="mt-5 font-serif text-6xl leading-[.9] md:text-8xl">Texture is where the design becomes physical.</h2>
            </Reveal>
            <Reveal delay={0.08} className="relative min-h-[540px] overflow-hidden">
              <img src="https://i.pinimg.com/originals/2e/9f/ef/2e9fefb451405b618d9028b79f2cf94c.png" alt="Luxury materials moodboard visual reference" className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" />
              <div className="absolute bottom-7 left-7 right-7 flex items-end justify-between">
                <div><p className="text-[9px] uppercase tracking-[.2em] text-[#e3c27d]">Marble · timber · brass · stone</p><p className="mt-2 max-w-md text-sm leading-6 text-white/70">Temporary moodboard reference. The live site can later use RR's actual material library and site photography.</p></div>
                <span className="font-serif text-5xl text-white/35">RR</span>
              </div>
            </Reveal>
          </div>
        </section>

        <section id="journal" className="bg-[#e8ded1] text-[#1d1713]">
          <div className="mx-auto max-w-[1380px] px-6 py-28 md:px-10 md:py-36">
            <Reveal>
              <p className="text-[10px] uppercase tracking-[.25em] text-[#8c6f4f]">12 · Journal</p>
              <h2 className="mt-5 max-w-3xl font-serif text-6xl leading-[.9] md:text-8xl">Ideas worth living with.</h2>
            </Reveal>
            <div className="mt-14 grid gap-0 border-t border-[#1d1713]/15 md:grid-cols-3">
              {journal.map(([n,h,p])=>(
                <article key={n} className="border-b border-[#1d1713]/15 p-8 md:border-r md:last:border-r-0">
                  <span className="text-[9px] tracking-[.2em] text-[#a17745]">{n}</span>
                  <h3 className="mt-12 font-serif text-3xl leading-tight">{h}</h3>
                  <p className="mt-5 text-sm leading-7 text-[#695d53]">{p}</p>
                  <a href="https://rrcreativeinteriors.in/" target="_blank" rel="noopener noreferrer" className="mt-8 inline-flex items-center gap-2 text-[9px] uppercase tracking-[.16em]">Read the studio journal <ChevronRight size={14} /></a>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="contact" className="bg-[#f1e9dc] text-[#1d1713]">
          <div className="mx-auto grid max-w-[1380px] gap-16 px-6 py-28 md:px-10 md:py-36 lg:grid-cols-[.82fr_1.18fr]">
            <Reveal>
              <p className="text-[10px] uppercase tracking-[.25em] text-[#8c6f4f]">13 · Start a project</p>
              <h2 className="mt-5 font-serif text-6xl leading-[.9] md:text-8xl">Let's make room for what matters.</h2>
              <p className="mt-8 max-w-xl text-lg leading-8 text-[#695d53]">Tell us about the home, office, retail space or turnkey project you have in mind.</p>
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
              <p className="rr-footer-kicker">13 · Start something worth keeping</p>
              <h2>Give your space<br /><em>a point of view.</em></h2>
            </div>
            <a href="#contact" className="rr-footer-cta-orbit" aria-label="Start a project">
              <span>START<br />A PROJECT</span>
              <ArrowUpRight size={22} />
            </a>
          </div>
          <div className="rr-footer-cta-line">
            <span>Residential · Commercial · Turnkey</span>
            <span>Bangalore · Karnataka</span>
          </div>
        </section>

        <div className="mx-auto grid max-w-[1380px] gap-12 px-6 py-16 md:px-10 md:grid-cols-[1.2fr_.8fr_.8fr]">
          <div>
            <img
              src="https://rrcreativeinteriors.in/wp-content/uploads/2026/01/logo-landscape-1.png"
              alt="RR Creative Interiors"
              className="h-14 w-auto brightness-110"
            />
            <p className="mt-6 max-w-md text-sm leading-7 text-white/42">
              Beyond The Ordinary — interior environments shaped around how people actually live.
            </p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-[.2em] text-[#dcb66d]">Explore</p>
            <div className="mt-5 grid gap-3 text-sm text-white/62">
              <a href="#spaces">Spaces</a>
              <a href="#eye">The Eye</a>
              <a href="#services">Services</a>
              <a href="#process">Process</a>
              <a href="#journal">Journal</a>
            </div>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-[.2em] text-[#dcb66d]">Contact</p>
            <div className="mt-5 grid gap-3 text-sm text-white/62">
              <a href="tel:+919901592929">+91 99015 92929</a>
              <a href="mailto:sales@rrcreativeinteriors.in">sales@rrcreativeinteriors.in</a>
              <a href="https://wa.me/919901592929" target="_blank" rel="noopener noreferrer">WhatsApp ↗</a>
            </div>
          </div>
        </div>
        <div className="border-t border-white/10 px-6 py-5 text-[8px] uppercase tracking-[.18em] text-white/25 md:px-10">
          © 2026 RR Creative Interiors · Bangalore · Demo experience — replace visual references with real RR work before launch
        </div>
      </footer>
    </>
  );
}