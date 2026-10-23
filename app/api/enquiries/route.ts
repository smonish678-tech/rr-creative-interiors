import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { databaseConfigured, getSql, safeDatabaseError } from "@/lib/operations/db";
import { normalizeCustomerPhone } from "@/lib/customer-matching";
import { savePublicEnquiryInbox, type PublicEnquiryInboxRecord } from "@/lib/workspace-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 6;
const rateBuckets = new Map<string, { startedAt: number; count: number }>();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanText(value: unknown, maximum: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, maximum);
}

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = (request.headers.get("x-forwarded-host") || request.headers.get("host") || new URL(request.url).host).split(",")[0].trim().toLowerCase();
  if (!origin || !host) return false;
  try { return new URL(origin).host.toLowerCase() === host; } catch { return false; }
}

function isRateLimited(request: Request): boolean {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0].trim();
  const ip = forwarded || request.headers.get("x-real-ip") || "unknown";
  const now = Date.now();
  const current = rateBuckets.get(ip);
  if (!current || now - current.startedAt >= RATE_WINDOW_MS) {
    rateBuckets.set(ip, { startedAt: now, count: 1 });
    if (rateBuckets.size > 2000) {
      for (const [key, bucket] of rateBuckets) if (now - bucket.startedAt >= RATE_WINDOW_MS) rateBuckets.delete(key);
    }
    return false;
  }
  if (current.count >= RATE_LIMIT) return true;
  current.count += 1;
  return false;
}

