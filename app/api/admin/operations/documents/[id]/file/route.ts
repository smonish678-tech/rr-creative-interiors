import { get } from "@vercel/blob";
import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { getSql, safeDatabaseError } from "@/lib/operations/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Administrator sign-in is required." }, { status: 401 });
  const { id } = await context.params;
  const token = process.env.RR_PRIVATE_DOCUMENTS_BLOB_TOKEN;
  if (!token) return NextResponse.json({ error: "Private document storage is not configured." }, { status: 503 });
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Document ID is invalid." }, { status: 400 });
  try {
    const sql = getSql();
    const rows = await sql`SELECT storage_path, document_number, mime_type FROM rr_documents WHERE id=${id}::uuid LIMIT 1`;
    if (!rows.length || !rows[0].storage_path) return NextResponse.json({ error: "No stored file is attached to this document." }, { status: 404 });
    const blob = await get(String(rows[0].storage_path), { access: "private", token, useCache: false });
    if (!blob || blob.statusCode !== 200) return NextResponse.json({ error: "Stored document could not be retrieved." }, { status: 404 });
    return new Response(blob.stream, { headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${String(rows[0].document_number).replace(/[^A-Za-z0-9_-]/g,"_")}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'self'"
    } });
  } catch (error) { return NextResponse.json({ error: safeDatabaseError(error) }, { status: 503 }); }
}
