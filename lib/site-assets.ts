export const SITE_ASSET_GROUPS = [
  {
    id: "brand",
    title: "Brand identity",
    description: "Replace the header/footer logo and browser mark.",
    slots: [
      { key: "brandLogo", label: "Primary logo", help: "Prefer a transparent PNG or WebP with clear horizontal proportions.", recommended: "Transparent PNG / WebP" },
      { key: "brandMark", label: "Brand mark / favicon", help: "A compact symbol that stays recognisable at small sizes.", recommended: "Square PNG / WebP" },
    ],
  },
  {
    id: "hero",
    title: "Opening story",
    description: "The eight images used by the scroll-led opening. Replace any scene without touching code.",
    slots: [
      { key: "heroScene1", label: "01 · First impression", help: "The image that introduces the RR point of view.", recommended: "Wide, 16:9 or wider" },
      { key: "heroScene2", label: "02 · Arrival", help: "An entry, living area or strong first view.", recommended: "Wide, 16:9 or wider" },
      { key: "heroScene3", label: "03 · How it works", help: "A layout, living space or usable everyday detail.", recommended: "Wide, 16:9 or wider" },
      { key: "heroScene4", label: "04 · Space to breathe", help: "A quiet, uncluttered composition.", recommended: "Wide, 16:9 or wider" },
      { key: "heroScene5", label: "05 · Craft & detail", help: "Joinery, fittings, finish or close material work.", recommended: "Wide, 16:9 or wider" },
      { key: "heroScene6", label: "06 · Character", help: "A distinctive room or considered feature.", recommended: "Wide, 16:9 or wider" },
      { key: "heroScene7", label: "07 · The feeling", help: "A warm, lived-in or welcoming interior.", recommended: "Wide, 16:9 or wider" },
      { key: "heroScene8", label: "08 · The result", help: "The image that best sums up RR's approach.", recommended: "Wide, 16:9 or wider" },
    ],
  },
  {
    id: "sections",
    title: "Homepage photography",
    description: "Images for the spaces, designer's eye and material sections.",
    slots: [
      { key: "spacesLiving", label: "Living / main space", help: "A strong room photograph for the main spaces feature.", recommended: "Landscape" },
      { key: "spacesKitchen", label: "Kitchen / utility", help: "Kitchen, pantry or cabinetry photograph.", recommended: "Landscape" },
      { key: "spacesBedroom", label: "Bedroom / private space", help: "Bedroom, wardrobe or personal-space photograph.", recommended: "Landscape" },
      { key: "eyeProportion", label: "Design detail · proportion", help: "A composition showing layout, alignment or sightlines.", recommended: "4:3 landscape" },
      { key: "eyeMaterial", label: "Design detail · material", help: "A close-up of real material choices or custom joinery.", recommended: "4:3 landscape" },
      { key: "eyeLighting", label: "Design detail · lighting", help: "A real lighting layer, cove, pendant or lit feature.", recommended: "4:3 landscape" },
      { key: "materialMoodboard", label: "Material palette", help: "Material board or a photographed finish combination.", recommended: "Landscape" },
    ],
  },
] as const;

export type SiteAssetKey = typeof SITE_ASSET_GROUPS[number]["slots"][number]["key"];
export type SiteAssetRecord = { url: string; pathname: string; contentType: string; updatedAt: string };
export type SiteAssetManifest = Partial<Record<SiteAssetKey, SiteAssetRecord>>;
export const SITE_ASSET_KEYS = SITE_ASSET_GROUPS.flatMap((group) => group.slots.map((slot) => slot.key)) as SiteAssetKey[];
export const SITE_ASSET_KEY_SET = new Set<string>(SITE_ASSET_KEYS);
