import { NextResponse } from "next/server";
import { loadPortfolio } from "@/lib/portfolio-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await loadPortfolio();
    return NextResponse.json(
      { items: items.filter((item) => item.published) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    // The public site continues to display its curated static portfolio when Blob is not yet configured.
    return NextResponse.json({ items: [] }, { headers: { "Cache-Control": "no-store" } });
  }
}
