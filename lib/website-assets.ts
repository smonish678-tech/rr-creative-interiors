export type WebsiteAssetSlot =
  | "logo"
  | "heroScene1"
  | "heroScene2"
  | "heroScene3"
  | "heroScene4"
  | "heroScene5"
  | "heroScene6"
  | "heroScene7"
  | "heroScene8"
  | "livingSpace"
  | "kitchen"
  | "bedroom"
  | "eyeProportion"
  | "eyeMaterial"
  | "eyeLighting"
  | "materialsBoard";

export type WebsiteAssetRecord = {
  id: string;
  url: string;
  pathname: string;
  contentType: string;
  fileName: string;
  sizeBytes: number;
  createdAt: string;
};

export type WebsiteAssetAssignments = Partial<Record<WebsiteAssetSlot, string>>;

export type WebsiteAssetConfig = {
  assets: WebsiteAssetRecord[];
  assignments: WebsiteAssetAssignments;
};

export const WEBSITE_ASSET_GROUPS: Array<{
  title: string;
  description: string;
  slots: Array<{ key: WebsiteAssetSlot; label: string; hint: string }>;
}> = [
  {
    title: "Brand identity",
    description: "Upload a transparent PNG or clean WebP logo. The selected logo appears in the website header and footer.",
    slots: [
      { key: "logo", label: "Main logo", hint: "Prefer a transparent background and generous clear space." },
    ],
  },
  {
    title: "Scroll-opening story",
    description: "Eight image beats accompany the opening scroll story. Assign one strong project photo to each beat; unassigned beats keep their current fallback image.",
    slots: [
      { key: "heroScene1", label: "01 · Opening", hint: "The strongest first impression." },
      { key: "heroScene2", label: "02 · Arrival", hint: "Entry, foyer or an inviting first view." },
      { key: "heroScene3", label: "03 · Daily life", hint: "A living space that feels lived in." },
      { key: "heroScene4", label: "04 · Space & flow", hint: "A sense of proportion and openness." },
      { key: "heroScene5", label: "05 · Craft", hint: "Joinery, material or a precise detail." },
      { key: "heroScene6", label: "06 · Character", hint: "A custom feature with personality." },
      { key: "heroScene7", label: "07 · Feeling", hint: "Warmth, light or a private corner." },
      { key: "heroScene8", label: "08 · Closing image", hint: "A memorable final frame." },
    ],
  },
  {
    title: "Featured spaces",
    description: "These images appear in the main light-palette editorial sections of the website.",
    slots: [
      { key: "livingSpace", label: "Living space", hint: "Living room, dining or a wider view." },
      { key: "kitchen", label: "Kitchen", hint: "Modular, custom or detailed kitchen work." },
      { key: "bedroom", label: "Bedroom", hint: "Bedroom, wardrobe or a calmer private space." },
      { key: "materialsBoard", label: "Materials & finish", hint: "An actual project material or finish photo." },
    ],
  },
  {
    title: "The designer’s eye",
    description: "Three photo-led notes about the details that make a room work.",
    slots: [
      { key: "eyeProportion", label: "Proportion", hint: "Composition, alignment or the room as a whole." },
      { key: "eyeMaterial", label: "Material", hint: "Surface, joinery, hardware or finish." },
      { key: "eyeLighting", label: "Lighting", hint: "Natural light, layered lighting or a detail." },
    ],
  },
];

export const WEBSITE_ASSET_SLOT_OPTIONS = WEBSITE_ASSET_GROUPS.flatMap((group) =>
  group.slots.map((slot) => ({ ...slot, group: group.title })),
);
