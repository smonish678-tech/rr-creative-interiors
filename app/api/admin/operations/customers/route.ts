import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { getSql, safeDatabaseError } from "@/lib/operations/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const emailNorm = (value: string) => value.trim().toLowerCase() || null;
const phoneNorm = (value: string) => {
  const digits = value.replace(/\D/g, "");
  return !digits ? null : digits.length === 10 ? `91${digits}` : digits;
};

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Administrator sign-in is required." }, { status: 401 });
  try {
    const sql = getSql();
    const rows = await sql`SELECT c.*, count(p.id)::int AS project_count FROM rr_customers c LEFT JOIN rr_projects p ON p.customer_id=c.id WHERE c.archived_at IS NULL GROUP BY c.id ORDER BY c.created_at DESC LIMIT 200`;
    return NextResponse.json({ customers: rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: safeDatabaseError(error) }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Administrator sign-in is required." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return NextResponse.json({ error: "A valid customer record is required." }, { status: 400 }); }

  const displayName = typeof body.displayName === "string" ? body.displayName.trim().slice(0, 160) : "";
  const email = typeof body.email === "string" ? body.email.trim().slice(0, 254) : "";
  const phone = typeof body.phone === "string" ? body.phone.trim().slice(0, 40) : "";
  const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 4000) : "";
  const normalizedEmail = emailNorm(email);
  const normalizedPhone = phoneNorm(phone);
  if (displayName.length < 2 || (!normalizedEmail && !normalizedPhone)) {
    return NextResponse.json({ error: "Enter the customer name and at least one contact method (email or phone)." }, { status: 400 });
  }
  if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return NextResponse.json({ error: "The email address does not look valid." }, { status: 400 });
  }

  const id = randomUUID();
  const eventId = randomUUID();
  const dedupe = `customer.created:${id}`;
  try {
    const sql = getSql();
    const matches = await sql`SELECT id, display_name AS "displayName", primary_email AS email, primary_phone AS phone FROM rr_customers WHERE archived_at IS NULL AND ((${normalizedEmail}::text IS NOT NULL AND normalized_email=${normalizedEmail}) OR (${normalizedPhone}::text IS NOT NULL AND normalized_phone=${normalizedPhone})) LIMIT 10`;
    if (matches.length) return NextResponse.json({ error: "Possible duplicate customer. Review the matching records before creating another.", duplicates: matches }, { status: 409 });

    const result = await sql.transaction([
      sql`INSERT INTO rr_customers (id, display_name, normalized_name, primary_email, normalized_email, primary_phone, normalized_phone, communication_preference, notes, created_by)
          VALUES (${id}::uuid, ${displayName}, ${displayName.toLowerCase()}, ${email || null}, ${normalizedEmail}, ${phone || null}, ${normalizedPhone}, ${body.communicationPreference === "email" ? "email" : body.communicationPreference === "phone" ? "phone" : "whatsapp"}, ${notes}, 'admin') RETURNING *`,
      sql`INSERT INTO rr_events (id, event_type, aggregate_type, aggregate_id, actor_id, idempotency_key, payload)
          VALUES (${eventId}::uuid, 'customer.created', 'customer', ${id}, 'admin', ${dedupe}, ${JSON.stringify({ customerId: id })}::jsonb)`,
      sql`INSERT INTO rr_audit_log (actor_id, action, entity_type, entity_id, after_state)
          VALUES ('admin', 'create', 'customer', ${id}, ${JSON.stringify({ displayName, email: normalizedEmail, phone: normalizedPhone })}::jsonb)`
    ]);
    return NextResponse.json({ customer: result[0][0] }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: safeDatabaseError(error) }, { status: 503 });
  }
}
