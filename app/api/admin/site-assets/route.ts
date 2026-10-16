import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { WEBSITE_ASSET_SLOT_OPTIONS, type WebsiteAssetAssignments, type WebsiteAssetRecord } from "@/lib/website-assets";
import { loadWebsiteAssetConfig, publicWebsiteAssetMap, removeWebsiteAsset, saveWebsiteAssetConfig } from "@/lib/website-assets-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function denied() {
  return NextResponse.json({ error: "Administrator sign-in is required." }, { status: 401, headers: { "Cache-Control": "no-store" } });
}

function unavailable(error: unknown) {
  const message = error instanceof Error ? error.message : "Website assets are unavailable.";
  return NextResponse.json({ error: message }, { status: 503, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return denied();
  try {
    return NextResponse.json(await loadWebsiteAssetConfig(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return unavailable(error);
  }
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return denied();
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Website asset request is invalid." }, { status: 400 });
    }
    const input = body as Record<string, unknown>;
    const config = await loadWebsiteAssetConfig();

    if (input.action === "addAsset") {
      const url = typeof input.url === "string" ? input.url : "";
      const pathname = typeof input.pathname === "string" ? input.pathname : "";
      const contentType = typeof input.contentType === "string" ? input.contentType : "";
      let parsed: URL;
      try { parsed = new URL(url); } catch { return NextResponse.json({ error: "The uploaded image URL is invalid." }, { status: 400 }); }
      const allowedImageTypes = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/heic"];
      if (parsed.protocol !== "https:" || !parsed.hostname.endsWith(".blob.vercel-storage.com") ||
        !pathname.startsWith("rr-creative-interiors/site-assets/") || !allowedImageTypes.includes(contentType)) {
        return NextResponse.json({ error: "Only JPG, PNG, WebP, AVIF and HEIC images uploaded to RR website storage are accepted." }, { status: 400 });
      }
      if (config.assets.length >= 500) return NextResponse.json({ error: "The website image library has reached its 500-item limit." }, { status: 400 });
      const fileName = typeof input.fileName === "string" ? input.fileName.trim().slice(0, 160) : "website-image";
      const sizeBytes = typeof input.sizeBytes === "number" && Number.isFinite(input.sizeBytes) ? Math.max(0, Math.round(input.sizeBytes)) : 0;
      if (sizeBytes <= 0 || sizeBytes > 30 * 1024 * 1024) return NextResponse.json({ error: "Each website image must be no larger than 30 MB." }, { status: 400 });
      const asset: WebsiteAssetRecord = { id: randomUUID(), url, pathname, contentType, fileName: fileName || "website-image", sizeBytes, createdAt: new Date().toISOString() };
      await saveWebsiteAssetConfig({ ...config, assets: [asset, ...config.assets] });
      return NextResponse.json({ asset }, { status: 201, headers: { "Cache-Control": "no-store" } });
    }

    if (input.action === "assignments") {
      if (!input.assignments || typeof input.assignments !== "object" || Array.isArray(input.assignments)) {
        return NextResponse.json({ error: "Choose a website slot and an image." }, { status: 400 });
      }
      const submitted = input.assignments as Record<string, unknown>;
      const accepted = new Set(WEBSITE_ASSET_SLOT_OPTIONS.map((slot) => slot.key));
      if (Object.keys(submitted).some((key) => !accepted.has(key as never))) {
        return NextResponse.json({ error: "One or more website image slots are not recognised." }, { status: 400 });
      }
      const assetIds = new Set(config.assets.map((asset) => asset.id));
      const assignments: WebsiteAssetAssignments = {};
      for (const slot of WEBSITE_ASSET_SLOT_OPTIONS) {
        const value = submitted[slot.key];
        if (value === "" || value === null || value === undefined) continue;
        if (typeof value !== "string" || !assetIds.has(value)) {
          return NextResponse.json({ error: `Choose a valid image for “${slot.label}”.` }, { status: 400 });
        }
        assignments[slot.key] = value;
      }
      await saveWebsiteAssetConfig({ ...config, assignments });
      return NextResponse.json({ assignments, publicAssets: publicWebsiteAssetMap({ ...config, assignments }) }, { headers: { "Cache-Control": "no-store" } });
    }

    return NextResponse.json({ error: "Unknown website asset operation." }, { status: 400 });
  } catch (error) {
    return unavailable(error);
  }
}

export async function DELETE(request: Request) {
  if (!isAdminRequest(request)) return denied();
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "An image ID is required." }, { status: 400 });
  try {
    await removeWebsiteAsset(id);
    return NextResponse.json({ deleted: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not delete the website image.";
    return NextResponse.json({ error: message }, { status: message.includes("assigned") ? 409 : 503, headers: { "Cache-Control": "no-store" } });
  }
}
