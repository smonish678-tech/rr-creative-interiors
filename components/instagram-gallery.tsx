"use client";

import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";

type InstagramItem = {
  id: string;
  type: "image" | "video";
  src: string;
  poster?: string;
  date?: string;
  album?: boolean;
};

function GalleryVideo({ item }: { item: InstagramItem }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (entry.isIntersecting && !prefersReducedMotion && document.visibilityState === "visible") {
          video.muted = true;
          void video.play().catch(() => {
            // Some browsers require a tap. Native video controls remain available.
          });
        } else {
          video.pause();
        }
      },
      { threshold: 0.65 }
    );
    observer.observe(video);
    const handleVisibility = () => {
      if (document.visibilityState !== "visible") video.pause();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", handleVisibility);
      video.pause();
    };
  }, [item.src]);

  return (
    <video
      ref={ref}
      src={item.src}
      poster={item.poster}
      controls
      muted
      loop
      playsInline
      preload="none"
      aria-label="RR Creative Interiors Instagram video"
      className="block aspect-[4/5] h-full w-full bg-[#211b17] object-cover"
    />
  );
}

export default function InstagramGallery() {
  const [items, setItems] = useState<InstagramItem[]>([]);
  const [selectedPhoto, setSelectedPhoto] = useState<InstagramItem | null>(null);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const refresh = async () => {
      try {
        const result = await fetch("/api/instagram", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!result.ok) return;
        const data: unknown = await result.json();
        if (
          active &&
          data &&
          typeof data === "object" &&
          "items" in data &&
          Array.isArray(data.items)
        ) {
          setItems(data.items as InstagramItem[]);
        }
      } catch {
        // Keep the last successful gallery during a temporary API interruption.
      }
    };

    void refresh();
    // Also refresh while the page stays open; new uploads need no redeployment.
    const interval = window.setInterval(() => void refresh(), 5 * 60 * 1000);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!selectedPhoto) return;
    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedPhoto(null);
    };
    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, [selectedPhoto]);

  // Do not show a misleading "live" feed before Instagram is connected.
  if (!items.length) return null;

  return (
    <section aria-labelledby="instagram-gallery-heading" className="bg-[#eee7dd] text-[#29211b]">
      <div className="mx-auto max-w-[1380px] px-6 py-24 md:px-10 md:py-32">
        <div className="flex flex-col gap-6 border-t border-[#2b211a]/15 pt-10 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[.25em] text-[#956c3d]">Fresh from the studio</p>
            <h2 id="instagram-gallery-heading" className="mt-5 max-w-3xl font-serif text-5xl leading-[.95] tracking-[-.04em] md:text-7xl">
              Spaces in motion.<br /><em className="text-[#a13b2e]">Moments worth sharing.</em>
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-7 text-[#6f6054]">
            The newest photographs and videos from RR Creative Interiors, updated as the studio shares new work.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item, index) => (
            <div key={item.id} className="group relative min-w-0 overflow-hidden bg-[#d8cabc]">
              {item.type === "video" ? (
                <GalleryVideo item={item} />
              ) : (
                <button
                  type="button"
                  onClick={() => setSelectedPhoto(item)}
                  aria-label={"Enlarge RR Creative Interiors photo " + (index + 1)}
                  className="block w-full cursor-zoom-in overflow-hidden"
                >
                  <img
                    src={item.src}
                    alt={"RR Creative Interiors — latest Instagram photo " + (index + 1)}
                    loading="lazy"
                    className="block aspect-[4/5] w-full object-cover transition-transform duration-500 group-hover:scale-[1.035]"
                  />
                </button>
              )}
              <div className="pointer-events-none absolute left-3 top-3 flex items-center gap-1.5 bg-[#1c1714]/75 px-2.5 py-1.5 text-[9px] font-medium uppercase tracking-[.13em] text-white backdrop-blur-sm">
                {item.type === "video" ? <Play size={10} fill="currentColor" /> : null}
                {item.type === "video" ? "Reel / Video" : item.album ? "Project album" : "Photo"}
              </div>
            </div>
          ))}
        </div>
      </div>

      {selectedPhoto && (
        <div
          role="presentation"
          onClick={() => setSelectedPhoto(null)}
          className="fixed inset-0 z-[90] flex cursor-zoom-out items-center justify-center bg-black/90 p-4 md:p-10"
        >
          <button
            type="button"
            aria-label="Close enlarged photo"
            onClick={() => setSelectedPhoto(null)}
            className="absolute right-5 top-5 z-10 rounded-full bg-white/15 px-4 py-2 text-sm text-white"
          >
            Close
          </button>
          <img
            src={selectedPhoto.src}
            alt="RR Creative Interiors — enlarged Instagram photograph"
            onClick={(event) => event.stopPropagation()}
            className="max-h-full max-w-full cursor-default object-contain"
          />
        </div>
      )}
    </section>
  );
}
