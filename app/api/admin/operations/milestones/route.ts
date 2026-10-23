import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { getSql, safeDatabaseError } from "@/lib/operations/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Administrator sign-in is required." }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  if (projectId && !/^[0-9a-f-]{36}$/i.test(projectId)) return NextResponse.json({ error: "Project ID is invalid." }, { status: 400 });
  try {
    const sql = getSql();
    const rows = projectId
      ? await sql`SELECT m.*, q.quote_number, q.revision FROM rr_payment_milestones m JOIN rr_quotes q ON q.id=m.quote_id WHERE m.project_id=${projectId}::uuid ORDER BY q.revision DESC, m.sequence`
      : await sql`SELECT m.*, q.quote_number, q.revision, p.project_code, p.name AS project_name FROM rr_payment_milestones m JOIN rr_quotes q ON q.id=m.quote_id JOIN rr_projects p ON p.id=m.project_id ORDER BY m.due_at NULLS LAST, p.project_code, m.sequence LIMIT 500`;
    return NextResponse.json({ milestones: rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return NextResponse.json({ error: safeDatabaseError(error) }, { status: 503 }); }
}
