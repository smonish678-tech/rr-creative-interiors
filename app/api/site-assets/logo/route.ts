import { NextResponse } from "next/server";
import { publicWebsiteAssetMap, loadWebsiteAssetConfig } from "@/lib/website-assets-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FALLBACK_LOGO = "/rr-media/logo/rr-official-emblem.webp";

export async function GET(request: Request) {
  try {
    const assets = publicWebsiteAssetMap(await loadWebsiteAssetConfig());
    return NextResponse.redirect(assets.logo || new URL(FALLBACK_LOGO, request.url).toString(), { status: 302 });
  } catch {
    return NextResponse.redirect(new URL(FALLBACK_LOGO, request.url).toString(), { status: 302 });
  }
}
