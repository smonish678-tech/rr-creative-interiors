import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { databaseConfigured, getSql, safeDatabaseError } from "@/lib/operations/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Administrator sign-in is required." }, { status: 401 });
  if (!databaseConfigured()) {
    return NextResponse.json({ ready: false, databaseConfigured: false, schemaReady: false, message: "Set DATABASE_URL and apply db/migrations/001_operations.sql before enabling operational writes." }, { status: 503 });
  }
  try {
    const sql = getSql();
    const rows = await sql`SELECT
      to_regclass('public.rr_customers') AS customers,
      to_regclass('public.rr_contacts') AS contacts,
      to_regclass('public.rr_projects') AS projects,
      to_regclass('public.rr_leads') AS leads,
      to_regclass('public.rr_quotes') AS quotes,
      to_regclass('public.rr_payment_milestones') AS milestones,
      to_regclass('public.rr_documents') AS documents,
      to_regclass('public.rr_transactions') AS transactions,
      to_regclass('public.rr_approvals') AS approvals,
      to_regclass('public.rr_tasks') AS tasks,
      to_regclass('public.rr_events') AS events,
      to_regclass('public.rr_checklist_items') AS checklists,
      to_regclass('public.rr_warranties') AS warranties,
      to_regclass('public.rr_warranty_claims') AS claims,
      to_regclass('public.rr_message_jobs') AS messages,
      to_regclass('public.rr_settings') AS settings,
      to_regclass('public.rr_audit_log') AS audit_log`;
    const requiredTables = Object.keys(rows[0] || {});
    const missingTables = requiredTables.filter((key) => !rows[0]?.[key]);
    const schemaReady = requiredTables.length === 17 && missingTables.length === 0;
    return NextResponse.json({ ready: schemaReady, databaseConfigured: true, schemaReady, missingTables, message: schemaReady ? "Operations database is ready." : "Database is connected but one or more operations migrations are missing. Apply migrations 001, 002 and 003." }, { status: schemaReady ? 200 : 503, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ ready: false, databaseConfigured: true, schemaReady: false, message: safeDatabaseError(error) }, { status: 503 });
  }
}
