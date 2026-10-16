import { NextResponse } from "next/server";
import { loadSiteAssets } from "@/lib/site-assets-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const assets = await loadSiteAssets();
    const urls = Object.fromEntries(Object.entries(assets).map(([key, value]) => [key, value?.url]));
    return NextResponse.json({ assets: urls }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    // The public site uses bundled editorial fallbacks when storage has not been configured.
    return NextResponse.json({ assets: {} }, { headers: { "Cache-Control": "no-store" } });
  }
}
