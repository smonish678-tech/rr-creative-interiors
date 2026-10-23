import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { getSql, safeDatabaseError } from "@/lib/operations/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Administrator sign-in is required." }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  try {
    const sql = getSql();
    const rows = status
      ? await sql`SELECT t.*, c.display_name AS customer_name, p.project_code, p.name AS project_name FROM rr_tasks t LEFT JOIN rr_customers c ON c.id=t.customer_id LEFT JOIN rr_projects p ON p.id=t.project_id WHERE t.status=${status} ORDER BY t.due_at NULLS LAST, t.priority DESC LIMIT 250`
      : await sql`SELECT t.*, c.display_name AS customer_name, p.project_code, p.name AS project_name FROM rr_tasks t LEFT JOIN rr_customers c ON c.id=t.customer_id LEFT JOIN rr_projects p ON p.id=t.project_id WHERE t.status NOT IN ('done','cancelled') ORDER BY t.due_at NULLS LAST, t.priority DESC LIMIT 250`;
    return NextResponse.json({ tasks: rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return NextResponse.json({ error: safeDatabaseError(error) }, { status: 503 }); }
}

export async function PATCH(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Administrator sign-in is required." }, { status: 401 });
  let body: { id?: unknown; status?: unknown; blockedReason?: unknown; dueAt?: unknown };
  try { body = await request.json() as typeof body; }
  catch { return NextResponse.json({ error: "Task update is required." }, { status: 400 }); }
  const id = typeof body.id === "string" ? body.id : "";
  const status = typeof body.status === "string" ? body.status : "";
  if (!/^[0-9a-f-]{36}$/i.test(id) || !["open","in_progress","blocked","done","cancelled"].includes(status)) return NextResponse.json({ error: "Task or status is invalid." }, { status: 400 });
  const blockedReason = typeof body.blockedReason === "string" ? body.blockedReason.trim().slice(0,800) : "";
  if (status === "blocked" && !blockedReason) return NextResponse.json({ error: "Explain what is blocking the task." }, { status: 400 });
  try {
    const sql = getSql();
    const rows = await sql`UPDATE rr_tasks SET status=${status}, blocked_reason=${status === "blocked" ? blockedReason : null}, due_at=${typeof body.dueAt === "string" && !Number.isNaN(Date.parse(body.dueAt)) ? body.dueAt : null}::timestamptz, completed_at=CASE WHEN ${status}='done' THEN now() ELSE NULL END, updated_at=now(), version=version+1 WHERE id=${id}::uuid RETURNING *`;
    if (!rows.length) return NextResponse.json({ error: "Task not found." }, { status: 404 });
    await sql`INSERT INTO rr_audit_log (actor_id, action, entity_type, entity_id, after_state, reason) VALUES ('admin', ${status}, 'task', ${id}, ${JSON.stringify({ status })}::jsonb, ${blockedReason || null})`;
    return NextResponse.json({ task: rows[0] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return NextResponse.json({ error: safeDatabaseError(error) }, { status: 503 }); }
}
