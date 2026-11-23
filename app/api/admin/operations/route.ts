import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import {
  isApprovedBookingAdvanceReceipt,
  type OperationProject,
  type OperationProperty,
} from "@/lib/operations-gates";
import {
  loadOperationsWorkspaceSnapshot,
  saveOperationsWorkspace,
  WorkspaceConflictError,
  type OperationsWorkspace,
  type WorkspaceRecord,
} from "@/lib/workspace-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function respondError(message: string, status: number, code?: string) {
  return NextResponse.json({ error: message, ...(code ? { code } : {}) }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function text(value: unknown, max = 500): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cents(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? Math.round((numeric + Number.EPSILON) * 100) : Number.NaN;
}

function nextRevisionMatches(input: unknown, revision: string | null): boolean {
  return input === revision;
}

function docHas(documents: WorkspaceRecord[], type: string, projectId: string, leadId: string): boolean {
  return documents.some((document) =>
    document.documentType === type &&
    document.projectId === projectId &&
    (!leadId || document.leadId === leadId) &&
    ["uploaded", "signed", "approved"].includes(String(document.status))
  );
}

function asProject(value: WorkspaceRecord): OperationProject {
  return value as unknown as OperationProject;
}

function asProperty(value: WorkspaceRecord): OperationProperty {
  return value as unknown as OperationProperty;
}

function validPolicyMilestones(raw: unknown): { ok: true; milestones: WorkspaceRecord[]; total: number } | { ok: false; message: string } {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 20 || !raw.every(record)) {
    return { ok: false, message: "Add between 1 and 20 payment milestones." };
  }
  const ids = new Set<string>();
  const milestones: WorkspaceRecord[] = [];
  let total = 0;
  for (let index = 0; index < raw.length; index += 1) {
    const item = raw[index];
    const name = text(item.name, 120);
    const purpose = text(item.purpose, 40);
    const percentage = Number(item.percentage);
    const id = text(item.id, 100) || `MILESTONE-${index + 1}`;
    if (!name || !["booking_advance", "milestone", "final"].includes(purpose) ||
      !Number.isFinite(percentage) || percentage <= 0 || percentage > 100) {
      return { ok: false, message: `Milestone ${index + 1} needs a name, valid purpose and percentage between 0 and 100.` };
    }
    if (ids.has(id)) return { ok: false, message: "Milestone IDs must be unique." };
    ids.add(id);
    total = Math.round((total + percentage) * 100) / 100;
    milestones.push({ id, name, purpose, percentage, active: true });
  }
  if (!milestones.some((item) => item.purpose === "booking_advance")) {
    return { ok: false, message: "Add one booking/advance milestone before sending the draft for review." };
  }
  return { ok: true, milestones, total };
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return respondError("Administrator sign-in is required.", 401);
  try {
    const body: unknown = await request.json().catch(() => null);
    if (!record(body)) return respondError("Operations request is invalid.", 400);
    const action = text(body.action, 80);
    const snapshot = await loadOperationsWorkspaceSnapshot();
    if (!nextRevisionMatches(body.revision, snapshot.revision)) {
      return respondError("The workspace changed in another session. Refresh before changing operations records.", 409, "WORKSPACE_CONFLICT");
    }

    const workspace = snapshot.workspace;
    const now = new Date().toISOString();
    const auditEvents = [...workspace.auditEvents];
    let nextWorkspace: OperationsWorkspace = { ...workspace };

    if (action === "create-policy-draft") {
      const name = text(body.name, 120);
      const notes = text(body.notes, 2000);
      const checked = validPolicyMilestones(body.paymentMilestones);
      if (!name) return respondError("Give the commercial policy a name.", 400);
      if (!checked.ok) return respondError(checked.message, 422, "POLICY_VALIDATION_FAILED");
      const familyId = text(body.familyId, 100) || `POL-${randomUUID().slice(0, 8).toUpperCase()}`;
      const family = workspace.commercialPolicies.filter((item) => item.familyId === familyId);
      const version = family.reduce((highest, item) => Math.max(highest, Number(item.version) || 0), 0) + 1;
      const policy: WorkspaceRecord = {
        id: randomUUID(),
        familyId,
        name,
        version,
        status: "draft",
        paymentMilestones: checked.milestones,
        totalPercentage: checked.total,
        notes,
        createdAt: now,
        updatedAt: now,
        createdBy: "authenticated-admin",
        reviewRequirements: ["RR", "CA", "Legal"],
        releaseBlocked: true,
        releaseBlocker: checked.total === 100
          ? "External RR, CA and Legal approval evidence must be recorded through a role-secured approval workflow before use."
          : `Milestone percentages total ${checked.total}%; reconcile to exactly 100% before review.`,
      };
      nextWorkspace = { ...workspace, commercialPolicies: [...workspace.commercialPolicies, policy] };
      auditEvents.push({
        id: randomUUID(), occurredAt: now, actor: "admin-session", action: "commercial_policy.draft_created",
        entityType: "workspace", entityId: policy.id,
        after: { name, familyId, version, status: "draft", totalPercentage: checked.total },
        reason: "Draft only. It is not approved for quoting, invoicing, or project stage gates.",
      });
      nextWorkspace.auditEvents = auditEvents;
      const nextRevision = await saveOperationsWorkspace(nextWorkspace, snapshot.revision);
      return NextResponse.json({ saved: true, revision: nextRevision, policy }, { headers: { "Cache-Control": "no-store" } });
    }

    if (action === "approve-policy") {
      const policyId = text(body.policyId, 160);
      const documentId = text(body.approvalDocumentId, 160);
      const policyIndex = workspace.commercialPolicies.findIndex((item) => item.id === policyId);
      if (policyIndex < 0) return respondError("Commercial policy not found.", 404);
      const policy = workspace.commercialPolicies[policyIndex] as WorkspaceRecord;
      const nextReview: Record<string, { role: string; status: string }> = {
        awaiting_rr_approval: { role: "RR", status: "awaiting_ca_approval" },
        awaiting_ca_approval: { role: "CA", status: "awaiting_legal_approval" },
        awaiting_legal_approval: { role: "Legal", status: "approved" },
      };
      const review = nextReview[String(policy.status)];
      if (!review) return respondError("This policy is not waiting for an approval at this stage.", 409);
      const evidence = workspace.documents.find((item) =>
        item.id === documentId &&
        item.documentType === "policy_approval" &&
        item.policyId === policyId &&
        item.approvalRole === review.role &&
        item.status === "signed" &&
        typeof item.version === "number" && item.version > 0 &&
        typeof item.signedAt === "string" && Boolean(item.signedAt) &&
        typeof item.signatureEvidenceRef === "string" && Boolean(item.signatureEvidenceRef)
      );
      if (!evidence) return respondError(`Attach a signed PDF approval record for the ${review.role} review stage first.`, 422, "POLICY_APPROVAL_EVIDENCE_REQUIRED");
      const approvals = Array.isArray(policy.approvals) ? policy.approvals.filter(record) : [];
      if (approvals.some((item) => item.role === review.role)) {
        return respondError(`The ${review.role} approval is already recorded for this policy version. Create a new version to change the terms.`, 409);
      }
      const approval = {
        role: review.role,
        documentId,
        signedAt: evidence.signedAt,
        signatureEvidenceRef: evidence.signatureEvidenceRef,
        recordedAt: now,
        recordedBy: "authenticated-admin",
        limitation: "Approval evidence was uploaded by the administrator. The app does not independently verify the external signer identity or cryptographic signature.",
      };
      const nextStatus = review.status;
      const updatedPolicy: WorkspaceRecord = {
        ...policy,
        status: nextStatus,
        approvals: [...approvals, approval],
        updatedAt: now,
        releaseBlocked: nextStatus !== "approved",
        releaseBlocker: nextStatus === "approved" ? "" : `Waiting for ${nextStatus === "awaiting_ca_approval" ? "CA" : "Legal"} approval evidence.`,
        ...(nextStatus === "approved" ? { approvedAt: now } : {}),
      };
      const policies = workspace.commercialPolicies.map((item) => {
        if (nextStatus === "approved" && policy.familyId && item.familyId === policy.familyId &&
          item.id !== policyId && item.status === "approved") {
          auditEvents.push({
            id: randomUUID(), occurredAt: now, actor: "admin-session", action: "commercial_policy.version_superseded",
            entityType: "workspace", entityId: item.id,
            before: { status: "approved" },
            after: { status: "superseded", supersededByPolicyId: policyId },
            reason: "A newer version completed the final Legal evidence step. This historical version remains eligible only for receipts verified while it was approved.",
          });
          return { ...item, status: "superseded", supersededAt: now, updatedAt: now, releaseBlocked: true,
            releaseBlocker: `Superseded by approved policy version ${String(policy.version)}; retained for historical receipts.` };
        }
        return item;
      });
      policies[policyIndex] = updatedPolicy;
      nextWorkspace = { ...workspace, commercialPolicies: policies };
      auditEvents.push({
        id: randomUUID(), occurredAt: now, actor: "admin-session", action: "commercial_policy.approval_evidence_recorded",
        entityType: "workspace", entityId: policyId,
        before: { status: policy.status },
        after: { status: nextStatus, reviewerRole: review.role, approvalDocumentId: documentId },
        reason: "Status advanced only after a linked signed PDF approval record was present. Reviewer identity/signature are not independently authenticated by this app.",
      });
      nextWorkspace.auditEvents = auditEvents;
      const nextRevision = await saveOperationsWorkspace(nextWorkspace, snapshot.revision);
      return NextResponse.json({ saved: true, revision: nextRevision, policy: updatedPolicy }, { headers: { "Cache-Control": "no-store" } });
    }

    if (action === "submit-policy-for-review") {
      const policyId = text(body.policyId, 160);
      const index = workspace.commercialPolicies.findIndex((item) => item.id === policyId);
      if (index < 0) return respondError("Commercial policy draft not found.", 404);
      const existing = workspace.commercialPolicies[index] as WorkspaceRecord;
      if (existing.status !== "draft") return respondError("Only a draft can be submitted for review.", 409);
      const milestones = Array.isArray(existing.paymentMilestones) ? existing.paymentMilestones : [];
      const total = Number(existing.totalPercentage);
      if (Math.round(total * 100) !== 10000) return respondError("Milestone percentages must total exactly 100% before review.", 422, "POLICY_PERCENTAGE_TOTAL_INVALID");
      const nextPolicy: WorkspaceRecord = { ...existing, status: "awaiting_rr_approval", submittedAt: now, updatedAt: now, releaseBlocked: true,
        releaseBlocker: "Waiting for separately authenticated RR, CA and Legal approval evidence." };
      const policies = [...workspace.commercialPolicies];
      policies[index] = nextPolicy;
      nextWorkspace = { ...workspace, commercialPolicies: policies };
      auditEvents.push({ id: randomUUID(), occurredAt: now, actor: "admin-session", action: "commercial_policy.submitted_for_review",
        entityType: "workspace", entityId: policyId, before: { status: "draft" }, after: { status: "awaiting_rr_approval", milestoneCount: milestones.length },
        reason: "This requests review; it does not constitute any approval." });
      nextWorkspace.auditEvents = auditEvents;
      const nextRevision = await saveOperationsWorkspace(nextWorkspace, snapshot.revision);
      return NextResponse.json({ saved: true, revision: nextRevision, policy: nextPolicy }, { headers: { "Cache-Control": "no-store" } });
    }

    if (action === "confirm-site-address") {
      const propertyId = text(body.propertyId, 160);
      const addressText = text(body.addressText, 500);
      if (!propertyId || addressText.length < 8) return respondError("Enter the full site address to confirm.", 400);
      const properties = workspace.properties.map(asProperty);
      const index = properties.findIndex((property) => property.id === propertyId);
      if (index < 0) return respondError("Site record not found.", 404);
      const property = properties[index];
      if (property.addressVerificationStatus === "confirmed" && property.addressText.trim() !== addressText) {
        return respondError("A confirmed site address cannot be silently overwritten. Record a separate owner-reviewed change first.", 409, "ADDRESS_ALREADY_CONFIRMED");
      }
      const updated: OperationProperty = { ...property, addressText, addressVerificationStatus: "confirmed", updatedAt: now };
      properties[index] = updated;
      nextWorkspace = { ...workspace, properties: properties as unknown as WorkspaceRecord[] };
      auditEvents.push({ id: randomUUID(), occurredAt: now, actor: "admin-session", action: "property.address_confirmed",
        entityType: "property", entityId: property.id, before: { addressText: property.addressText, addressVerificationStatus: property.addressVerificationStatus },
        after: { addressText, addressVerificationStatus: "confirmed" },
        reason: "Confirmed by the signed-in administrator against the customer's agreed project/site details." });
      nextWorkspace.auditEvents = auditEvents;
      const nextRevision = await saveOperationsWorkspace(nextWorkspace, snapshot.revision);
      return NextResponse.json({ saved: true, revision: nextRevision, property: updated }, { headers: { "Cache-Control": "no-store" } });
    }

    if (action === "advance-project") {
      const projectId = text(body.projectId, 160);
      const target = text(body.targetMilestone, 40);
      const projects = workspace.projects.map(asProject);
      const projectIndex = projects.findIndex((project) => project.id === projectId);
      if (projectIndex < 0) return respondError("Project record not found.", 404);
      const project = projects[projectIndex];
      const order = ["production_preflight", "production", "execution", "handover", "warranty"];
      const currentIndex = order.indexOf(project.currentMilestone);
      if (currentIndex < 0 || target !== order[currentIndex + 1]) {
        return respondError("Projects must move one milestone at a time; backwards or skipped transitions are not allowed.", 409, "INVALID_MILESTONE_TRANSITION");
      }
      if (project.operationalStatus === "cancelled" || project.operationalStatus === "completed") {
        return respondError("A cancelled or completed project cannot advance.", 409);
      }
      const property = workspace.properties.map(asProperty).find((item) => item.id === project.propertyId);
      const lead = workspace.leads.find((item) => item.id === project.sourceOpportunityId);
      const documents = workspace.documents;
      const missing: string[] = [];
      if (currentIndex === 0) {
        if (!property || property.addressVerificationStatus !== "confirmed") missing.push("confirmed site address");
        const signedContract = lead?.signedContractDocumentId
          ? documents.find((document) => {
              const type = String(document.documentType || "").toLowerCase().replaceAll("_", "-");
              return document.id === lead.signedContractDocumentId &&
                ["works-contract", "final-contract"].includes(type) &&
                document.status === "signed" &&
                document.leadId === lead.id &&
                (document.customerId || document.clientId) === lead.clientId &&
                typeof document.version === "number" && document.version > 0 &&
                typeof document.signedAt === "string" && Boolean(document.signedAt) &&
                typeof document.signatureEvidenceRef === "string" && Boolean(document.signatureEvidenceRef);
            })
          : undefined;
        if (!signedContract) missing.push("linked signed contract with matching customer, opportunity, version and signature evidence");
        for (const type of ["approved_quotation", "signed_design_approval", "production_specification", "production_qc"]) {
          if (!docHas(documents, type, project.id, project.sourceOpportunityId)) missing.push(type.replaceAll("_", " "));
        }
        const leadReceipt = workspace.invoices.find((item) => item.id === lead?.verifiedAdvanceTransactionId);
        if (!leadReceipt || leadReceipt.type !== "Cash receipt" ||
          leadReceipt.leadId !== lead?.id || leadReceipt.clientId !== lead?.clientId ||
          (leadReceipt as WorkspaceRecord).paymentVerificationStatus !== "verified" ||
          !String((leadReceipt as WorkspaceRecord).paymentVerificationReference || "").trim() ||
          !String((leadReceipt as WorkspaceRecord).paymentVerifiedAt || "").trim() ||
          Number(leadReceipt.amount) <= 0 || Number(leadReceipt.paid) !== Number(leadReceipt.amount) ||
          !isApprovedBookingAdvanceReceipt(leadReceipt as never, workspace.commercialPolicies as never)) {
          missing.push("advance receipt linked to this customer/opportunity and a versioned approved payment policy");
        }
      } else if (currentIndex === 1) {
        if (!docHas(documents, "production_completion", project.id, project.sourceOpportunityId)) missing.push("production completion / quality-release record");
      } else if (currentIndex === 2) {
        if (!docHas(documents, "installation_signoff", project.id, project.sourceOpportunityId)) missing.push("installation sign-off");
      } else if (currentIndex === 3) {
        if (!docHas(documents, "handover_acceptance", project.id, project.sourceOpportunityId)) missing.push("customer handover acceptance");
        if (!docHas(documents, "warranty_certificate", project.id, project.sourceOpportunityId)) missing.push("warranty certificate based on an approved warranty master");
        if (!docHas(documents, "project_closure", project.id, project.sourceOpportunityId)) missing.push("project closure record with final account / outstanding actions reviewed");
      }
      if (missing.length) return respondError(`Milestone blocked. Missing requirements: ${missing.join(", ")}.`, 422, "PROJECT_MILESTONE_BLOCKED");
      const updated: OperationProject = {
        ...project,
        currentMilestone: target as OperationProject["currentMilestone"],
        operationalStatus: target === "warranty" ? "completed" : "active",
        blockers: [],
        updatedAt: now,
      };
      projects[projectIndex] = updated;
      nextWorkspace = { ...workspace, projects: projects as unknown as WorkspaceRecord[] };
      auditEvents.push({ id: randomUUID(), occurredAt: now, actor: "admin-session", action: "project.milestone_advanced",
        entityType: "project", entityId: project.id,
        before: { currentMilestone: project.currentMilestone, operationalStatus: project.operationalStatus, blockers: project.blockers },
        after: { currentMilestone: updated.currentMilestone, operationalStatus: updated.operationalStatus, blockers: [] },
        reason: "Required evidence records were present in the workspace when this transition was checked." });
      nextWorkspace.auditEvents = auditEvents;
      const nextRevision = await saveOperationsWorkspace(nextWorkspace, snapshot.revision);
      return NextResponse.json({ saved: true, revision: nextRevision, project: updated }, { headers: { "Cache-Control": "no-store" } });
    }

    return respondError("Unknown operations action.", 400);
  } catch (error) {
    if (error instanceof WorkspaceConflictError) return respondError(error.message, 409, "WORKSPACE_CONFLICT");
    return respondError(error instanceof Error ? error.message : "Operations update failed.", 503);
  }
}
