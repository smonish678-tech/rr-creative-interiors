import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { getSql, safeDatabaseError } from "@/lib/operations/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Administrator sign-in is required." }, { status: 401 });
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Lead ID is invalid." }, { status: 400 });
  let body: { name?: unknown; address?: unknown; projectType?: unknown };
  try { body = await request.json() as typeof body; } catch { body = {}; }
  try {
    const sql = getSql();
    const leads = await sql`SELECT l.*, c.display_name AS customer_name FROM rr_leads l JOIN rr_customers c ON c.id=l.customer_id WHERE l.id=${id}::uuid LIMIT 1`;
    if (!leads.length) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
    const lead = leads[0];
    if (lead.project_id) {
      const existing = await sql`SELECT * FROM rr_projects WHERE id=${lead.project_id}::uuid LIMIT 1`;
      return NextResponse.json({ project: existing[0], alreadyConverted: true });
    }
    if (lead.status === "lost") return NextResponse.json({ error: "A lost lead cannot be converted. Reopen it first with a reason." }, { status: 409 });
    const projectId = randomUUID();
    const eventId = randomUUID();
    const code = `RR-${new Date().getUTCFullYear()}-${projectId.replace(/-/g,"").slice(0,8).toUpperCase()}`;
    const name = typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0,180) : `Interior project — ${lead.customer_name}`;
    const projectType = ["residential","commercial","renovation","other"].includes(String(body.projectType)) ? String(body.projectType) : "residential";
    const address = typeof body.address === "string" ? body.address.trim().slice(0,1000) : "";
    const rows = await sql.transaction([
      sql`INSERT INTO rr_projects (id, customer_id, lead_id, project_code, name, project_type, address, stage, owner_id, created_by)
        VALUES (${projectId}::uuid, ${lead.customer_id}::uuid, ${id}, ${code}, ${name}, ${projectType}, ${address}, 'booking', 'admin', 'admin') RETURNING *`,
      sql`UPDATE rr_leads SET project_id=${projectId}::uuid, status='won', updated_at=now(), version=version+1 WHERE id=${id}::uuid AND project_id IS NULL AND status <> 'lost' RETURNING id`,
      sql`INSERT INTO rr_events (id, event_type, aggregate_type, aggregate_id, actor_id, idempotency_key, payload)
        VALUES (${eventId}::uuid, 'lead.converted', 'project', ${projectId}, 'admin', ${`lead.converted:${id}`}, ${JSON.stringify({ leadId:id, projectId, customerId:lead.customer_id, projectCode:code })}::jsonb)`,
      sql`INSERT INTO rr_audit_log (actor_id, action, entity_type, entity_id, after_state) VALUES ('admin', 'convert_lead', 'lead', ${id}, ${JSON.stringify({ projectId, projectCode:code })}::jsonb)`
    ]);
    if (!rows[1].length) return NextResponse.json({ error: "This lead was converted by another request. Refresh the pipeline." }, { status: 409 });
    return NextResponse.json({ project: rows[0][0], message: "Project Passport created; the original enquiry is linked and marked won." }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error && error.message.includes("rr_projects_lead_id_unique_idx")
      ? "This lead already has a project. Refresh the pipeline to open it."
      : safeDatabaseError(error);
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
