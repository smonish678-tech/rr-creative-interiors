import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { loadOperationsWorkspace } from "@/lib/workspace-store";
import { loadProjectOperations, saveProjectOperations } from "@/lib/operations-store";
import {
  normalizeOperationsData, projectGateBlockers, quoteTotals, validateOperationsData,
  type OperationsData, type ProjectDocument, type OperationsEvent,
} from "@/lib/project-operations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ error: "Administrator sign-in is required." }, { status: 401, headers: { "Cache-Control": "no-store" } });
}
function object(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
function nextPhase(from: string, to: string) {
  const phases = ["initial_quote", "booking", "design", "final_approval", "production", "execution", "handover", "warranty", "closed"];
  return phases.indexOf(to) === phases.indexOf(from) + 1;
}
function validatePolicy(data: OperationsData): string[] {
  const errors: string[] = [];
  const p = data.policy;
  if (!p.approved) return errors;
  if (!p.reviewedByCA) errors.push("A CA review must be recorded before business policy can be approved.");
  if (!p.reviewedByLegal || !p.contract.stampDutyReviewed) errors.push("Legal and stamp-duty review must be recorded before policy approval.");
  if (!p.gst.approved || p.gst.rate === null || !p.gst.defaultTaxCode.trim()) errors.push("GST treatment, rate and tax-code defaults need CA approval.");
  if (!p.delivery.approved || p.delivery.duration === null || p.delivery.duration <= 0 || p.delivery.graceDays === null || !p.delivery.clockStartsAt.trim()) errors.push("Delivery duration, grace and start trigger must be defined and approved.");
  if (!p.warranty.approved || p.warranty.joineryMonths === null || p.warranty.joineryMonths < 0 || !p.warranty.thirdPartyRule.trim() || !p.warranty.exclusions.trim()) errors.push("Warranty duration, third-party terms and exclusions must be set and approved.");
  if (!p.contract.approved || !p.contract.version.trim() || !p.contract.cancellationPolicy.trim()) errors.push("An approved contract version and cancellation policy are required.");
  if (!p.paymentMilestones.length || Math.abs(p.paymentMilestones.reduce((sum,item)=>sum+item.percent,0)-100)>0.01) errors.push("Approved payment milestones must add up to exactly 100%.");
  if (!p.communications.approvedTemplates || !p.communications.ownerEmailProvider.trim()) errors.push("Approved customer messages and the email provider must be configured.");
  return errors;
}
function validateDocuments(data: OperationsData): string[] {
  const errors: string[] = [];
  const previousDocs = new Map<string, ProjectDocument>();
  // Shape and evidence requirements are checked again against the current stored state in POST.
  for (const doc of data.documents) {
    if (["signed"].includes(doc.status) && (!doc.signedAt || !doc.signedBy || !(doc.privateFilePath || doc.externalEnvelopeId))) {
      errors.push(`Signed document ${doc.number || doc.title} needs signer, date and private signed-file/e-sign evidence.`);
    }
    if (["issued"].includes(doc.status) && ["final_quote","works_contract","tax_invoice","payment_receipt","booking_receipt","warranty_certificate"].includes(doc.kind) && !data.policy.approved) {
      errors.push(`${doc.title} cannot be issued until the relevant business policy is approved. Keep it as a draft.`);
    }
    previousDocs.set(doc.id, doc);
  }
  return errors;
}
function buildEvent(projectId: string, type: string, title: string, detail: string, actor: string): OperationsEvent {
  const now = new Date().toISOString();
  return { id: randomUUID(), projectId, type, title, detail, actor: actor || "Owner", occurredAt: now, idempotencyKey: `${type}:${projectId}:${now}` };
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();
  try {
    const [data, crm] = await Promise.all([loadProjectOperations(), loadOperationsWorkspace({ includePublicEnquiries: true })]);
    return NextResponse.json({
      data,
      crm: {
        clients: crm.clients.map((item) => ({ id: item.id, name: item.name, email: item.email, phone: item.phone })),
        leads: crm.leads.map((item) => ({ id: item.id, clientId: item.clientId, name: item.name, email: item.email, phone: item.phone, project: item.project, serviceType: item.serviceType, location: item.location, budget: item.budget, status: item.status, date: item.date })),
        invoices: crm.invoices.map((item) => ({ id: item.id, clientId: item.clientId, leadId: item.leadId, client: item.client, project: item.project, date: item.date, total: item.amount, paid: item.paid, type: item.type, status: item.status })),
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load Project Operations.";
    return NextResponse.json({ error: message }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();
  try {
    const body: unknown = await request.json();
    if (!object(body) || !object(body.data) || typeof body.expectedRevision !== "number") {
      return NextResponse.json({ error: "Operations update is invalid." }, { status: 400 });
    }
    const current = await loadProjectOperations();
    if (current.revision !== body.expectedRevision) {
      return NextResponse.json({ error: "Another tab has saved a newer operations revision. Refresh before saving to avoid overwriting that change.", conflict: true, revision: current.revision }, { status: 409, headers: { "Cache-Control": "no-store" } });
    }
    const next = normalizeOperationsData(body.data);
    if (next.projects.length > 5000 || next.documents.length > 50000 || next.events.length > 100000) {
      return NextResponse.json({ error: "Operations data exceeds the supported size. Export a backup and archive closed projects." }, { status: 413 });
    }

    const crm = await loadOperationsWorkspace({ includePublicEnquiries: true });
    const customerIds = new Set(crm.clients.map((client) => String(client.id || "")));
    const leadsById = new Map(crm.leads.map((lead) => [String(lead.id || ""), lead]));
    const oldProjectById = new Map(current.projects.map((project) => [project.id, project]));
    const errors = [...validateOperationsData(next), ...validatePolicy(next), ...validateDocuments(next)];
    const linkedLeadIds = new Set<string>();

    for (const project of next.projects) {
      if (!customerIds.has(project.clientId)) errors.push(`Project ${project.code} links to a customer that no longer exists in CRM.`);
      if (project.linkedLeadId) {
        const lead = leadsById.get(project.linkedLeadId);
        if (!lead) errors.push(`Project ${project.code} links to an unknown CRM lead.`);
        else if (lead.clientId && lead.clientId !== project.clientId) errors.push(`Project ${project.code} customer does not match its CRM lead.`);
        if (linkedLeadIds.has(project.linkedLeadId)) errors.push(`CRM lead ${project.linkedLeadId} has more than one Project Passport. Create one project and use change orders for scope changes.`);
        linkedLeadIds.add(project.linkedLeadId);
      }
      const prior = oldProjectById.get(project.id);
      if (prior && project.phase !== prior.phase) {
        if (!nextPhase(prior.phase, project.phase)) {
          errors.push(`${project.code}: projects can advance only one phase at a time and cannot skip required gates.`);
        } else {
          const blockers = projectGateBlockers(prior, next, project.phase);
          if (blockers.length) errors.push(`${project.code} cannot move from ${prior.phase} to ${project.phase}: ${blockers.join(" ")}`);
        }
      }
    }

    const oldQuotes = new Map(current.quotes.map((quote) => [quote.id, quote]));
    for (const quote of next.quotes) {
      const project = next.projects.find((item) => item.id === quote.projectId);
      if (!project) continue;
      const totals = quoteTotals(quote.lines, next.policy.gst.approved ? next.policy.gst.rate : null);
      if (Math.abs(quote.subtotal - totals.subtotal) > 0.02) errors.push(`Quote ${quote.id}: subtotal doesn't match its line items.`);
      if (quote.status !== "draft" && (!quote.preflightPassed || quote.preflightErrors.length)) errors.push(`Quote ${quote.id} cannot be issued or accepted until preflight passes.`);
      if (quote.status === "issued" && quote.kind !== "initial" && !next.policy.approved) errors.push(`Final/change quote ${quote.id} can only be issued after Phase 0 commercial terms are approved.`);
      const old = oldQuotes.get(quote.id);
      if (old && old.status === "draft" && quote.status === "accepted" && !old.preflightPassed) errors.push(`Quote ${quote.id} has not passed preflight and cannot be accepted.`);
    }

    const oldTransactions = new Map(current.transactions.map((transaction) => [transaction.id, transaction]));
    for (const transaction of next.transactions) {
      if (transaction.amount <= 0 || !Number.isFinite(transaction.amount)) errors.push(`Transaction ${transaction.id} must be a positive amount.`);
      if (transaction.status === "verified" && (!transaction.transactionReference.trim() || !transaction.verifiedAt || !transaction.verifiedBy.trim())) errors.push(`Verified payment ${transaction.id} needs a transaction reference, verification timestamp and verifier.`);
      const old = oldTransactions.get(transaction.id);
      if (old && old.status !== "verified" && transaction.status === "verified" && !transaction.evidenceNote.trim()) errors.push(`Payment ${transaction.id} needs a note describing where the credit was independently checked.`);
    }
    for (const milestone of next.milestones) {
      if (milestone.paidAmount < -0.009 || milestone.paidAmount > (milestone.amount ?? Number.POSITIVE_INFINITY) + 0.02) errors.push(`Milestone ${milestone.name} has an invalid received amount.`);
      const paid = next.transactions.filter((transaction) => transaction.milestoneId === milestone.id && transaction.projectId === milestone.projectId && transaction.status === "verified" && transaction.kind !== "refund").reduce((sum, transaction) => sum + transaction.amount, 0);
      const refunds = next.transactions.filter((transaction) => transaction.milestoneId === milestone.id && transaction.projectId === milestone.projectId && transaction.status === "verified" && transaction.kind === "refund").reduce((sum, transaction) => sum + transaction.amount, 0);
      if (Math.abs(milestone.paidAmount - Math.max(0, paid - refunds)) > 0.02) errors.push(`Milestone ${milestone.name} paid amount must equal its verified transaction ledger.`);
    }
    if (errors.length) return NextResponse.json({ error: errors.slice(0, 12).join("\n"), errors: errors.slice(0, 30) }, { status: 422, headers: { "Cache-Control": "no-store" } });

    const actor = typeof body.actor === "string" ? body.actor.slice(0, 100) : "Owner";
    const summary = typeof body.summary === "string" ? body.summary.slice(0, 280) : "Project Operations updated.";
    const changedProject = next.projects.find((project) => {
      const previous = oldProjectById.get(project.id);
      return !previous || JSON.stringify(previous) !== JSON.stringify(project);
    });
    next.events = [...next.events, buildEvent(changedProject?.id || "", "operations_saved", "Operations record saved", summary, actor)].slice(-100000);
    next.revision = current.revision;
    const saved = await saveProjectOperations(next, current.revision);
    return NextResponse.json({ saved: true, data: saved }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save Project Operations.";
    const conflict = message.includes("out of date");
    return NextResponse.json({ error: message, conflict }, { status: conflict ? 409 : 503, headers: { "Cache-Control": "no-store" } });
  }
}
