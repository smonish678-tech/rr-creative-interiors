import { createHash, randomBytes, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { getSql, safeDatabaseError } from "@/lib/operations/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Administrator sign-in is required." }, { status: 401 });
  try {
    const sql = getSql();
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    const rows = projectId
      ? await sql`SELECT a.*, d.document_number, d.title AS document_title FROM rr_approvals a JOIN rr_documents d ON d.id=a.document_id WHERE a.project_id=${projectId}::uuid ORDER BY a.created_at DESC LIMIT 100`
      : await sql`SELECT a.*, d.document_number, d.title AS document_title, p.project_code FROM rr_approvals a JOIN rr_documents d ON d.id=a.document_id JOIN rr_projects p ON p.id=a.project_id ORDER BY a.created_at DESC LIMIT 100`;
    return NextResponse.json({ approvals: rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return NextResponse.json({ error: safeDatabaseError(error) }, { status: 503 }); }
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Administrator sign-in is required." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return NextResponse.json({ error: "A valid approval request is required." }, { status: 400 }); }
  const projectId = typeof body.projectId === "string" ? body.projectId : "";
  const documentId = typeof body.documentId === "string" ? body.documentId : "";
  const approverName = typeof body.approverName === "string" ? body.approverName.trim().slice(0, 160) : "";
  if (!/^[0-9a-f-]{36}$/i.test(projectId) || !/^[0-9a-f-]{36}$/i.test(documentId) || approverName.length < 2) {
    return NextResponse.json({ error: "Choose the project and document, and enter the approver name." }, { status: 400 });
  }
  const token = `${Math.floor(Date.now()/1000)+60*60*24*14}.${randomBytes(32).toString("base64url")}`;
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const id = randomUUID();
  try {
    const sql = getSql();
    const docs = await sql`SELECT id FROM rr_documents WHERE id=${documentId}::uuid AND project_id=${projectId}::uuid AND status IN ('draft','issued','sent') LIMIT 1`;
    if (!docs.length) return NextResponse.json({ error: "The selected document is not an eligible draft/issued document for this project." }, { status: 409 });
    const rows = await sql`INSERT INTO rr_approvals (id, project_id, document_id, approver_name, status, token_hash, created_by)
      VALUES (${id}::uuid, ${projectId}::uuid, ${documentId}::uuid, ${approverName}, 'pending', ${tokenHash}, 'admin') RETURNING id, project_id, document_id, approver_name, status, requested_at`;
    await sql`UPDATE rr_documents SET status='issued', issued_at=COALESCE(issued_at, now()), updated_at=now() WHERE id=${documentId}::uuid`;
    await sql`INSERT INTO rr_audit_log (actor_id, action, entity_type, entity_id, after_state) VALUES ('admin', 'request_approval', 'approval', ${id}, ${JSON.stringify({ documentId, approverName })}::jsonb)`;
    const origin = new URL(request.url).origin;
    return NextResponse.json({ approval: rows[0], approvalUrl: `${origin}/approval/${encodeURIComponent(token)}`, note: "This records an approval acknowledgement, not a substitute for a qualified electronic signature on a works contract." }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: safeDatabaseError(error) }, { status: 503 }); }
}
