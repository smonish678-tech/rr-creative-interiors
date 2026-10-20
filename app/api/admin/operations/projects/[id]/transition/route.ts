import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { getSql, safeDatabaseError } from "@/lib/operations/db";
import { checkGate, PROJECT_STAGES, type ProjectStage } from "@/lib/operations/model";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const transitions: Record<ProjectStage, ProjectStage[]> = {
  booking: ["design", "on_hold", "cancelled"],
  design: ["design_approval", "on_hold", "cancelled"],
  design_approval: ["design", "contract", "on_hold"],
  contract: ["design", "production_ready", "on_hold"],
  production_ready: ["production", "on_hold"],
  production: ["quality_check", "on_hold"],
  quality_check: ["production", "dispatch", "on_hold"],
  dispatch: ["installation", "on_hold"],
  installation: ["handover", "on_hold"],
  handover: ["warranty", "on_hold"],
  warranty: ["closed", "on_hold"],
  closed: [],
  on_hold: ["booking", "design", "design_approval", "contract", "production_ready", "production", "quality_check", "dispatch", "installation", "handover", "warranty", "cancelled"],
  cancelled: []
};

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Administrator sign-in is required." }, { status: 401 });
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Project ID is invalid." }, { status: 400 });
  let body: { stage?: unknown; reason?: unknown };
  try { body = await request.json() as { stage?: unknown; reason?: unknown }; }
  catch { return NextResponse.json({ error: "Choose the next project stage." }, { status: 400 }); }
  const target = typeof body.stage === "string" ? body.stage as ProjectStage : null;
  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
  if (!target || !PROJECT_STAGES.includes(target)) return NextResponse.json({ error: "That project stage is not supported." }, { status: 400 });

  try {
    const sql = getSql();
    const projects = await sql`SELECT id, project_code, stage, customer_id FROM rr_projects WHERE id=${id}::uuid LIMIT 1`;
    if (!projects.length) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    const project = projects[0];
    const current = String(project.stage) as ProjectStage;
    if (current === target) return NextResponse.json({ project, unchanged: true });
    if (!(transitions[current] || []).includes(target)) {
      return NextResponse.json({ error: `Project cannot move directly from ${current} to ${target}. Use the approved stage sequence.` }, { status: 409 });
    }
    if (target === "on_hold" && !reason) return NextResponse.json({ error: "Add a reason before placing a project on hold." }, { status: 400 });
    if (target === "cancelled" && !reason) return NextResponse.json({ error: "Add a cancellation reason. Review the signed contract before confirming cancellation." }, { status: 400 });

    const [acceptedQuote, bookingSigned, verifiedBookingPayment, designDocumentReady, designApproved, finalQuoteAccepted, contractSigned, paidProductionMilestone, procurementComplete, productionComplete, qualityPassed, paidDispatchMilestone, siteReady, installationComplete, snagStatus, handoverSigned, unverifiedTransactions, warrantyActive] = await Promise.all([
      sql`SELECT id FROM rr_quotes WHERE project_id=${id}::uuid AND status='accepted' LIMIT 1`,
      sql`SELECT id FROM rr_documents WHERE project_id=${id}::uuid AND kind='booking_form' AND status='signed' LIMIT 1`,
      sql`SELECT t.id FROM rr_transactions t JOIN rr_payment_milestones m ON m.id=t.milestone_id WHERE t.project_id=${id}::uuid AND t.direction='in' AND t.verification='verified' AND m.trigger='booking' LIMIT 1`,
      sql`SELECT id FROM rr_documents WHERE project_id=${id}::uuid AND kind='design_approval' AND status IN ('issued','sent','viewed') LIMIT 1`,
      sql`SELECT a.id FROM rr_approvals a JOIN rr_documents d ON d.id=a.document_id WHERE a.project_id=${id}::uuid AND a.status='approved' AND d.kind='design_approval' LIMIT 1`,
      sql`SELECT id FROM rr_quotes WHERE project_id=${id}::uuid AND status='accepted' AND revision=(SELECT max(q2.revision) FROM rr_quotes q2 WHERE q2.project_id=${id}::uuid) LIMIT 1`,
      sql`SELECT id FROM rr_documents WHERE project_id=${id}::uuid AND kind='works_contract' AND status='signed' LIMIT 1`,
      sql`SELECT id FROM rr_payment_milestones WHERE project_id=${id}::uuid AND trigger IN ('production_release','design_signoff') AND status='paid' LIMIT 1`,
      sql`SELECT count(*)::int AS total, count(*) FILTER (WHERE status IN ('passed','not_applicable'))::int AS done FROM rr_checklist_items WHERE project_id=${id}::uuid AND phase='procurement' AND required=true`,
      sql`SELECT count(*)::int AS total, count(*) FILTER (WHERE status IN ('passed','not_applicable'))::int AS done FROM rr_checklist_items WHERE project_id=${id}::uuid AND phase='production' AND required=true`,
      sql`SELECT count(*)::int AS total, count(*) FILTER (WHERE status='passed')::int AS done FROM rr_checklist_items WHERE project_id=${id}::uuid AND phase='quality' AND required=true`,
      sql`SELECT id FROM rr_payment_milestones WHERE project_id=${id}::uuid AND trigger='dispatch' AND status='paid' LIMIT 1`,
      sql`SELECT site_ready FROM rr_projects WHERE id=${id}::uuid LIMIT 1`,
      sql`SELECT count(*)::int AS total, count(*) FILTER (WHERE status='passed')::int AS done FROM rr_checklist_items WHERE project_id=${id}::uuid AND phase='installation' AND required=true`,
      sql`SELECT count(*)::int AS total, count(*) FILTER (WHERE status IN ('passed','not_applicable'))::int AS done FROM rr_checklist_items WHERE project_id=${id}::uuid AND phase='snag' AND required=true`,
      sql`SELECT id FROM rr_documents WHERE project_id=${id}::uuid AND kind='handover_pack' AND status='signed' LIMIT 1`,
      sql`SELECT id FROM rr_transactions WHERE project_id=${id}::uuid AND verification='unverified' LIMIT 1`,
      sql`SELECT id FROM rr_warranties WHERE project_id=${id}::uuid AND status='active' LIMIT 1`
    ]);
    const facts = {
      acceptedQuote: acceptedQuote.length > 0,
      bookingSigned: bookingSigned.length > 0,
      bookingPaymentVerified: verifiedBookingPayment.length > 0,
      designDocumentReady: designDocumentReady.length > 0,
      designApproved: designApproved.length > 0,
      finalQuoteAccepted: finalQuoteAccepted.length > 0,
      worksContractSigned: contractSigned.length > 0,
      productionMilestonesVerified: paidProductionMilestone.length > 0,
      requiredProcurementComplete: Number(procurementComplete[0]?.total) > 0 && procurementComplete[0]?.total === procurementComplete[0]?.done,
      requiredProductionComplete: Number(productionComplete[0]?.total) > 0 && productionComplete[0]?.total === productionComplete[0]?.done,
      qualityPassed: Number(qualityPassed[0]?.total) > 0 && qualityPassed[0]?.total === qualityPassed[0]?.done,
      dispatchPaymentVerified: paidDispatchMilestone.length > 0,
      siteReady: siteReady[0]?.site_ready === true,
      installationComplete: Number(installationComplete[0]?.total) > 0 && installationComplete[0]?.total === installationComplete[0]?.done,
      snagsResolvedOrAccepted: Number(snagStatus[0]?.total) > 0 && snagStatus[0]?.total === snagStatus[0]?.done,
      handoverAcknowledged: handoverSigned.length > 0,
      financeReconciled: unverifiedTransactions.length === 0,
      warrantyRegistered: warrantyActive.length > 0
    };
    const gate = checkGate(target, facts);
    if (!gate.allowed) return NextResponse.json({ error: "This stage is blocked until the required checks are complete.", missing: gate.missing, facts }, { status: 409 });

    const eventId = randomUUID();
    const updated = await sql.transaction([
      sql`UPDATE rr_projects SET stage=${target}, hold_reason=${target === "on_hold" ? reason : null}, closed_at=CASE WHEN ${target}='closed' THEN now() ELSE closed_at END, updated_at=now(), version=version+1 WHERE id=${id}::uuid RETURNING *`,
      sql`INSERT INTO rr_events (id, event_type, aggregate_type, aggregate_id, actor_id, idempotency_key, payload)
        VALUES (${eventId}::uuid, 'project.stage_changed', 'project', ${id}, 'admin', ${`project.stage_changed:${id}:${target}:${eventId}`}, ${JSON.stringify({ from: current, to: target, reason })}::jsonb)`,
      sql`INSERT INTO rr_audit_log (actor_id, action, entity_type, entity_id, before_state, after_state, reason)
        VALUES ('admin', 'stage_transition', 'project', ${id}, ${JSON.stringify({ stage: current })}::jsonb, ${JSON.stringify({ stage: target })}::jsonb, ${reason || null})`
    ]);
    return NextResponse.json({ project: updated[0][0], gate: "passed" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: safeDatabaseError(error) }, { status: 503 });
  }
}
