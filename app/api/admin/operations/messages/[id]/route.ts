import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { getSql, safeDatabaseError } from "@/lib/operations/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Administrator sign-in is required." }, { status: 401 });
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Message ID is invalid." }, { status: 400 });
  let body: { status?: unknown; error?: unknown; providerMessageId?: unknown };
  try { body = await request.json() as typeof body; }
  catch { return NextResponse.json({ error: "Choose the message outcome." }, { status: 400 }); }
  if (body.status !== "sent" && body.status !== "failed" && body.status !== "cancelled") {
    return NextResponse.json({ error: "Outcome must be sent, failed or cancelled." }, { status: 400 });
  }
  try {
    const sql = getSql();
    const rows = await sql`UPDATE rr_message_jobs SET status=${body.status}, attempt_count=attempt_count+1, last_attempt_at=now(), sent_at=CASE WHEN ${body.status}='sent' THEN now() ELSE sent_at END, last_error=CASE WHEN ${body.status}='failed' THEN ${typeof body.error === "string" ? body.error.slice(0,500) : "Marked failed by administrator"} ELSE NULL END, provider_message_id=${typeof body.providerMessageId === "string" ? body.providerMessageId.slice(0,200) : null}, updated_at=now(), version=version+1 WHERE id=${id}::uuid AND status IN ('draft','queued','failed') RETURNING *`;
    if (!rows.length) return NextResponse.json({ error: "Message not found or already finalised. Do not create a duplicate send to retry; review its history first." }, { status: 409 });
    await sql`INSERT INTO rr_audit_log (actor_id, action, entity_type, entity_id, after_state) VALUES ('admin', ${body.status}, 'message', ${id}, ${JSON.stringify({ status: body.status })}::jsonb)`;
    return NextResponse.json({ message: rows[0] }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return NextResponse.json({ error: safeDatabaseError(error) }, { status: 503 }); }
}
