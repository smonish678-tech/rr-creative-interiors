import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { getSql, safeDatabaseError } from "@/lib/operations/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const defaults: Record<string, Array<[string,string]>> = {
  procurement: [["approved_scope","Purchase scope matches signed quote and design"],["materials","Materials, finish and hardware selections confirmed"],["supplier_dates","Supplier lead times and expected dates recorded"]],
  production: [["job_pack","Production job pack issued from approved design"],["measurements","Site measurements checked and recorded"],["components","Components and drawings released to production"]],
  quality: [["dimensions","Dimensions and fit checked"],["finish","Finish, edge and surface quality checked"],["hardware","Hardware and moving parts tested"],["photo_evidence","Quality photos attached"]],
  dispatch: [["packaging","Items protected and labelled"],["inventory","Dispatch inventory reconciled"],["transport","Transport and site delivery slot confirmed"]],
  site_readiness: [["access","Building access and permissions confirmed"],["civil_ready","Relevant civil/electrical/plumbing work ready"],["utilities","Power, water and safe work area available"],["client_slot","Client/site contact confirms installation slot"]],
  installation: [["delivery_check","Delivered items checked against inventory"],["installation","Installation completed against approved scope"],["cleanup","Work area cleaned and debris removed"]],
  snag: [["snag_walkthrough","Joint client/installer walkthrough completed"],["snag_resolution","Snags resolved or explicitly accepted in writing"]],
  handover: [["client_walkthrough","Client walkthrough completed"],["care_instructions","Care and maintenance instructions provided"],["documents","Final invoice, receipts, contract and warranty pack checked"],["acknowledgement","Handover acknowledgement recorded"]]
};

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Administrator sign-in is required." }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  if (!projectId || !/^[0-9a-f-]{36}$/i.test(projectId)) return NextResponse.json({ error: "A valid projectId is required." }, { status: 400 });
  try {
    const sql = getSql();
    const rows = await sql`SELECT * FROM rr_checklist_items WHERE project_id=${projectId}::uuid ORDER BY phase, created_at`;
    return NextResponse.json({ items: rows, defaults: Object.keys(defaults) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return NextResponse.json({ error: safeDatabaseError(error) }, { status: 503 }); }
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Administrator sign-in is required." }, { status: 401 });
  let body: { projectId?: unknown; phase?: unknown };
  try { body = await request.json() as typeof body; }
  catch { return NextResponse.json({ error: "Choose a project and checklist phase." }, { status: 400 }); }
  const projectId = typeof body.projectId === "string" ? body.projectId : "";
  const phase = typeof body.phase === "string" ? body.phase : "";
  if (!/^[0-9a-f-]{36}$/i.test(projectId) || !defaults[phase]) return NextResponse.json({ error: "Project or checklist phase is invalid." }, { status: 400 });
  try {
    const sql = getSql();
    const existing = await sql`SELECT id FROM rr_projects WHERE id=${projectId}::uuid LIMIT 1`;
    if (!existing.length) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const results = await sql.transaction(defaults[phase].map(([key,label]) => sql`INSERT INTO rr_checklist_items (id, project_id, phase, item_key, label, required, status, created_by)
      VALUES (${randomUUID()}::uuid, ${projectId}::uuid, ${phase}, ${key}, ${label}, true, 'pending', 'admin')
      ON CONFLICT (project_id, phase, item_key) DO UPDATE SET updated_at=rr_checklist_items.updated_at RETURNING *`));
    await sql`INSERT INTO rr_audit_log (actor_id, action, entity_type, entity_id, after_state) VALUES ('admin', 'initialise_checklist', 'project', ${projectId}, ${JSON.stringify({ phase, itemCount: results.length })}::jsonb)`;
    return NextResponse.json({ items: results.map((result) => result[0]) }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: safeDatabaseError(error) }, { status: 503 }); }
}
