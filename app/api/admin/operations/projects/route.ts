import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { getSql, safeDatabaseError } from "@/lib/operations/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Administrator sign-in is required." }, { status: 401 });
  try {
    const sql = getSql();
    const projects = await sql`SELECT p.*, c.display_name AS customer_name, c.primary_email AS customer_email, c.primary_phone AS customer_phone FROM rr_projects p JOIN rr_customers c ON c.id=p.customer_id ORDER BY p.updated_at DESC LIMIT 200`;
    return NextResponse.json({ projects }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: safeDatabaseError(error) }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Administrator sign-in is required." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return NextResponse.json({ error: "A valid project record is required." }, { status: 400 }); }

  const customerId = typeof body.customerId === "string" ? body.customerId : "";
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 180) : "";
  const projectType = ["residential", "commercial", "renovation", "other"].includes(String(body.projectType)) ? String(body.projectType) : "residential";
  const address = typeof body.address === "string" ? body.address.trim().slice(0, 1000) : "";
  const apartment = typeof body.apartment === "string" ? body.apartment.trim().slice(0, 100) : "";
  const floor = typeof body.floor === "string" ? body.floor.trim().slice(0, 40) : "";
  const id = randomUUID();
  const eventId = randomUUID();
  const code = typeof body.projectCode === "string" && /^RR-[A-Z0-9-]{4,32}$/.test(body.projectCode.trim())
    ? body.projectCode.trim().toUpperCase()
    : `RR-${new Date().getUTCFullYear()}-${id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;

  if (!/^[0-9a-f-]{36}$/i.test(customerId) || name.length < 2) {
    return NextResponse.json({ error: "Choose an existing customer and enter a project name." }, { status: 400 });
  }

  try {
    const sql = getSql();
    const result = await sql.transaction([
      sql`INSERT INTO rr_projects (id, customer_id, project_code, name, project_type, address, apartment, floor, stage, owner_id, created_by)
          VALUES (${id}::uuid, ${customerId}::uuid, ${code}, ${name}, ${projectType}, ${address}, ${apartment}, ${floor}, 'booking', 'admin', 'admin') RETURNING *`,
      sql`INSERT INTO rr_events (id, event_type, aggregate_type, aggregate_id, actor_id, idempotency_key, payload)
          VALUES (${eventId}::uuid, 'project.created', 'project', ${id}, 'admin', ${`project.created:${id}`}, ${JSON.stringify({ projectId: id, customerId })}::jsonb)`,
      sql`INSERT INTO rr_audit_log (actor_id, action, entity_type, entity_id, after_state)
          VALUES ('admin', 'create', 'project', ${id}, ${JSON.stringify({ customerId, projectCode: code, name, stage: "booking" })}::jsonb)`
    ]);
    return NextResponse.json({ project: result[0][0] }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: safeDatabaseError(error) }, { status: 503 });
  }
}
