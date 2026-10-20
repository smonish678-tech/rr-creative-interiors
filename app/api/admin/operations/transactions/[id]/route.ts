import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { getSql, safeDatabaseError } from "@/lib/operations/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Administrator sign-in is required." }, { status: 401 });
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Transaction ID is invalid." }, { status: 400 });
  let body: { verification?: unknown; reason?: unknown };
  try { body = await request.json() as typeof body; }
  catch { return NextResponse.json({ error: "Choose verify or reject." }, { status: 400 }); }
  if (body.verification !== "verified" && body.verification !== "rejected") return NextResponse.json({ error: "Outcome must be verified or rejected." }, { status: 400 });
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0,800) : "";
  if (body.verification === "rejected" && !reason) return NextResponse.json({ error: "Explain why the transaction evidence was rejected." }, { status: 400 });
  try {
    const sql = getSql();
    const before = await sql`SELECT t.*, p.customer_id, p.project_code, p.name AS project_name, c.display_name AS customer_name FROM rr_transactions t JOIN rr_projects p ON p.id=t.project_id JOIN rr_customers c ON c.id=p.customer_id WHERE t.id=${id}::uuid LIMIT 1`;
    if (!before.length) return NextResponse.json({ error: "Transaction not found." }, { status: 404 });
    if (before[0].verification !== "unverified") return NextResponse.json({ error: "This transaction has already been finalised. Create a correction/refund transaction instead of editing history." }, { status: 409 });
    const rows = await sql`UPDATE rr_transactions SET verification=${body.verification}, verified_by='admin', verified_at=now(), notes=concat_ws(E'\n', notes, ${reason || "Verified against actual bank/UPI credit"}), updated_at=now(), version=version+1 WHERE id=${id}::uuid AND verification='unverified' RETURNING *`;
    if (!rows.length) return NextResponse.json({ error: "Transaction was updated by another request. Reload and review the ledger." }, { status: 409 });
    let receipt = null;
    if (body.verification === "verified" && before[0].direction === "in" && before[0].kind !== "refund") {
      const docId = randomUUID();
      const documentNumber = `RR-${new Date().getUTCFullYear()}-REC-${docId.replace(/-/g, "").slice(0,8).toUpperCase()}`;
      const snapshot = {
        transactionId: id,
        amountMinor: Number(before[0].amount_minor),
        method: before[0].method,
        reference: before[0].reference,
        verifiedAt: new Date().toISOString(),
        customer: before[0].customer_name,
        project: before[0].project_name,
        note: "Payment receipt acknowledgement only. Tax treatment and invoice obligations are governed by the CA-approved policy."
      };
      const created = await sql`INSERT INTO rr_documents (id, project_id, customer_id, kind, document_number, status, title, mime_type, source_snapshot, issued_at, created_by)
        VALUES (${docId}::uuid, ${before[0].project_id}::uuid, ${before[0].customer_id}::uuid, 'payment_receipt', ${documentNumber}, 'issued', 'Verified payment receipt', 'text/html', ${JSON.stringify(snapshot)}::jsonb, now(), 'admin') RETURNING *`;
      receipt = created[0];
    }
    await sql`INSERT INTO rr_audit_log (actor_id, action, entity_type, entity_id, before_state, after_state, reason)
      VALUES ('admin', ${body.verification}, 'transaction', ${id}, ${JSON.stringify({ verification: "unverified" })}::jsonb, ${JSON.stringify({ verification: body.verification })}::jsonb, ${reason || null})`;
    return NextResponse.json({ transaction: rows[0], receipt, message: receipt ? "Payment verified and a receipt draft/record created. Review the document and applicable CA rules before sending." : "Transaction verification outcome recorded." }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return NextResponse.json({ error: safeDatabaseError(error) }, { status: 503 }); }
}
