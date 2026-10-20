import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { getSql, safeDatabaseError } from "@/lib/operations/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const kinds = new Set(["initial_quote","booking_form","advance_receipt","design_approval","final_quote","works_contract","change_order","payment_request","payment_receipt","tax_invoice","handover_pack","warranty_certificate","other"]);

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Administrator sign-in is required." }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  try {
    const sql = getSql();
    const documents = projectId
      ? await sql`SELECT * FROM rr_documents WHERE project_id=${projectId}::uuid ORDER BY created_at DESC LIMIT 200`
      : await sql`SELECT d.*, p.project_code, p.name AS project_name, c.display_name AS customer_name FROM rr_documents d JOIN rr_projects p ON p.id=d.project_id JOIN rr_customers c ON c.id=d.customer_id ORDER BY d.created_at DESC LIMIT 200`;
    return NextResponse.json({ documents }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: safeDatabaseError(error) }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Administrator sign-in is required." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return NextResponse.json({ error: "A valid document request is required." }, { status: 400 }); }
  const projectId = typeof body.projectId === "string" ? body.projectId : "";
  const kind = typeof body.kind === "string" ? body.kind : "";
  const title = typeof body.title === "string" ? body.title.trim().slice(0, 180) : "";
  const snapshot = body.snapshot && typeof body.snapshot === "object" && !Array.isArray(body.snapshot) ? body.snapshot as Record<string, unknown> : {};
  if (!/^[0-9a-f-]{36}$/i.test(projectId) || !kinds.has(kind) || title.length < 2) {
    return NextResponse.json({ error: "Choose a project, a supported document type and a title." }, { status: 400 });
  }
  const id = randomUUID();
  try {
    const sql = getSql();
    const projectRows = await sql`SELECT p.id, p.project_code, p.name AS project_name, p.project_type, p.address, p.apartment, p.floor, p.possession_date, p.stage, p.customer_id, c.display_name AS customer_name, c.primary_email, c.primary_phone FROM rr_projects p JOIN rr_customers c ON c.id=p.customer_id WHERE p.id=${projectId}::uuid LIMIT 1`;
    if (!projectRows.length) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const p = projectRows[0];
    const [quoteRows, milestoneRows, financeRows] = await Promise.all([
      sql`SELECT quote_number, revision, status, lines, subtotal_minor, tax_minor, total_minor, valid_until, exclusions, assumptions FROM rr_quotes WHERE project_id=${projectId}::uuid ORDER BY revision DESC LIMIT 1`,
      sql`SELECT label, sequence, amount_minor, due_at, trigger, status FROM rr_payment_milestones WHERE project_id=${projectId}::uuid ORDER BY sequence`,
      sql`SELECT COALESCE(sum(amount_minor) FILTER (WHERE direction='in' AND verification='verified'),0)::bigint AS received_minor, COALESCE(sum(amount_minor) FILTER (WHERE direction='out' AND verification='verified'),0)::bigint AS paid_out_minor, count(*) FILTER (WHERE verification='unverified')::int AS unverified_count FROM rr_transactions WHERE project_id=${projectId}::uuid`
    ]);
    if (kind === "payment_receipt") {
      const transactionId = typeof snapshot.transactionId === "string" ? snapshot.transactionId : "";
      const payment = transactionId ? await sql`SELECT id, amount_minor, method, reference, verification, direction FROM rr_transactions WHERE id=${transactionId}::uuid AND project_id=${projectId}::uuid LIMIT 1` : [];
      if (!payment.length || payment[0].verification !== "verified" || payment[0].direction !== "in") {
        return NextResponse.json({ error: "A payment receipt requires a verified incoming transaction linked to this project." }, { status: 409 });
      }
      snapshot.payment = payment[0];
    }

    const documentNumber = `RR-${new Date().getUTCFullYear()}-${kind.toUpperCase().slice(0,4)}-${id.replace(/-/g, "").slice(0,8).toUpperCase()}`;
    const fullSnapshot = {
      ...snapshot,
      project: { id: p.id, code: p.project_code, name: p.project_name },
      customer: { id: p.customer_id, name: p.customer_name, email: p.primary_email, phone: p.primary_phone },
      generatedAt: new Date().toISOString(),
      templateVersion: "rr-ops-v1"
    };
    const rows = await sql`INSERT INTO rr_documents (id, project_id, customer_id, kind, document_number, version, status, title, mime_type, source_snapshot, created_by)
      VALUES (${id}::uuid, ${projectId}::uuid, ${p.customer_id}::uuid, ${kind}, ${documentNumber}, 1, 'draft', ${title}, 'text/html', ${JSON.stringify(fullSnapshot)}::jsonb, 'admin') RETURNING *`;
    await sql`INSERT INTO rr_audit_log (actor_id, action, entity_type, entity_id, after_state)
      VALUES ('admin', 'generate_draft', 'document', ${id}, ${JSON.stringify({ kind, documentNumber, projectId, templateVersion: "rr-ops-v1" })}::jsonb)`;
    return NextResponse.json({ document: rows[0], message: "Draft created from a frozen project snapshot. Review legal/tax wording before issue." }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: safeDatabaseError(error) }, { status: 503 });
  }
}
