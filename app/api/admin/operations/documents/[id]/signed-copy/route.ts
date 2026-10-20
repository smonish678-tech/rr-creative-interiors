import { createHash } from "node:crypto";
import { put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { getSql, safeDatabaseError } from "@/lib/operations/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const MAX_BYTES = 20 * 1024 * 1024;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Administrator sign-in is required." }, { status: 401 });
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Document ID is invalid." }, { status: 400 });
  const token = process.env.RR_PRIVATE_DOCUMENTS_BLOB_TOKEN;
  if (!token) return NextResponse.json({ error: "Signed-document storage is not configured. Connect a private Blob store and set RR_PRIVATE_DOCUMENTS_BLOB_TOKEN." }, { status: 503 });
  let form: FormData;
  try { form = await request.formData(); }
  catch { return NextResponse.json({ error: "Choose a signed PDF to upload." }, { status: 400 }); }
  const file = form.get("file");
  if (!(file instanceof File) || file.size < 1 || file.size > MAX_BYTES || file.type !== "application/pdf") {
    return NextResponse.json({ error: "Upload a PDF smaller than 20 MB." }, { status: 400 });
  }
  try {
    const sql = getSql();
    const docs = await sql`SELECT * FROM rr_documents WHERE id=${id}::uuid LIMIT 1`;
    if (!docs.length) return NextResponse.json({ error: "Document not found." }, { status: 404 });
    const doc = docs[0];
    if (!["issued","sent","viewed"].includes(String(doc.status))) return NextResponse.json({ error: "Only an issued document can receive a signed copy. Keep the original version unchanged." }, { status: 409 });
    const bytes = Buffer.from(await file.arrayBuffer());
    if (bytes.subarray(0,5).toString("ascii") !== "%PDF-") return NextResponse.json({ error: "The uploaded file does not contain a valid PDF header." }, { status: 400 });
    const hash = createHash("sha256").update(bytes).digest("hex");
    const uploaded = await put(`rr-creative-interiors/signed-documents/${doc.project_id}/${id}.pdf`, bytes, {
      access: "private",
      token,
      contentType: "application/pdf",
      addRandomSuffix: true,
      allowOverwrite: false
    });
    const rows = await sql`UPDATE rr_documents SET storage_path=${uploaded.url}, sha256=${hash}, mime_type='application/pdf', status='signed', signed_at=now(), updated_at=now(), version=version+1 WHERE id=${id}::uuid AND status IN ('issued','sent','viewed') RETURNING *`;
    if (!rows.length) return NextResponse.json({ error: "Document changed during upload. The private file is stored but the record needs administrator review." }, { status: 409 });
    await sql`INSERT INTO rr_audit_log (actor_id, action, entity_type, entity_id, after_state) VALUES ('admin', 'upload_signed_copy', 'document', ${id}, ${JSON.stringify({ sha256: hash, size: bytes.length, filename: file.name.slice(0,180) })}::jsonb)`;
    return NextResponse.json({ document: rows[0], sha256: hash, message: "Signed copy stored privately. The original issued snapshot remains preserved." });
  } catch (error) { return NextResponse.json({ error: safeDatabaseError(error) }, { status: 503 }); }
}
