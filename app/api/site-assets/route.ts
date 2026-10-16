import { NextResponse } from "next/server";
import { loadWebsiteAssetConfig, publicWebsiteAssetMap } from "@/lib/website-assets-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ assets: publicWebsiteAssetMap(await loadWebsiteAssetConfig()) }, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch {
    return NextResponse.json({ assets: {} }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  }
}
