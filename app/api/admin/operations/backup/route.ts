import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { getSql, safeDatabaseError } from "@/lib/operations/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const tables = [
  "rr_customers","rr_contacts","rr_projects","rr_leads","rr_quotes","rr_payment_milestones",
  "rr_documents","rr_transactions","rr_approvals","rr_tasks","rr_events","rr_checklist_items",
  "rr_warranties","rr_warranty_claims","rr_message_jobs","rr_settings","rr_audit_log"
] as const;

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Administrator sign-in is required." }, { status: 401 });
  try {
    const sql = getSql();
    const [schema, ...records] = await Promise.all([
      sql`SELECT to_regclass('public.rr_customers') AS customers_table, to_regclass('public.rr_projects') AS projects_table`,
      ...tables.map((table) => {
        switch (table) {
          case "rr_customers": return sql`SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) AS data FROM rr_customers t`;
          case "rr_contacts": return sql`SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) AS data FROM rr_contacts t`;
          case "rr_projects": return sql`SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) AS data FROM rr_projects t`;
          case "rr_leads": return sql`SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) AS data FROM rr_leads t`;
          case "rr_quotes": return sql`SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) AS data FROM rr_quotes t`;
          case "rr_payment_milestones": return sql`SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) AS data FROM rr_payment_milestones t`;
          case "rr_documents": return sql`SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) AS data FROM rr_documents t`;
          case "rr_transactions": return sql`SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) AS data FROM rr_transactions t`;
          case "rr_approvals": return sql`SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) AS data FROM rr_approvals t`;
          case "rr_tasks": return sql`SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) AS data FROM rr_tasks t`;
          case "rr_events": return sql`SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) AS data FROM rr_events t`;
          case "rr_checklist_items": return sql`SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) AS data FROM rr_checklist_items t`;
          case "rr_warranties": return sql`SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) AS data FROM rr_warranties t`;
          case "rr_warranty_claims": return sql`SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) AS data FROM rr_warranty_claims t`;
          case "rr_message_jobs": return sql`SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) AS data FROM rr_message_jobs t`;
          case "rr_settings": return sql`SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) AS data FROM rr_settings t`;
          case "rr_audit_log": return sql`SELECT coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) AS data FROM rr_audit_log t`;
        }
      })
    ]);
    if (!schema[0]?.customers_table || !schema[0]?.projects_table) return NextResponse.json({ error: "Operations schema is not installed; no backup was produced." }, { status: 503 });
    const data: Record<string, unknown> = {};
    tables.forEach((table, index) => { data[table] = records[index]?.[0]?.data ?? []; });
    const backup = { format: "rr-operations-backup", schemaVersion: 1, createdAt: new Date().toISOString(), tables: data };
    await sql`INSERT INTO rr_audit_log (actor_id, action, entity_type, entity_id, after_state) VALUES ('admin', 'export_backup', 'database', 'operations', ${JSON.stringify({ schemaVersion: 1, tableCounts: Object.fromEntries(tables.map((table) => [table, Array.isArray(data[table]) ? (data[table] as unknown[]).length : 0])) })}::jsonb)`;
    return new NextResponse(JSON.stringify(backup, null, 2), { headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="rr-operations-backup-${new Date().toISOString().slice(0,10)}.json"`,
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff"
    } });
  } catch (error) { return NextResponse.json({ error: safeDatabaseError(error) }, { status: 503 }); }
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Administrator sign-in is required." }, { status: 401 });
  let backup: unknown;
  try { backup = await request.json(); }
  catch { return NextResponse.json({ error: "Upload a valid JSON backup file." }, { status: 400 }); }
  if (!backup || typeof backup !== "object" || (backup as { format?: unknown }).format !== "rr-operations-backup" || (backup as { schemaVersion?: unknown }).schemaVersion !== 1) {
    return NextResponse.json({ valid: false, error: "Backup format or schema version is unsupported." }, { status: 400 });
  }
  const tableData = (backup as { tables?: unknown }).tables;
  if (!tableData || typeof tableData !== "object" || Array.isArray(tableData)) return NextResponse.json({ valid: false, error: "Backup is missing the tables object." }, { status: 400 });
  const missing = tables.filter((table) => !Array.isArray((tableData as Record<string, unknown>)[table]));
  if (missing.length) return NextResponse.json({ valid: false, error: "Backup is missing required tables.", missing }, { status: 400 });
  const counts = Object.fromEntries(tables.map((table) => [table, ((tableData as Record<string, unknown>)[table] as unknown[]).length]));
  // Deliberately validate-only. Destructive restore is never triggered by an upload request.
  return NextResponse.json({ valid: true, restoreApplied: false, schemaVersion: 1, counts, message: "Backup structure passed validation. This endpoint does not overwrite live records. Restore must be rehearsed against a separate database and reviewed before cutover." });
}