function normalizeDbPhone(phone: string): string {
  const digits = phone.replace(/\\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  if (digits.length === 11 && digits.startsWith("0")) return `91${digits.slice(1)}`;
  return digits;
}

function budgetRangeMinor(value: string): [number | null, number | null] {
  const ranges: Record<string, [number | null, number | null]> = {
    "Below ₹10L": [0, 100000000],
    "₹10–20L": [100000000, 200000000],
    "₹20–40L": [200000000, 400000000],
    "₹40L+": [400000000, null],
  };
  return ranges[value] || [null, null];
}

async function saveEnquiryToDatabase(record: PublicEnquiryInboxRecord & { consentToContact: boolean }) {
  const sql = getSql();
  const idempotencyKey = `website:${record.submissionId}`;
  const prior = await sql`SELECT id, lead_number FROM rr_leads WHERE idempotency_key=${idempotencyKey} LIMIT 1`;
  if (prior.length) return { duplicate: true, reference: String(prior[0].lead_number), customerReview: false };
  const emailNorm = record.email.trim().toLocaleLowerCase() || null;
  const phoneNorm = normalizeDbPhone(record.phone);
  const candidates = await sql`SELECT id, display_name, normalized_email, normalized_phone FROM rr_customers WHERE archived_at IS NULL AND ((${emailNorm}::text IS NOT NULL AND normalized_email=${emailNorm}) OR normalized_phone=${phoneNorm}) ORDER BY updated_at DESC LIMIT 10`;
  const ids = Array.from(new Set(candidates.map((item) => String(item.id))));
  if (ids.length > 1) {
    throw new Error("These contact details match multiple existing customer records. RR has not merged them; review the customer records before accepting this enquiry.");
  }
  const candidate = candidates[0];
  if (candidate && ((candidate.normalized_email && emailNorm && String(candidate.normalized_email) !== emailNorm) || (candidate.normalized_phone && String(candidate.normalized_phone) !== phoneNorm))) {
    throw new Error("The phone/email matches a customer but the other supplied contact detail conflicts. RR has not merged the enquiry; review the customer record first.");
  }
  const customerId = candidate ? String(candidate.id) : randomUUID();
  const leadId = randomUUID();
  const eventId = randomUUID();
  const taskId = randomUUID();
  const leadNumber = `WEB-${new Date().getUTCFullYear()}-${leadId.replace(/-/g, "").slice(0, 7).toUpperCase()}`;
  const [budgetMinMinor, budgetMaxMinor] = budgetRangeMinor(record.budget);
  const projectType = record.serviceType || "Not specified";
  const queries = [];
  if (!candidate) {
    queries.push(sql`INSERT INTO rr_customers (id, display_name, normalized_name, primary_email, normalized_email, primary_phone, normalized_phone, communication_preference, consent_at, created_by)
      VALUES (${customerId}::uuid, ${record.name}, ${record.name.toLocaleLowerCase()}, ${emailNorm}, ${emailNorm}, ${record.phone}, ${phoneNorm}, 'whatsapp', CASE WHEN ${record.consentToContact} THEN now() ELSE NULL END, 'website')`);
  } else {
    queries.push(sql`UPDATE rr_customers SET primary_email=coalesce(primary_email,${emailNorm}), normalized_email=coalesce(normalized_email,${emailNorm}), primary_phone=coalesce(primary_phone,${record.phone}), normalized_phone=coalesce(normalized_phone,${phoneNorm}), updated_at=now(), version=version+1 WHERE id=${customerId}::uuid`);
  }
  queries.push(sql`INSERT INTO rr_leads (id, lead_number, customer_id, source, requirement, budget_min_minor, budget_max_minor, status, consent_to_contact, idempotency_key, notes, created_by)
    VALUES (${leadId}::uuid, ${leadNumber}, ${customerId}::uuid, 'website', ${JSON.stringify({ projectType, message: record.message, budget: record.budget, receivedAt: record.receivedAt })}, ${budgetMinMinor}::bigint, ${budgetMaxMinor}::bigint, 'new_enquiry', ${record.consentToContact}, ${idempotencyKey}, ${record.message}, 'website')`);
  queries.push(sql`INSERT INTO rr_tasks (id, customer_id, title, description, priority, status, dedupe_key, created_by)
    VALUES (${taskId}::uuid, ${customerId}::uuid, 'Respond to website enquiry', ${`New website enquiry ${leadNumber}: ${projectType}. Contact ${record.name} at ${record.phone}.`}, 'high', 'open', ${`lead-response:${leadId}`}, 'website')`);
  queries.push(sql`INSERT INTO rr_events (id, event_type, aggregate_type, aggregate_id, actor_id, idempotency_key, payload)
    VALUES (${eventId}::uuid, 'lead.created', 'lead', ${leadId}, 'website', ${`lead.created:${idempotencyKey}`}, ${JSON.stringify({ leadId, leadNumber, customerId, source: "website" })}::jsonb)`);
  queries.push(sql`INSERT INTO rr_audit_log (actor_id, action, entity_type, entity_id, after_state)
    VALUES ('website', 'create', 'lead', ${leadId}, ${JSON.stringify({ leadNumber, customerId, projectType, budget })}::jsonb)`);
  await sql.transaction(queries);
  return { duplicate: false, reference: leadNumber, customerReview: false };
}
function normaliseService(value: string): string {
  const services: Record<string, string> = {
    "Residential interior": "Residential turnkey",
    "Turnkey interior": "Residential turnkey",
    "Commercial interior": "Commercial / corporate",
    "Corporate interior": "Commercial / corporate",
    "Renovation": "Renovation",
  };
  return services[value] || "";
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Please submit the enquiry from the RR Creative Interiors website." }, { status: 403 });
  }
  if (isRateLimited(request)) {
    return NextResponse.json({ error: "Too many enquiries were submitted from this connection. Please wait a few minutes and try again." }, { status: 429, headers: { "Retry-After": "600", "Cache-Control": "no-store" } });
  }
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > 12000) return NextResponse.json({ error: "The enquiry is too long. Please shorten the message and try again." }, { status: 413 });

  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 12000) return NextResponse.json({ error: "The enquiry is too long. Please shorten the message and try again." }, { status: 413 });
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid");
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Your enquiry could not be read. Please review the form and try again." }, { status: 400 });
  }

  // Quietly discard automated submissions that fill the hidden honeypot.
  if (cleanText(body.companyWebsite, 200)) return NextResponse.json({ accepted: true }, { status: 202, headers: { "Cache-Control": "no-store" } });

  const submissionId = cleanText(body.submissionId, 50);
  const name = cleanText(body.name, 100);
  const phone = cleanText(body.phone, 30);
  const email = cleanText(body.email, 254).toLowerCase();
  const submittedService = cleanText(body.serviceType, 60);
  const serviceType = normaliseService(submittedService);
  const budget = cleanText(body.budget, 24);
  const message = cleanText(body.message, 2500);
  const phoneDigits = phone.replace(/\D/g, "");

  if (!UUID_PATTERN.test(submissionId)) return NextResponse.json({ error: "Please refresh the page and submit the enquiry again." }, { status: 400 });
  if (name.length < 2) return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
  if (phoneDigits.length < 7 || phoneDigits.length > 15 || !normalizeCustomerPhone(phone)) return NextResponse.json({ error: "Please enter a valid phone number, including the country code if needed." }, { status: 400 });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Please check the email address." }, { status: 400 });
  if (submittedService && !serviceType) return NextResponse.json({ error: "Please select one of the listed project directions." }, { status: 400 });
  if (budget && !["Below ₹10L", "₹10–20L", "₹20–40L", "₹40L+"].includes(budget)) return NextResponse.json({ error: "Please select a listed budget range." }, { status: 400 });
  if (message.length < 10) return NextResponse.json({ error: "Please add a little more detail about the space so we can respond usefully." }, { status: 400 });
  if (body.contactConsent !== true) return NextResponse.json({ error: "Please confirm that RR may contact you about this enquiry." }, { status: 400 });

  const record: PublicEnquiryInboxRecord & { consentToContact: boolean } = {
    submissionId, receivedAt: new Date().toISOString(), name, phone, email, serviceType, budget, message, consentToContact: true,
  };
  try {
    if (databaseConfigured()) {
      const result = await saveEnquiryToDatabase(record);
      return NextResponse.json({ accepted: true, duplicate: result.duplicate, reference: result.reference, store: "operations" }, { status: result.duplicate ? 200 : 201, headers: { "Cache-Control": "no-store" } });
    }
    const result = await savePublicEnquiryInbox(record);
    const reference = `LD-WEB-${submissionId.replace(/-/g, "").slice(0, 16).toUpperCase()}`;
    return NextResponse.json({ accepted: true, duplicate: result === "duplicate", reference, store: "legacy-inbox" }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "Could not save your enquiry.";
    const identityConflict = rawMessage.includes("match multiple") || rawMessage.includes("conflicts");
    const message = identityConflict ? rawMessage : safeDatabaseError(error);
    return NextResponse.json({ error: message }, { status: identityConflict ? 409 : 503, headers: { "Cache-Control": "no-store" } });
  }
}
