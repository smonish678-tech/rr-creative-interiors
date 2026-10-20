import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { getSql, safeDatabaseError } from "@/lib/operations/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Administrator sign-in is required." }, { status: 401 });
  try {
    const sql = getSql();
    const [leadCounts, projectCounts, taskCounts, finance, docs, warranties, claims, overdueTasks, blockedProjects, incompleteDocs] = await Promise.all([
      sql`SELECT status, count(*)::int AS count FROM rr_leads GROUP BY status ORDER BY status`,
      sql`SELECT stage, count(*)::int AS count FROM rr_projects GROUP BY stage ORDER BY stage`,
      sql`SELECT status, count(*)::int AS count FROM rr_tasks GROUP BY status ORDER BY status`,
      sql`SELECT count(*) FILTER (WHERE verification='unverified')::int AS unverified_transactions, COALESCE(sum(amount_minor) FILTER (WHERE direction='in' AND verification='verified'),0)::bigint AS verified_in_minor, COALESCE(sum(amount_minor) FILTER (WHERE direction='out' AND verification='verified'),0)::bigint AS verified_out_minor FROM rr_transactions`,
      sql`SELECT status, count(*)::int AS count FROM rr_documents GROUP BY status ORDER BY status`,
      sql`SELECT status, count(*)::int AS count FROM rr_warranties GROUP BY status ORDER BY status`,
      sql`SELECT status, count(*)::int AS count FROM rr_warranty_claims GROUP BY status ORDER BY status`,
      sql`SELECT id, title, project_id, customer_id, due_at, priority FROM rr_tasks WHERE status IN ('open','in_progress','blocked') AND due_at < now() ORDER BY due_at ASC LIMIT 100`,
      sql`SELECT id, project_code, name, stage, hold_reason, updated_at FROM rr_projects WHERE stage='on_hold' OR (stage NOT IN ('closed','cancelled') AND updated_at < now() - interval '14 days') ORDER BY updated_at ASC LIMIT 100`,
      sql`SELECT p.id, p.project_code, p.name, p.stage, count(d.id)::int AS document_count FROM rr_projects p LEFT JOIN rr_documents d ON d.project_id=p.id GROUP BY p.id HAVING count(d.id)=0 ORDER BY p.created_at DESC LIMIT 100`
    ]);
    return NextResponse.json({
      generatedAt: new Date().toISOString(),
      leadCounts, projectCounts, taskCounts, finance, documentCounts: docs, warrantyCounts: warranties, warrantyClaimCounts: claims,
      overdueTasks, blockedOrStaleProjects: blockedProjects, projectsWithoutDocuments: incompleteDocs,
      note: "Cycle times and balances are operational indicators. Tax reporting and financial statements must come from the CA-approved ledger/invoice process."
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return NextResponse.json({ error: safeDatabaseError(error) }, { status: 503 }); }
}
