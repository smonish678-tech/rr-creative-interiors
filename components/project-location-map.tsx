"use client";

import { ArrowUpRight, Check, Copy, MapPin, MessageCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

export type MappedProject = {
  id?: string;
  project?: string;
  title?: string;
  location?: string;
  src: string;
  kind?: "image" | "video";
};

const SITE_URL = "https://www.rrcreativeinteriors.in";

export default function ProjectLocationMap({ items }: { items: MappedProject[] }) {
  const projects = useMemo(() => {
    const grouped = new Map<string, MappedProject>();
    for (const item of items) {
      const location = item.location?.trim();
      if (!item.id || !item.project?.trim() || !location) continue;
      const key = `${item.project.trim().toLowerCase()}::${location.toLowerCase()}`;
      const previous = grouped.get(key);
      if (!previous || (previous.kind === "video" && item.kind !== "video")) grouped.set(key, item);
    }
    return [...grouped.values()];
  }, [items]);

  const [selectedId, setSelectedId] = useState("");
  const [copiedId, setCopiedId] = useState("");

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("project");
    if (requested) setSelectedId(requested);
  }, []);

  const selected = projects.find((project) => project.id === selectedId) || projects[0];
  const query = selected?.location ? `${selected.location}, Bengaluru, Karnataka, India` : "Bengaluru, Karnataka, India";
  const mapEmbed = `https://maps.google.com/maps?q=${encodeURIComponent(query)}&z=${selected ? 13 : 10}&output=embed`;
  const projectUrl = (item: MappedProject) => `${SITE_URL}/?project=${encodeURIComponent(item.id || "")}#project-map`;

  async function shareProject(item: MappedProject) {
    const url = projectUrl(item);
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: `${item.project} · RR Creative Interiors`, text: `${item.project} in ${item.location}, Bengaluru`, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(item.id || "");
    } catch {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(`${item.project} · ${item.location}, Bengaluru — ${url}`)}`, "_blank", "noopener,noreferrer");
    }
  }

  return (
    <section id="project-map" aria-labelledby="project-map-title" className="bg-[#f1ebe1] text-[#29211b]">
      <div className="mx-auto max-w-[1380px] px-6 py-24 md:px-10 md:py-36">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[.25em] text-[#956c3d]">Bengaluru · Our neighbourhoods</p>
            <h2 id="project-map-title" className="mt-5 max-w-4xl font-serif text-5xl leading-[.96] tracking-[-.04em] md:text-7xl">
              Explore the city.<br /><em className="text-[#a13b2e]">Find our work.</em>
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-7 text-[#6f6054]">
            Browse projects by neighbourhood and share the spaces you like with family or friends. Locations are added only after they are confirmed.
          </p>
        </div>

        <div className="mt-12 grid overflow-hidden border border-[#2b211a]/15 bg-[#fbf8f2] lg:grid-cols-[1.2fr_.8fr]">
          <div className="min-h-[340px] bg-[#ddd6ca] md:min-h-[490px]">
            <iframe
              key={query}
              title={selected ? `Map of ${selected.location}, Bengaluru` : "Bengaluru neighbourhood map"}
              src={mapEmbed}
              className="block h-full min-h-[340px] w-full border-0 md:min-h-[490px]"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
          <div className="flex max-h-[510px] flex-col overflow-y-auto">
            <div className="border-b border-[#2b211a]/10 px-6 py-6">
              <p className="text-[10px] uppercase tracking-[.19em] text-[#956c3d]">Project locations</p>
              <p className="mt-2 text-sm text-[#6f6054]">{projects.length ? `${projects.length} project${projects.length === 1 ? "" : "s"} with confirmed neighbourhoods` : "Bengaluru project showcase"}</p>
            </div>
            {projects.length ? projects.map((item) => (
              <article key={item.id} className={`grid grid-cols-[88px_1fr] gap-4 border-b border-[#2b211a]/10 px-5 py-5 transition-colors ${selected?.id === item.id ? "bg-[#ede2d4]" : "hover:bg-[#f5eee4]"}`}>
                {item.kind === "video" ? (
                  <video src={item.src} muted playsInline preload="metadata" className="h-[100px] w-[88px] object-cover" aria-label={item.title || item.project || "Project video"} />
                ) : (
                  <img src={item.src} alt={item.title || item.project || "RR project"} loading="lazy" className="h-[100px] w-[88px] object-cover" />
                )}
                <div className="min-w-0">
                  <button type="button" onClick={() => setSelectedId(item.id || "")} className="text-left font-serif text-xl leading-tight hover:text-[#a13b2e]">{item.project}</button>
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-[#76685a]"><MapPin size={12} /> {item.location}, Bengaluru</p>
                  <div className="mt-3 flex flex-wrap gap-4 text-[10px] font-medium uppercase tracking-[.1em]">
                    <button type="button" onClick={() => void shareProject(item)} className="inline-flex items-center gap-1 text-[#a13b2e]">
                      {copiedId === item.id ? <Check size={13} /> : <Copy size={13} />}
                      {copiedId === item.id ? "Link copied" : "Share project"}
                    </button>
                    <a target="_blank" rel="noopener noreferrer" href={`https://api.whatsapp.com/send?text=${encodeURIComponent(`${item.project} in ${item.location}, Bengaluru · ${projectUrl(item)}`)}`} className="inline-flex items-center gap-1 text-[#66564b]"><MessageCircle size={13} /> WhatsApp</a>
                  </div>
                </div>
              </article>
            )) : (
              <div className="flex flex-1 flex-col justify-center px-7 py-12">
                <MapPin size={24} className="text-[#a13b2e]" />
                <h3 className="mt-5 font-serif text-3xl">Around Bengaluru.</h3>
                <p className="mt-3 text-sm leading-7 text-[#6f6054]">
                  Location-labelled RR projects will be featured here as their details are verified and published.
                </p>
                <a href="#portfolio" className="mt-5 inline-flex items-center gap-2 text-xs uppercase tracking-[.12em] text-[#a13b2e]">See the portfolio <ArrowUpRight size={14} /></a>
              </div>
            )}
            {selected && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${selected.location}, Bengaluru, Karnataka, India`)}`}
                target="_blank" rel="noopener noreferrer"
                className="m-5 inline-flex items-center justify-center gap-2 border border-[#29211b]/30 px-5 py-3 text-[10px] uppercase tracking-[.13em] hover:bg-[#eee4d7]"
              >
                Open neighbourhood in Maps <ArrowUpRight size={14} />
              </a>
            )}
          </div>
        </div>
        <p className="mt-4 text-xs leading-6 text-[#796c5d]">Neighbourhoods are approximate and do not reveal customers&apos; private addresses.</p>
      </div>
    </section>
  );
}
