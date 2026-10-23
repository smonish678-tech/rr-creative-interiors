import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { isAdminRequest } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Administrator sign-in is required." }, { status: 401 });
  const token = process.env.RR_PORTFOLIO_MANIFEST_BLOB_TOKEN;
  if (!token) return NextResponse.json({ error: "Private document storage is not configured. Connect a private Vercel Blob store and set RR_PORTFOLIO_MANIFEST_BLOB_TOKEN." }, { status: 503 });
  try {
    const form = await request.formData();
    const value = form.get("file");
    if (!(value instanceof File)) return NextResponse.json({ error: "Choose a signed PDF file first." }, { status: 400 });
    if (value.type !== "application/pdf" || !value.name.toLocaleLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "For signed evidence, upload a PDF file. If using an e-signature provider, record its envelope reference instead." }, { status: 400 });
    }
    if (value.size < 1 || value.size > 4 * 1024 * 1024) {
      return NextResponse.json({ error: "Signed PDF must be 4 MB or smaller in this upload flow." }, { status: 413 });
    }
    const path = `rr-creative-interiors/private-documents/${new Date().toISOString().slice(0,10)}/${randomUUID()}.pdf`;
    const blob = await put(path, value, { access: "private", token, contentType: "application/pdf", addRandomSuffix: false, allowOverwrite: false });
    return NextResponse.json({ path: blob.pathname, fileName: value.name, size: value.size }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "The signed document could not be stored privately. No document has been marked as signed." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
