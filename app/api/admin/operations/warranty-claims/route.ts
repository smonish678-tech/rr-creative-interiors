import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { getSql, safeDatabaseError } from "@/lib/operations/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Administrator sign-in is required." }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  try {
    const sql = getSql();
    const claims = projectId
      ? await sql`SELECT wc.*, w.status AS warranty_status, c.display_name AS customer_name FROM rr_warranty_claims wc JOIN rr_warranties w ON w.id=wc.warranty_id JOIN rr_customers c ON c.id=wc.customer_id WHERE wc.project_id=${projectId}::uuid ORDER BY wc.reported_at DESC`
      : await sql`SELECT wc.*, w.status AS warranty_status, c.display_name AS customer_name, p.project_code FROM rr_warranty_claims wc JOIN rr_warranties w ON w.id=wc.warranty_id JOIN rr_customers c ON c.id=wc.customer_id JOIN rr_projects p ON p.id=wc.project_id ORDER BY wc.reported_at DESC LIMIT 200`;
    return NextResponse.json({ claims }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return NextResponse.json({ error: safeDatabaseError(error) }, { status: 503 }); }
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Administrator sign-in is required." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return NextResponse.json({ error: "A valid warranty claim is required." }, { status: 400 }); }
  const warrantyId = typeof body.warrantyId === "string" ? body.warrantyId : "";
  const description = typeof body.description === "string" ? body.description.trim().slice(0,3000) : "";
  const category = typeof body.category === "string" ? body.category.trim().slice(0,120) : "General";
  if (!/^[0-9a-f-]{36}$/i.test(warrantyId) || description.length < 8) return NextResponse.json({ error: "Choose a warranty and describe the issue." }, { status: 400 });
  try {
    const sql = getSql();
    const warranties = await sql`SELECT * FROM rr_warranties WHERE id=${warrantyId}::uuid AND status='active' LIMIT 1`;
    if (!warranties.length) return NextResponse.json({ error: "An active warranty is required to open a warranty claim." }, { status: 409 });
    const warranty = warranties[0];
    const id = randomUUID();
    const claimNumber = `RR-WC-${new Date().getUTCFullYear()}-${id.replace(/-/g,"").slice(0,8).toUpperCase()}`;
    const rows = await sql`INSERT INTO rr_warranty_claims (id, warranty_id, project_id, customer_id, claim_number, description, category, status, owner_id, next_action_at, created_by)
      VALUES (${id}::uuid, ${warrantyId}::uuid, ${warranty.project_id}::uuid, ${warranty.customer_id}::uuid, ${claimNumber}, ${description}, ${category}, 'received', 'admin', now() + interval '1 day', 'admin') RETURNING *`;
    await sql`INSERT INTO rr_tasks (project_id, customer_id, title, description, owner_id, due_at, priority, dedupe_key, created_by)
      VALUES (${warranty.project_id}::uuid, ${warranty.customer_id}::uuid, ${`Triage warranty claim ${claimNumber}`}, ${description}, 'admin', now() + interval '1 day', 'high', ${`warranty-claim:${id}`}, 'admin')`;
    await sql`INSERT INTO rr_events (event_type, aggregate_type, aggregate_id, actor_id, idempotency_key, payload) VALUES ('warranty.claim_received', 'warranty', ${warrantyId}, 'admin', ${`warranty.claim_received:${id}`}, ${JSON.stringify({ claimId: id, claimNumber })}::jsonb)`;
    return NextResponse.json({ claim: rows[0] }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: safeDatabaseError(error) }, { status: 503 }); }
}
