import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getSql, safeDatabaseError } from "@/lib/operations/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return jsonError("Please check the form and try again.", 400); }

  // A hidden field used only as a low-friction bot trap.
  if (typeof body.companyWebsite === "string" && body.companyWebsite.trim()) {
    return NextResponse.json({ ok: true, received: true }, { status: 202 });
  }

  const name = typeof body.name === "string" ? body.name.trim().slice(0, 160) : "";
  const phone = typeof body.phone === "string" ? body.phone.trim().slice(0, 40) : "";
  const email = typeof body.email === "string" ? body.email.trim().slice(0, 254) : "";
  const projectType = typeof body.projectType === "string" ? body.projectType.trim().slice(0, 120) : "";
  const budget = typeof body.budget === "string" ? body.budget.trim().slice(0, 80) : "";
  const requirement = typeof body.message === "string" ? body.message.trim().slice(0, 4000) : "";
  const emailNorm = email.toLowerCase() || null;
  const phoneDigits = phone.replace(/\D/g, "");
  const phoneNorm = phoneDigits ? phoneDigits.length === 10 ? `91${phoneDigits}` : phoneDigits : null;
  const idempotencyKey = request.headers.get("x-idempotency-key")?.slice(0, 120) || randomUUID();

  if (name.length < 2 || !phoneNorm || requirement.length < 5) {
    return jsonError("Please enter your name, a valid phone number and a short description of your project.", 400);
  }
  if (emailNorm && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) {
    return jsonError("Please check your email address.", 400);
  }

  try {
    const sql = getSql();
    const prior = await sql`SELECT id, lead_number FROM rr_leads WHERE idempotency_key=${idempotencyKey} LIMIT 1`;
    if (prior.length) return NextResponse.json({ ok: true, duplicateSubmission: true, leadNumber: prior[0].lead_number }, { status: 200 });

    const candidates = await sql`SELECT id, normalized_email, normalized_phone FROM rr_customers WHERE archived_at IS NULL AND ((${emailNorm}::text IS NOT NULL AND normalized_email=${emailNorm}) OR normalized_phone=${phoneNorm}) ORDER BY updated_at DESC LIMIT 10`;
    const candidateIds = Array.from(new Set(candidates.map((row) => String(row.id))));
    if (candidateIds.length > 1) {
      return jsonError("We received your details but need to verify the contact record. Please call or WhatsApp the studio so we can help.", 409);
    }

    const customerId = candidateIds[0] || randomUUID();
    const leadId = randomUUID();
    const eventId = randomUUID();
    const taskId = randomUUID();
    const leadNumber = `WEB-${new Date().getUTCFullYear()}-${leadId.replace(/-/g, "").slice(0, 7).toUpperCase()}`;
    const budgetAmounts: Record<string, [number, number | null]> = {
      "₹10–20L": [100000000, 200000000],
      "₹20–40L": [200000000, 400000000],
      "₹40–70L": [400000000, 700000000],
      "₹70L+": [700000000, null]
    };
    const budgetRange = budgetAmounts[budget] || [null, null];
    const queries = [];
    if (!candidateIds.length) {
      queries.push(sql`INSERT INTO rr_customers (id, display_name, normalized_name, primary_email, normalized_email, primary_phone, normalized_phone, communication_preference, consent_at, created_by)
        VALUES (${customerId}::uuid, ${name}, ${name.toLowerCase()}, ${email || null}, ${emailNorm}, ${phone}, ${phoneNorm}, 'whatsapp', now(), 'website')`);
    }
    queries.push(sql`INSERT INTO rr_leads (id, lead_number, customer_id, source, requirement, budget_min_minor, budget_max_minor, status, consent_to_contact, idempotency_key, notes, created_by)
      VALUES (${leadId}::uuid, ${leadNumber}, ${customerId}::uuid, 'website', ${JSON.stringify({ projectType, message: requirement, budget })}, ${budgetRange[0]}::bigint, ${budgetRange[1]}::bigint, 'new_enquiry', true, ${idempotencyKey}, ${requirement}, 'website')`);
    queries.push(sql`INSERT INTO rr_tasks (id, customer_id, title, description, priority, status, dedupe_key, created_by)
      VALUES (${taskId}::uuid, ${customerId}::uuid, 'Respond to website enquiry', ${`New website enquiry ${leadNumber}: ${projectType}. Contact ${name} at ${phone}.`}, 'high', 'open', ${`lead-response:${leadId}`}, 'website')`);
    queries.push(sql`INSERT INTO rr_events (id, event_type, aggregate_type, aggregate_id, actor_id, idempotency_key, payload)
      VALUES (${eventId}::uuid, 'lead.created', 'lead', ${leadId}, 'website', ${`lead.created:${idempotencyKey}`}, ${JSON.stringify({ leadId, leadNumber, customerId, source: "website" })}::jsonb)`);
    queries.push(sql`INSERT INTO rr_audit_log (actor_id, action, entity_type, entity_id, after_state)
      VALUES ('website', 'create', 'lead', ${leadId}, ${JSON.stringify({ leadNumber, customerId, projectType, budget })}::jsonb)`);
    await sql.transaction(queries);
    return NextResponse.json({ ok: true, received: true, leadNumber }, { status: 201 });
  } catch (error) {
    return jsonError(safeDatabaseError(error), 503);
  }
}
