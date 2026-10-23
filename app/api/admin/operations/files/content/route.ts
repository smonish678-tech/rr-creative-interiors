import { NextResponse } from "next/server";
import { get } from "@vercel/blob";
import { isAdminRequest } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Administrator sign-in is required." }, { status: 401 });
  const pathname = new URL(request.url).searchParams.get("path") || "";
  const token = process.env.RR_PORTFOLIO_MANIFEST_BLOB_TOKEN;
  if (!token) return NextResponse.json({ error: "Private document storage is not configured." }, { status: 503 });
  if (!pathname.startsWith("rr-creative-interiors/private-documents/") || !pathname.endsWith(".pdf") || pathname.includes("..")) {
    return NextResponse.json({ error: "Private document path is invalid." }, { status: 400 });
  }
  try {
    const result = await get(pathname, { access: "private", token, useCache: false });
    if (!result || result.statusCode !== 200) return NextResponse.json({ error: "Signed document was not found." }, { status: 404 });
    return new Response(result.stream, { headers: {
      "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="signed-document.pdf"',
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    }});
  } catch {
    return NextResponse.json({ error: "Could not retrieve the private document." }, { status: 503 });
  }
}
