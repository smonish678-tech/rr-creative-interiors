import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { getSql, safeDatabaseError } from "@/lib/operations/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Administrator sign-in is required." }, { status: 401 });
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Checklist item ID is invalid." }, { status: 400 });
  let body: { status?: unknown; notes?: unknown; evidenceDocumentId?: unknown };
  try { body = await request.json() as typeof body; }
  catch { return NextResponse.json({ error: "Update details are required." }, { status: 400 }); }
  const allowed = new Set(["pending","passed","failed","not_applicable"]);
  if (typeof body.status !== "string" || !allowed.has(body.status)) return NextResponse.json({ error: "Choose a valid checklist outcome." }, { status: 400 });
  if (body.status === "not_applicable" && !(typeof body.notes === "string" && body.notes.trim())) return NextResponse.json({ error: "Explain why this required item is not applicable." }, { status: 400 });
  try {
    const sql = getSql();
    const rows = await sql`UPDATE rr_checklist_items SET status=${body.status}, notes=${typeof body.notes === "string" ? body.notes.trim().slice(0,2000) : ""}, evidence_document_id=${typeof body.evidenceDocumentId === "string" && /^[0-9a-f-]{36}$/i.test(body.evidenceDocumentId) ? body.evidenceDocumentId : null}::uuid, checked_by='admin', checked_at=CASE WHEN ${body.status} IN ('passed','failed','not_applicable') THEN now() ELSE NULL END, updated_at=now() WHERE id=${id}::uuid RETURNING *`;
    if (!rows.length) return NextResponse.json({ error: "Checklist item not found." }, { status: 404 });
    await sql`INSERT INTO rr_audit_log (actor_id, action, entity_type, entity_id, after_state) VALUES ('admin', 'checklist_update', 'checklist_item', ${id}, ${JSON.stringify({ status: body.status, notes: body.notes || "" })}::jsonb)`;
    return NextResponse.json({ item: rows[0] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return NextResponse.json({ error: safeDatabaseError(error) }, { status: 503 }); }
}
