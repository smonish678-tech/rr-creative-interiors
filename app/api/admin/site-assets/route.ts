import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { SITE_ASSET_KEY_SET, type SiteAssetKey, type SiteAssetRecord } from "@/lib/site-assets";
import { loadSiteAssets, saveSiteAssets } from "@/lib/site-assets-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ error: "Administrator sign-in is required." }, { status: 401 });
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();
  try {
    return NextResponse.json({ assets: await loadSiteAssets() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Website assets could not be loaded." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();
  let body: { key?: unknown; asset?: unknown; remove?: unknown };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid website asset update." }, { status: 400 });
  }
  if (typeof body.key !== "string" || !SITE_ASSET_KEY_SET.has(body.key)) {
    return NextResponse.json({ error: "Choose a valid website asset slot." }, { status: 400 });
  }
  try {
    const assets = await loadSiteAssets();
    if (body.remove === true) {
      delete assets[body.key as SiteAssetKey];
    } else {
      const record = body.asset as SiteAssetRecord | undefined;
      if (!record || typeof record.url !== "string" || typeof record.pathname !== "string" ||
        typeof record.contentType !== "string" || typeof record.updatedAt !== "string") {
        return NextResponse.json({ error: "The uploaded image details are incomplete." }, { status: 400 });
      }
      assets[body.key as SiteAssetKey] = record;
    }
    await saveSiteAssets(assets);
    return NextResponse.json({ saved: true, assets }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Website asset changes could not be saved." }, { status: 503 });
  }
}
