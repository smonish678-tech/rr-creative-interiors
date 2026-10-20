import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { getSql, safeDatabaseError } from "@/lib/operations/db";
import { assertMilestoneSchedule, assertQuoteMath, type Quote, type QuoteLine } from "@/lib/operations/model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Administrator sign-in is required." }, { status: 401 });
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Quote ID is invalid." }, { status: 400 });
  let body: { status?: unknown; reason?: unknown };
  try { body = await request.json() as typeof body; }
  catch { return NextResponse.json({ error: "Choose the quote action." }, { status: 400 }); }
  const target = typeof body.status === "string" ? body.status : "";
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0,600) : "";
  if (!["issued","accepted","rejected","expired"].includes(target)) return NextResponse.json({ error: "Only issue, accept, reject or expire are supported actions." }, { status: 400 });
  try {
    const sql = getSql();
    const rows = await sql`SELECT q.*, p.customer_id, p.name AS project_name, p.project_code, p.project_type, c.display_name AS customer_name FROM rr_quotes q JOIN rr_projects p ON p.id=q.project_id JOIN rr_customers c ON c.id=p.customer_id WHERE q.id=${id}::uuid LIMIT 1`;
    if (!rows.length) return NextResponse.json({ error: "Quote not found." }, { status: 404 });
    const q = rows[0];
    if (target === "issued") {
      if (q.status !== "draft") return NextResponse.json({ error: "Only a draft quote can be issued. Create a new revision for corrections." }, { status: 409 });
      const lines = q.lines as QuoteLine[];
      const mathErrors = assertQuoteMath({ lines, subtotalMinor: Number(q.subtotal_minor), taxMinor: Number(q.tax_minor), totalMinor: Number(q.total_minor) });
      const milestones = await sql`SELECT label, trigger, amount_minor FROM rr_payment_milestones WHERE quote_id=${id}::uuid ORDER BY sequence`;
      const milestoneErrors = assertMilestoneSchedule(milestones.map((m) => ({ label: m.label, amountMinor: Number(m.amount_minor) })), Number(q.total_minor));
      const policy = await sql`SELECT value, policy_version FROM rr_settings WHERE setting_key='commercial_policy' LIMIT 1`;
      const errors = [...mathErrors, ...milestoneErrors];
      const policyValue = policy.length && policy[0].value && typeof policy[0].value === "object" ? policy[0].value as Record<string, unknown> : {};
      const configuredMilestones = Array.isArray(policyValue.paymentMilestones) ? policyValue.paymentMilestones as Array<Record<string, unknown>> : [];
      if (configuredMilestones.length !== milestones.length) {
        errors.push("Payment milestones must match the approved commercial policy: milestone count differs.");
      } else {
        let allocated = 0;
        configuredMilestones.forEach((rule, index) => {
          const expected = index === configuredMilestones.length - 1 ? Number(q.total_minor) - allocated : Math.round(Number(q.total_minor) * Number(rule.percent) / 100);
          allocated += expected;
          const actual = milestones[index];
          if (!actual || Number(actual.amount_minor) !== expected || String(actual.trigger) !== String(rule.trigger) || String(actual.label).trim() !== String(rule.label).trim()) {
            errors.push("Payment milestone " + (index + 1) + " does not match the approved label, trigger and percentage.");
          }
        });
      }
      if (!policy.length) errors.push("The approved Phase 0 commercial/payment policy has not been configured.");
      if (lines.some((line) => line.taxCode === "UNCONFIRMED")) errors.push("At least one line has an unconfirmed tax code.");
      if (!q.valid_until) errors.push("Set a quote validity date before issuing.");
      if (errors.length) return NextResponse.json({ error: "Quote issue blocked by preflight validation.", errors }, { status: 409 });
      const documentId = randomUUID();
      const documentNumber = `RR-${new Date().getUTCFullYear()}-Q-${documentId.replace(/-/g,"").slice(0,8).toUpperCase()}`;
      const snapshot = { quoteId: id, quoteNumber: q.quote_number, revision: q.revision, lines, subtotalMinor: Number(q.subtotal_minor), taxMinor: Number(q.tax_minor), totalMinor: Number(q.total_minor), validUntil: q.valid_until, milestones, exclusions: q.exclusions, assumptions: q.assumptions, project: { code: q.project_code, name: q.project_name }, customer: q.customer_name, commercialPolicyVersion: policy[0].policy_version, templateVersion: "rr-ops-v1" };
      const changed = await sql.transaction([
        sql`UPDATE rr_quotes SET status='issued', issued_at=now(), document_id=${documentId}::uuid, payment_policy_version_id=${String(policy[0].policy_version)}, updated_at=now(), version=version+1 WHERE id=${id}::uuid AND status='draft' RETURNING *`,
        sql`INSERT INTO rr_documents (id, project_id, customer_id, kind, document_number, version, status, title, mime_type, source_snapshot, issued_at, created_by)
          VALUES (${documentId}::uuid, ${q.project_id}::uuid, ${q.customer_id}::uuid, ${"final_quote"}, ${documentNumber}, ${Number(q.revision)}, 'issued', ${`Quotation ${q.quote_number} · Revision ${q.revision}`}, 'text/html', ${JSON.stringify(snapshot)}::jsonb, now(), 'admin') RETURNING *`,
        sql`INSERT INTO rr_events (event_type, aggregate_type, aggregate_id, actor_id, idempotency_key, payload) VALUES ('quote.issued', 'quote', ${id}, 'admin', ${`quote.issued:${id}:${q.revision}`}, ${JSON.stringify({ documentId, documentNumber })}::jsonb)`,
        sql`INSERT INTO rr_audit_log (actor_id, action, entity_type, entity_id, after_state) VALUES ('admin', 'issue_quote', 'quote', ${id}, ${JSON.stringify({ documentId, documentNumber, policyVersion: policy[0].policy_version })}::jsonb)`
      ]);
      if (!changed[0].length) return NextResponse.json({ error: "Quote changed concurrently. Reload before issuing." }, { status: 409 });
      return NextResponse.json({ quote: changed[0][0], document: changed[1][0], message: "Quote issued with a frozen snapshot." });
    }
    if (target === "accepted") {
      if (q.status !== "issued" || !q.document_id) return NextResponse.json({ error: "Only an issued quote can be accepted." }, { status: 409 });
      const approval = await sql`SELECT id FROM rr_approvals WHERE project_id=${q.project_id}::uuid AND document_id=${q.document_id}::uuid AND status='approved' LIMIT 1`;
      if (!approval.length) return NextResponse.json({ error: "Acceptance requires an approval record for the exact issued document version." }, { status: 409 });
    }
    if (target === "rejected" && !reason) return NextResponse.json({ error: "Record a rejection reason." }, { status: 400 });
    const changed = await sql`UPDATE rr_quotes SET status=${target}, updated_at=now(), version=version+1 WHERE id=${id}::uuid AND status=${q.status} RETURNING *`;
    if (!changed.length) return NextResponse.json({ error: "Quote changed concurrently. Reload and retry." }, { status: 409 });
    await sql`INSERT INTO rr_audit_log (actor_id, action, entity_type, entity_id, before_state, after_state, reason) VALUES ('admin', ${target}, 'quote', ${id}, ${JSON.stringify({ status: q.status })}::jsonb, ${JSON.stringify({ status: target })}::jsonb, ${reason || null})`;
    return NextResponse.json({ quote: changed[0] });
  } catch (error) { return NextResponse.json({ error: safeDatabaseError(error) }, { status: 503 }); }
}
