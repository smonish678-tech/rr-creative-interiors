import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { getSql, safeDatabaseError } from "@/lib/operations/db";
import { assertMilestoneSchedule, assertQuoteMath, type Quote, type QuoteLine } from "@/lib/operations/model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Administrator sign-in is required." }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  try {
    const sql = getSql();
    const quotes = projectId
      ? await sql`SELECT * FROM rr_quotes WHERE project_id=${projectId}::uuid ORDER BY revision DESC`
      : await sql`SELECT q.*, p.project_code, p.name AS project_name, c.display_name AS customer_name FROM rr_quotes q JOIN rr_projects p ON p.id=q.project_id JOIN rr_customers c ON c.id=p.customer_id ORDER BY q.created_at DESC LIMIT 200`;
    return NextResponse.json({ quotes }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return NextResponse.json({ error: safeDatabaseError(error) }, { status: 503 }); }
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Administrator sign-in is required." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return NextResponse.json({ error: "A valid quote draft is required." }, { status: 400 }); }
  const projectId = typeof body.projectId === "string" ? body.projectId : "";
  const linesInput = Array.isArray(body.lines) ? body.lines : [];
  const milestonesInput = Array.isArray(body.milestones) ? body.milestones : [];
  const exclusions = Array.isArray(body.exclusions) ? body.exclusions.filter((v): v is string => typeof v === "string").slice(0,80) : [];
  const assumptions = Array.isArray(body.assumptions) ? body.assumptions.filter((v): v is string => typeof v === "string").slice(0,80) : [];
  if (!/^[0-9a-f-]{36}$/i.test(projectId) || !linesInput.length || linesInput.length > 250) {
    return NextResponse.json({ error: "Choose a project and provide between 1 and 250 quote lines." }, { status: 400 });
  }
  const lines: QuoteLine[] = linesInput.map((raw, index) => {
    const item = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    return {
      id: typeof item.id === "string" ? item.id.slice(0,80) : `line-${index+1}`,
      room: typeof item.room === "string" ? item.room.trim().slice(0,100) : "",
      description: typeof item.description === "string" ? item.description.trim().slice(0,400) : "",
      quantity: Number(item.quantity),
      unit: typeof item.unit === "string" ? item.unit.slice(0,30) : "item",
      unitPriceMinor: Number(item.unitPriceMinor),
      taxCode: typeof item.taxCode === "string" ? item.taxCode.slice(0,40) : "UNCONFIRMED",
      taxRateBps: Number(item.taxRateBps),
      included: item.included !== false
    };
  });
  if (lines.some((line) => !line.description || !Number.isFinite(line.quantity) || line.quantity <= 0 || !Number.isSafeInteger(line.unitPriceMinor) || line.unitPriceMinor < 0 || !Number.isInteger(line.taxRateBps) || line.taxRateBps < 0 || line.taxRateBps > 10000)) {
    return NextResponse.json({ error: "Each quote line needs a description, positive quantity, integer paise rate and a valid configured tax rate." }, { status: 400 });
  }
  const included = lines.filter((line) => line.included);
  const subtotalMinor = included.reduce((sum, line) => sum + Math.round(line.quantity * line.unitPriceMinor), 0);
  const taxMinor = included.reduce((sum, line) => sum + Math.round(Math.round(line.quantity * line.unitPriceMinor) * line.taxRateBps / 10000), 0);
  const totalMinor = subtotalMinor + taxMinor;
  const quoteCheck = assertQuoteMath({ lines, subtotalMinor, taxMinor, totalMinor });
  if (quoteCheck.length) return NextResponse.json({ error: "Quote math validation failed.", errors: quoteCheck }, { status: 400 });

  const milestones = milestonesInput.map((raw, index) => {
    const item = raw && typeof raw === "object" ? raw as Record<string, unknown> : {};
    return {
      id: randomUUID(),
      label: typeof item.label === "string" ? item.label.trim().slice(0,120) : "",
      sequence: index + 1,
      amountMinor: Number(item.amountMinor),
      dueAt: typeof item.dueAt === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.dueAt) ? item.dueAt : null,
      trigger: ["booking","design_signoff","production_release","dispatch","handover","custom"].includes(String(item.trigger)) ? String(item.trigger) : "custom"
    };
  });
  const milestoneErrors = milestones.length ? assertMilestoneSchedule(milestones, totalMinor) : [];
  if (milestones.length && (milestones.some((m) => !m.label || !Number.isSafeInteger(m.amountMinor) || m.amountMinor < 0) || milestoneErrors.length)) {
    return NextResponse.json({ error: "Payment milestone validation failed.", errors: milestoneErrors.length ? milestoneErrors : ["Every milestone needs a label and a non-negative integer amount in paise."] }, { status: 400 });
  }
  try {
    const sql = getSql();
    const project = await sql`SELECT id FROM rr_projects WHERE id=${projectId}::uuid LIMIT 1`;
    if (!project.length) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const existing = await sql`SELECT quote_number, max(revision)::int AS revision FROM rr_quotes WHERE project_id=${projectId}::uuid GROUP BY quote_number ORDER BY max(revision) DESC LIMIT 1`;
    const quoteNumber = existing.length ? String(existing[0].quote_number) : `RR-Q-${new Date().getUTCFullYear()}-${randomUUID().replace(/-/g,"").slice(0,6).toUpperCase()}`;
    const revision = existing.length ? Number(existing[0].revision) + 1 : 1;
    const id = randomUUID();
    const rows = await sql.transaction([
      sql`INSERT INTO rr_quotes (id, project_id, quote_number, revision, status, lines, subtotal_minor, tax_minor, total_minor, currency, valid_until, exclusions, assumptions, created_by)
        VALUES (${id}::uuid, ${projectId}::uuid, ${quoteNumber}, ${revision}, 'draft', ${JSON.stringify(lines)}::jsonb, ${subtotalMinor}, ${taxMinor}, ${totalMinor}, 'INR', ${typeof body.validUntil === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.validUntil) ? body.validUntil : null}::date, ${JSON.stringify(exclusions)}::jsonb, ${JSON.stringify(assumptions)}::jsonb, 'admin') RETURNING *`,
      ...milestones.map((milestone) => sql`INSERT INTO rr_payment_milestones (id, project_id, quote_id, label, sequence, amount_minor, due_at, trigger, status, created_by)
        VALUES (${milestone.id}::uuid, ${projectId}::uuid, ${id}::uuid, ${milestone.label}, ${milestone.sequence}, ${milestone.amountMinor}, ${milestone.dueAt}::date, ${milestone.trigger}, 'not_due', 'admin') RETURNING *`),
      sql`INSERT INTO rr_events (event_type, aggregate_type, aggregate_id, actor_id, idempotency_key, payload) VALUES ('quote.draft_created', 'quote', ${id}, 'admin', ${`quote.draft_created:${id}`}, ${JSON.stringify({ projectId, quoteNumber, revision, totalMinor })}::jsonb)`,
      sql`INSERT INTO rr_audit_log (actor_id, action, entity_type, entity_id, after_state) VALUES ('admin', 'create_quote_draft', 'quote', ${id}, ${JSON.stringify({ quoteNumber, revision, totalMinor, milestoneCount: milestones.length })}::jsonb)`
    ]);
    return NextResponse.json({ quote: rows[0][0], milestones, quoteMathValid: true, milestoneScheduleValid: milestones.length ? true : null, message: "Draft saved. A quote cannot be issued until Phase 0 policy settings and the approved payment milestone schedule are confirmed." }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: safeDatabaseError(error) }, { status: 503 }); }
}
