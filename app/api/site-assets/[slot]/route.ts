import { NextResponse } from "next/server";
import { loadWebsiteAssetConfig, publicWebsiteAssetMap } from "@/lib/website-assets-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ slot: string }> }) {
  const { slot } = await context.params;
  if (slot !== "logo") return NextResponse.json({ error: "Website asset slot not found." }, { status: 404 });
  try {
    const assets = publicWebsiteAssetMap(await loadWebsiteAssetConfig());
    const target = assets.logo || new URL("/rr-media/logo/rr%205.png", request.url).toString();
    return NextResponse.redirect(target, { status: 307, headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });
  } catch {
    return NextResponse.redirect(new URL("/rr-media/logo/rr%205.png", request.url), { status: 307 });
  }
}
