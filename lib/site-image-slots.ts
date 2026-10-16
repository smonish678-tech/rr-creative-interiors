export const SITE_IMAGE_SLOTS = [
  { value: "gallery", label: "Portfolio gallery", media: "any", help: "Show in the public portfolio gallery." },
  { value: "brand-logo", label: "Website logo · header and footer", media: "image", help: "Replace the logo at the top and bottom of every page." },
  { value: "hero-01", label: "Story hero · 01", media: "image", help: "Opening visual: custom design, considered pricing." },
  { value: "hero-02", label: "Story hero · 02", media: "image", help: "Arrival and first impressions." },
  { value: "hero-03", label: "Story hero · 03", media: "image", help: "Planning for everyday life." },
  { value: "hero-04", label: "Story hero · 04", media: "image", help: "Space, proportion and flow." },
  { value: "hero-05", label: "Story hero · 05", media: "image", help: "Materials and craftsmanship." },
  { value: "hero-06", label: "Story hero · 06", media: "image", help: "Character, not templates." },
  { value: "hero-07", label: "Story hero · 07", media: "image", help: "How the finished space feels." },
  { value: "hero-08", label: "Story hero · 08", media: "image", help: "The final brand impression." },
  { value: "living", label: "Spatial studies · living room", media: "image", help: "Used in the spatial feature and design-eye section." },
  { value: "lounge", label: "Spatial studies · lounge", media: "image", help: "Used in the spatial studies section." },
  { value: "marble", label: "Spatial studies · material detail", media: "image", help: "Used in commercial, furniture and material examples." },
  { value: "bedroom", label: "Spatial studies · bedroom", media: "image", help: "Used in bedroom and storage examples." },
  { value: "kitchen", label: "Spatial studies · kitchen", media: "image", help: "Used in kitchen-related sections." },
  { value: "detail", label: "Spatial studies · lighting / detail", media: "image", help: "Used in the design-eye and detail-focused sections." },
] as const;

export type SiteImageSlot = (typeof SITE_IMAGE_SLOTS)[number]["value"];
export type SiteImageUrlMap = Partial<Record<Exclude<SiteImageSlot, "gallery" | "brand-logo">, string>>;

export function isSiteImageSlot(value: unknown): value is SiteImageSlot {
  return typeof value === "string" && SITE_IMAGE_SLOTS.some((slot) => slot.value === value);
}

export function getSiteImageSlot(value: string | undefined) {
  return SITE_IMAGE_SLOTS.find((slot) => slot.value === value) || SITE_IMAGE_SLOTS[0];
}
