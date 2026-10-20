import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { getSql, safeDatabaseError } from "@/lib/operations/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Administrator sign-in is required." }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  try {
    const sql = getSql();
    const warranties = projectId
      ? await sql`SELECT w.*, c.display_name AS customer_name, p.project_code, p.name AS project_name FROM rr_warranties w JOIN rr_customers c ON c.id=w.customer_id JOIN rr_projects p ON p.id=w.project_id WHERE w.project_id=${projectId}::uuid ORDER BY w.created_at DESC`
      : await sql`SELECT w.*, c.display_name AS customer_name, p.project_code, p.name AS project_name FROM rr_warranties w JOIN rr_customers c ON c.id=w.customer_id JOIN rr_projects p ON p.id=w.project_id ORDER BY w.created_at DESC LIMIT 200`;
    return NextResponse.json({ warranties }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return NextResponse.json({ error: safeDatabaseError(error) }, { status: 503 }); }
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Administrator sign-in is required." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return NextResponse.json({ error: "A valid warranty record is required." }, { status: 400 }); }
  const projectId = typeof body.projectId === "string" ? body.projectId : "";
  const policyVersion = typeof body.policyVersion === "string" ? body.policyVersion.trim().slice(0,80) : "";
  const startDate = typeof body.joineryStartDate === "string" ? body.joineryStartDate : "";
  const endDate = typeof body.joineryEndDate === "string" ? body.joineryEndDate : "";
  const coverage = Array.isArray(body.coverageSnapshot) ? body.coverageSnapshot.slice(0,20) : [];
  const certificateDocumentId = typeof body.certificateDocumentId === "string" && /^[0-9a-f-]{36}$/i.test(body.certificateDocumentId) ? body.certificateDocumentId : null;
  const invoiceDocumentId = typeof body.invoiceDocumentId === "string" && /^[0-9a-f-]{36}$/i.test(body.invoiceDocumentId) ? body.invoiceDocumentId : null;
  if (!/^[0-9a-f-]{36}$/i.test(projectId) || !policyVersion || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate) || endDate <= startDate || !coverage.length) {
    return NextResponse.json({ error: "Provide a project, approved warranty policy version, valid start/end dates and explicit coverage categories. The application will not guess warranty duration." }, { status: 400 });
  }
  try {
    const sql = getSql();
    const projects = await sql`SELECT p.id, p.customer_id FROM rr_projects p WHERE p.id=${projectId}::uuid LIMIT 1`;
    if (!projects.length) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const handover = await sql`SELECT id FROM rr_documents WHERE project_id=${projectId}::uuid AND kind='handover_pack' AND status='signed' LIMIT 1`;
    if (!handover.length) return NextResponse.json({ error: "Handover must be acknowledged before activating a warranty." }, { status: 409 });
    if (invoiceDocumentId) {
      const invoice = await sql`SELECT id FROM rr_documents WHERE id=${invoiceDocumentId}::uuid AND project_id=${projectId}::uuid AND kind='tax_invoice' AND status IN ('issued','sent','viewed','signed') LIMIT 1`;
      if (!invoice.length) return NextResponse.json({ error: "The invoice document does not belong to this project or is not issued." }, { status: 400 });
    }
    const id = randomUUID();
    const rows = await sql`INSERT INTO rr_warranties (id, project_id, customer_id, certificate_document_id, invoice_document_id, joinery_start_date, joinery_end_date, policy_version, status, coverage_snapshot, created_by)
      VALUES (${id}::uuid, ${projectId}::uuid, ${projects[0].customer_id}::uuid, ${certificateDocumentId}::uuid, ${invoiceDocumentId}::uuid, ${startDate}::date, ${endDate}::date, ${policyVersion}, 'active', ${JSON.stringify(coverage)}::jsonb, 'admin') RETURNING *`;
    await sql`INSERT INTO rr_audit_log (actor_id, action, entity_type, entity_id, after_state) VALUES ('admin', 'register_warranty', 'warranty', ${id}, ${JSON.stringify({ projectId, policyVersion, startDate, endDate })}::jsonb)`;
    return NextResponse.json({ warranty: rows[0] }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: safeDatabaseError(error) }, { status: 503 }); }
}
