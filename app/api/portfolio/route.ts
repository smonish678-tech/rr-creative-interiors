import { NextResponse } from "next/server";
import { loadPortfolio } from "@/lib/portfolio-store";
import type { SiteImageUrlMap } from "@/lib/site-image-slots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const published = (await loadPortfolio()).filter((item) => item.published);
    const siteImages: SiteImageUrlMap = {};
    let brandLogo: string | null = null;
    for (const item of published) {
      if (item.siteSlot === "brand-logo" && item.kind === "image") brandLogo = item.url;
      else if (item.siteSlot && item.siteSlot !== "gallery" && (item.siteSlot.startsWith("hero-") || ["living", "lounge", "marble", "bedroom", "kitchen", "detail"].includes(item.siteSlot))) {
        siteImages[item.siteSlot as keyof SiteImageUrlMap] = item.url;
      }
    }
    const items = published.filter((item) => !item.siteSlot || item.siteSlot === "gallery");
    return NextResponse.json(
      { items, brandLogo, siteImages },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    // The public site continues to display its curated static portfolio when Blob is not yet configured.
    return NextResponse.json({ items: [] }, { headers: { "Cache-Control": "no-store" } });
  }
}
