import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { deletePortfolioBlob, loadPortfolio, savePortfolio, type PortfolioAsset } from "@/lib/portfolio-store";
import { isSiteImageSlot } from "@/lib/site-image-slots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ error: "Administrator sign-in is required." }, { status: 401 });
}

function unavailable(error: unknown) {
  const message = error instanceof Error ? error.message : "Portfolio storage is unavailable.";
  return NextResponse.json({ error: message }, { status: 503 });
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();
  try {
    return NextResponse.json({ items: await loadPortfolio() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return unavailable(error);
  }
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();
  try {
    const body = (await request.json()) as Partial<PortfolioAsset>;
    const url = typeof body.url === "string" ? body.url : "";
    const pathname = typeof body.pathname === "string" ? body.pathname : "";
    const contentType = typeof body.contentType === "string" ? body.contentType : "";
    const urlParsed = new URL(url);
    if (
      urlParsed.protocol !== "https:" ||
      !urlParsed.hostname.endsWith(".blob.vercel-storage.com") ||
      !pathname.startsWith("rr-creative-interiors/portfolio/") ||
      !(contentType.startsWith("image/") || contentType.startsWith("video/"))
    ) {
      return NextResponse.json({ error: "The uploaded file details are not valid." }, { status: 400 });
    }

    const siteSlot = isSiteImageSlot(body.siteSlot) ? body.siteSlot : "gallery";
    const kind = contentType.startsWith("video/") ? "video" : "image";
    if (siteSlot !== "gallery" && kind !== "image") {
      return NextResponse.json({ error: "Website placements require an image. Videos can be added to the portfolio gallery." }, { status: 400 });
    }
    const existing = await loadPortfolio();
    const asset: PortfolioAsset = {
      id: randomUUID(),
      url,
      pathname,
      contentType,
      kind,
      title: typeof body.title === "string" && body.title.trim() ? body.title.trim().slice(0, 140) : pathname.split("/").pop() || "Untitled project",
      project: typeof body.project === "string" ? body.project.trim().slice(0, 140) : "",
      description: typeof body.description === "string" ? body.description.trim().slice(0, 600) : "",
      category: typeof body.category === "string" ? body.category.trim().slice(0, 60) : "Residential",
      published: body.published === true,
      siteSlot,
      createdAt: new Date().toISOString(),
    };
    if (!asset.project) return NextResponse.json({ error: "Enter a project name." }, { status: 400 });
    const previous = siteSlot === "gallery" ? existing : existing.map((item) => item.siteSlot === siteSlot ? { ...item, siteSlot: "gallery" } : item);
    await savePortfolio([asset, ...previous]);
    return NextResponse.json({ item: asset }, { status: 201 });
  } catch (error) {
    return unavailable(error);
  }
}

export async function PATCH(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();
  try {
    const body = (await request.json()) as { id?: unknown; published?: unknown; siteSlot?: unknown };
    if (typeof body.id !== "string" || (body.published === undefined && body.siteSlot === undefined) || (body.published !== undefined && typeof body.published !== "boolean") || (body.siteSlot !== undefined && !isSiteImageSlot(body.siteSlot))) {
      return NextResponse.json({ error: "A valid portfolio item update is required." }, { status: 400 });
    }
    const items = await loadPortfolio();
    const index = items.findIndex((item) => item.id === body.id);
    if (index < 0) return NextResponse.json({ error: "Portfolio item not found." }, { status: 404 });
    const nextSlot = body.siteSlot as string | undefined;
    if (nextSlot && nextSlot !== "gallery" && items[index].kind !== "image") {
      return NextResponse.json({ error: "Videos can only be assigned to the portfolio gallery." }, { status: 400 });
    }
    if (nextSlot && nextSlot !== "gallery") {
      for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
        if (itemIndex !== index && items[itemIndex].siteSlot === nextSlot) items[itemIndex] = { ...items[itemIndex], siteSlot: "gallery" };
      }
    }
    items[index] = { ...items[index], ...(body.published === undefined ? {} : { published: body.published }), ...(nextSlot === undefined ? {} : { siteSlot: nextSlot }) };
    await savePortfolio(items);
    return NextResponse.json({ item: items[index] });
  } catch (error) {
    return unavailable(error);
  }
}

export async function DELETE(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "A portfolio item ID is required." }, { status: 400 });
    const items = await loadPortfolio();
    const asset = items.find((item) => item.id === id);
    if (!asset) return NextResponse.json({ error: "Portfolio item not found." }, { status: 404 });
    await savePortfolio(items.filter((item) => item.id !== id));
    await deletePortfolioBlob(asset.url);
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return unavailable(error);
  }
}
