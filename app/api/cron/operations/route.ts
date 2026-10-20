import { randomUUID, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getSql, safeDatabaseError } from "@/lib/operations/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const supplied = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!secret || !supplied) return false;
  const a = Buffer.from(secret); const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a,b);
}

export async function GET(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Cron authorization failed." }, { status: 401 });
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: "Operations database is not configured." }, { status: 503 });
  const sql = getSql();
  let processed = 0; let retried = 0; let deadLettered = 0;
  try {
    // Create one idempotent event for each payment milestone that has become due.
    await sql`UPDATE rr_payment_milestones SET status='due', updated_at=now(), version=version+1 WHERE status='not_due' AND due_at <= current_date`;
    const due = await sql`SELECT id, project_id, label, amount_minor, due_at FROM rr_payment_milestones WHERE status IN ('due','partially_paid') AND due_at <= current_date LIMIT 100`;
    for (const milestone of due) {
      const key = `payment-milestone-due:${milestone.id}:${new Date().toISOString().slice(0,10)}`;
      await sql`INSERT INTO rr_events (event_type, aggregate_type, aggregate_id, actor_id, idempotency_key, payload)
        VALUES ('payment.milestone_due', 'project', ${milestone.project_id}, 'cron', ${key}, ${JSON.stringify({ milestoneId: milestone.id, label: milestone.label, amountMinor: Number(milestone.amount_minor), dueAt: milestone.due_at })}::jsonb)
        ON CONFLICT (idempotency_key) DO NOTHING`;
    }
    const events = await sql`SELECT * FROM rr_events WHERE delivery_state IN ('pending','retry') AND (next_attempt_at IS NULL OR next_attempt_at <= now()) ORDER BY occurred_at ASC LIMIT 50`;
    for (const event of events) {
      try {
        const payload = (event.payload || {}) as Record<string, unknown>;
        let customerId = ""; let projectId: string | null = null; let templateKey = "";
        if (event.event_type === "lead.created") {
          const leadId = String(payload.leadId || event.aggregate_id);
          const rows = await sql`SELECT l.customer_id, l.id AS lead_id FROM rr_leads l WHERE l.id=${leadId}::uuid LIMIT 1`;
          if (rows.length) { customerId = String(rows[0].customer_id); templateKey = "enquiry_followup"; }
        } else if (event.event_type === "quote.issued") {
          const rows = await sql`SELECT p.customer_id, p.id AS project_id FROM rr_quotes q JOIN rr_projects p ON p.id=q.project_id WHERE q.id=${event.aggregate_id}::uuid LIMIT 1`;
          if (rows.length) { customerId = String(rows[0].customer_id); projectId = String(rows[0].project_id); templateKey = "quote_ready"; }
        } else if (event.event_type === "warranty.claim_received") {
          const claimId = String(payload.claimId || '');
          const rows = await sql`SELECT wc.customer_id, wc.project_id FROM rr_warranty_claims wc WHERE wc.id=${claimId}::uuid LIMIT 1`;
          if (rows.length) { customerId = String(rows[0].customer_id); projectId = String(rows[0].project_id); templateKey = "warranty_claim_update"; }
        } else if (event.event_type === "payment.milestone_due") {
          const milestoneId = String(payload.milestoneId || "");
          const rows = await sql`SELECT p.customer_id, p.id AS project_id FROM rr_payment_milestones m JOIN rr_projects p ON p.id=m.project_id WHERE m.id=${milestoneId}::uuid LIMIT 1`;
          if (rows.length) { customerId = String(rows[0].customer_id); projectId = String(rows[0].project_id); templateKey = "payment_reminder"; }
        }
        if (templateKey && customerId) {
          const customerRows = await sql`SELECT display_name, primary_phone FROM rr_customers WHERE id=${customerId}::uuid LIMIT 1`;
          if (!customerRows.length || !customerRows[0].primary_phone) throw new Error("Customer phone number is missing; manual review required.");
          const customer = customerRows[0];
          const projectRows = projectId ? await sql`SELECT project_code, name FROM rr_projects WHERE id=${projectId}::uuid LIMIT 1` : [];
          const projectName = projectRows.length ? String(projectRows[0].name) : "your interior project";
          const projectCode = projectRows.length ? String(projectRows[0].project_code) : "";
          const body = templateKey === "enquiry_followup"
            ? `Hello ${customer.display_name}, thank you for contacting RR Creative Interiors. We'd be happy to understand your space and next steps. When would be a convenient time to speak?`
            : templateKey === "quote_ready"
              ? `Hello ${customer.display_name}, your quotation for ${projectName} (${projectCode}) is ready for review. Please review the issued version shared by RR. This message does not itself constitute acceptance.`
              : templateKey === "payment_reminder"
                ? `Hello ${customer.display_name}, this is a reminder about a payment milestone recorded for ${projectName}. Please refer to your current approved quotation/contract for the amount and due condition. Contact us if this reminder is incorrect.`
                : `Hello ${customer.display_name}, we've received a warranty service request related to ${projectName}. Our team will follow up on the next action.`;
          const key = `auto:${event.id}:${templateKey}`;
          await sql`INSERT INTO rr_message_jobs (id, project_id, customer_id, channel, template_key, recipient, rendered_subject, rendered_body, status, idempotency_key, created_by)
            VALUES (${randomUUID()}::uuid, ${projectId}::uuid, ${customerId}::uuid, 'whatsapp_manual', ${templateKey}, ${customer.primary_phone}, ${`RR Creative Interiors · ${projectCode || "project update"}`}, ${body}, 'draft', ${key}, 'cron')
            ON CONFLICT (idempotency_key) DO NOTHING`;
        }
        await sql`UPDATE rr_events SET delivery_state='delivered', attempt_count=attempt_count+1, last_error=NULL, updated_at=now() WHERE id=${event.id}::uuid`;
        processed++;
      } catch (error) {
        const attempt = Number(event.attempt_count || 0) + 1;
        const dead = attempt >= 5;
        const delayMinutes = Math.min(1440, Math.pow(2, attempt) * 5);
        await sql`UPDATE rr_events SET delivery_state=${dead ? "dead_letter" : "retry"}, attempt_count=${attempt}, next_attempt_at=now() + make_interval(mins => ${delayMinutes}), last_error=${(error instanceof Error ? error.message : "Unknown event error").slice(0,500)}, updated_at=now() WHERE id=${event.id}::uuid`;
        if (dead) deadLettered++; else retried++;
      }
    }
    return NextResponse.json({ ok: true, processed, retried, deadLettered, note: "This worker creates message drafts only. It never sends WhatsApp or email automatically." });
  } catch (error) {
    return NextResponse.json({ error: safeDatabaseError(error), processed, retried, deadLettered }, { status: 503 });
  }
}
