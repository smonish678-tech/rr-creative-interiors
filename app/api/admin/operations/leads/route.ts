import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { getSql, safeDatabaseError } from "@/lib/operations/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const stages = new Set(["new_enquiry","contacted","site_visit","proposal_sent","negotiation","lost"]);

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Administrator sign-in is required." }, { status: 401 });
  try {
    const sql = getSql();
    const rows = await sql`SELECT l.*, c.display_name AS customer_name, c.primary_email, c.primary_phone, p.project_code, p.name AS project_name
      FROM rr_leads l JOIN rr_customers c ON c.id=l.customer_id LEFT JOIN rr_projects p ON p.id=l.project_id
      ORDER BY CASE l.status WHEN 'new_enquiry' THEN 0 WHEN 'contacted' THEN 1 WHEN 'site_visit' THEN 2 WHEN 'proposal_sent' THEN 3 WHEN 'negotiation' THEN 4 ELSE 5 END, l.created_at DESC LIMIT 300`;
    return NextResponse.json({ leads: rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return NextResponse.json({ error: safeDatabaseError(error) }, { status: 503 }); }
}

export async function PATCH(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Administrator sign-in is required." }, { status: 401 });
  let body: { id?: unknown; status?: unknown; notes?: unknown; lostReason?: unknown };
  try { body = await request.json() as typeof body; }
  catch { return NextResponse.json({ error: "Lead update is required." }, { status: 400 }); }
  const id = typeof body.id === "string" ? body.id : "";
  const status = typeof body.status === "string" ? body.status : "";
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0,3000) : "";
  const lostReason = typeof body.lostReason === "string" ? body.lostReason.trim().slice(0,500) : "";
  if (!/^[0-9a-f-]{36}$/i.test(id) || (!stages.has(status) && status !== "won")) return NextResponse.json({ error: "Lead or stage is invalid." }, { status: 400 });
  if (status === "won") return NextResponse.json({ error: "Use Convert to project. It creates the Project Passport and marks the lead won exactly once." }, { status: 409 });
  if (status === "lost" && !lostReason) return NextResponse.json({ error: "Record a lost reason so the team can learn from it." }, { status: 400 });
  try {
    const sql = getSql();
    const rows = await sql`UPDATE rr_leads SET status=${status}, notes=CASE WHEN ${notes}='' THEN notes ELSE ${notes} END, lost_reason=${status==='lost'?lostReason:null}, updated_at=now(), version=version+1 WHERE id=${id}::uuid AND project_id IS NULL RETURNING *`;
    if (!rows.length) return NextResponse.json({ error: "Lead not found, already converted, or no longer editable." }, { status: 409 });
    await sql`INSERT INTO rr_audit_log (actor_id, action, entity_type, entity_id, after_state, reason) VALUES ('admin', 'update_lead', 'lead', ${id}, ${JSON.stringify({ status })}::jsonb, ${lostReason || null})`;
    return NextResponse.json({ lead: rows[0] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return NextResponse.json({ error: safeDatabaseError(error) }, { status: 503 }); }
}
