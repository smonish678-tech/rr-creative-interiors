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
    const rows = await sql`SELECT to_regclass('public.rr_projects') AS projects_table, to_regclass('public.rr_customers') AS customers_table`;
    const schemaReady = Boolean(rows[0]?.projects_table && rows[0]?.customers_table);
    return NextResponse.json({ ready: schemaReady, databaseConfigured: true, schemaReady, message: schemaReady ? "Operations database is ready." : "Database is connected but the operations migration has not been applied." }, { status: schemaReady ? 200 : 503, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ ready: false, databaseConfigured: true, schemaReady: false, message: safeDatabaseError(error) }, { status: 503 });
  }
}
