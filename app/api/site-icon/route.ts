import { NextResponse } from "next/server";
import { loadPortfolio } from "@/lib/portfolio-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const assets = await loadPortfolio();
    const logo = assets.find((item) => item.published && item.kind === "image" && item.siteSlot === "brand-logo");
    const destination = logo?.url || new URL("/rr-media/logo/Glossy%20Red%20and%20Gold%20Split%20Emblem.png", request.url).toString();
    return NextResponse.redirect(destination, {
      status: 307,
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch {
    return NextResponse.redirect(new URL("/rr-media/logo/Glossy%20Red%20and%20Gold%20Split%20Emblem.png", request.url), {
      status: 307,
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  }
}
