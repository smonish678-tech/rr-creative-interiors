import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { getSql, safeDatabaseError } from "@/lib/operations/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedKeys = new Set(["commercial_policy","warranty_policy","document_numbering","delivery_calendar","communication_policy"]);

function validPolicy(key: string, value: Record<string, unknown>): string | null {
  if (key === "commercial_policy") {
    if (!Array.isArray(value.paymentMilestones) || value.paymentMilestones.length < 2) return "Commercial policy must include at least two payment milestones.";
    const milestones = value.paymentMilestones as Array<Record<string, unknown>>;
    if (milestones.some((item) => typeof item.label !== "string" || !item.label.trim() || !Number.isFinite(Number(item.percent)) || Number(item.percent) < 0 || Number(item.percent) > 100)) return "Each payment milestone needs a label and percentage between 0 and 100.";
    const total = milestones.reduce((sum, item) => sum + Number(item.percent), 0);
    if (Math.abs(total - 100) > 0.001) return "Payment milestone percentages must sum to exactly 100%.";
    if (!value.deliveryClock || typeof value.deliveryClock !== "object") return "Define the delivery clock rules.";
    if (!value.taxPolicyVersion || typeof value.taxPolicyVersion !== "string") return "Record the CA-approved tax policy version.";
  }
  if (key === "warranty_policy") {
    if (!Array.isArray(value.coverage) || value.coverage.length < 1) return "Warranty policy must list explicit coverage categories.";
    if (typeof value.version !== "string" || !value.version.trim()) return "Warranty policy version is required.";
  }
  return null;
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Administrator sign-in is required." }, { status: 401 });
  try {
    const sql = getSql();
    const rows = await sql`SELECT setting_key, value, policy_version, updated_by, updated_at FROM rr_settings ORDER BY setting_key`;
    return NextResponse.json({ settings: rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return NextResponse.json({ error: safeDatabaseError(error) }, { status: 503 }); }
}

export async function PUT(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Administrator sign-in is required." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return NextResponse.json({ error: "A valid settings payload is required." }, { status: 400 }); }
  const key = typeof body.settingKey === "string" ? body.settingKey : "";
  const version = typeof body.policyVersion === "string" ? body.policyVersion.trim().slice(0,80) : "";
  const approvedBy = typeof body.approvedBy === "string" ? body.approvedBy.trim().slice(0,160) : "";
  const value = body.value && typeof body.value === "object" && !Array.isArray(body.value) ? body.value as Record<string, unknown> : null;
  if (!allowedKeys.has(key) || !version || !approvedBy || !value) return NextResponse.json({ error: "Choose a supported setting, policy version, JSON value and named approver." }, { status: 400 });
  const validation = validPolicy(key, value);
  if (validation) return NextResponse.json({ error: validation }, { status: 400 });
  try {
    const sql = getSql();
    const rows = await sql`INSERT INTO rr_settings (setting_key, value, policy_version, updated_by, updated_at)
      VALUES (${key}, ${JSON.stringify({ ...value, approval: { approvedBy, approvedAt: new Date().toISOString() } })}::jsonb, ${version}, ${approvedBy}, now())
      ON CONFLICT (setting_key) DO UPDATE SET value=EXCLUDED.value, policy_version=EXCLUDED.policy_version, updated_by=EXCLUDED.updated_by, updated_at=now()
      RETURNING setting_key, value, policy_version, updated_by, updated_at`;
    await sql`INSERT INTO rr_audit_log (actor_id, action, entity_type, entity_id, after_state, reason)
      VALUES ('admin', 'update_policy', 'setting', ${key}, ${JSON.stringify({ policyVersion: version })}::jsonb, ${`Approved by ${approvedBy}`})`;
    return NextResponse.json({ setting: rows[0] });
  } catch (error) { return NextResponse.json({ error: safeDatabaseError(error) }, { status: 503 }); }
}
