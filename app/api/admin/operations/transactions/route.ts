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
    const rows = projectId
      ? await sql`SELECT t.*, m.label AS milestone_label FROM rr_transactions t LEFT JOIN rr_payment_milestones m ON m.id=t.milestone_id WHERE t.project_id=${projectId}::uuid ORDER BY t.created_at DESC LIMIT 200`
      : await sql`SELECT t.*, p.project_code, p.name AS project_name, c.display_name AS customer_name, m.label AS milestone_label FROM rr_transactions t JOIN rr_projects p ON p.id=t.project_id JOIN rr_customers c ON c.id=p.customer_id LEFT JOIN rr_payment_milestones m ON m.id=t.milestone_id ORDER BY t.created_at DESC LIMIT 200`;
    return NextResponse.json({ transactions: rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return NextResponse.json({ error: safeDatabaseError(error) }, { status: 503 }); }
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Administrator sign-in is required." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return NextResponse.json({ error: "A valid transaction record is required." }, { status: 400 }); }
  const projectId = typeof body.projectId === "string" ? body.projectId : "";
  const amountMinor = Number(body.amountMinor);
  const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey.slice(0,180) : "";
  const direction = body.direction === "out" ? "out" : "in";
  const kind = typeof body.kind === "string" ? body.kind : direction === "in" ? "customer_payment" : "supplier_payment";
  const method = ["upi","bank_transfer","cash","cheque","gateway","other"].includes(String(body.method)) ? String(body.method) : "other";
  const milestoneId = typeof body.milestoneId === "string" && /^[0-9a-f-]{36}$/i.test(body.milestoneId) ? body.milestoneId : null;
  const reference = typeof body.reference === "string" ? body.reference.trim().slice(0,180) : "";
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0,1500) : "";
  if (!/^[0-9a-f-]{36}$/i.test(projectId) || !Number.isSafeInteger(amountMinor) || amountMinor <= 0 || !idempotencyKey) {
    return NextResponse.json({ error: "Choose a project, enter an amount in paise greater than zero, and provide an idempotency key." }, { status: 400 });
  }
  const id = randomUUID();
  try {
    const sql = getSql();
    const project = await sql`SELECT id FROM rr_projects WHERE id=${projectId}::uuid LIMIT 1`;
    if (!project.length) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    if (milestoneId) {
      const milestone = await sql`SELECT id FROM rr_payment_milestones WHERE id=${milestoneId}::uuid AND project_id=${projectId}::uuid LIMIT 1`;
      if (!milestone.length) return NextResponse.json({ error: "Payment milestone does not belong to this project." }, { status: 400 });
    }
    const rows = await sql`INSERT INTO rr_transactions (id, project_id, milestone_id, direction, kind, amount_minor, method, reference, verification, idempotency_key, notes, created_by)
      VALUES (${id}::uuid, ${projectId}::uuid, ${milestoneId}::uuid, ${direction}, ${kind}, ${amountMinor}, ${method}, ${reference || null}, 'unverified', ${idempotencyKey}, ${notes}, 'admin')
      ON CONFLICT (idempotency_key) DO UPDATE SET updated_at=rr_transactions.updated_at RETURNING *`;
    await sql`INSERT INTO rr_audit_log (actor_id, action, entity_type, entity_id, after_state) VALUES ('admin', 'record_unverified_transaction', 'transaction', ${rows[0].id}, ${JSON.stringify({ amountMinor, method, reference, verification: "unverified" })}::jsonb)`;
    return NextResponse.json({ transaction: rows[0], message: "Recorded as unverified. Check the actual bank/UPI credit before marking it verified or issuing a receipt." }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: safeDatabaseError(error) }, { status: 503 }); }
}
