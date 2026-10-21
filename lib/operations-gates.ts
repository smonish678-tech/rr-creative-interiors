/**
 * Server-side operations invariants shared by admin API routes.
 *
 * Keep this module free of Next.js and storage imports so its rules can be
 * exercised with Node's built-in test runner.
 */

export type OperationStage = {
  id: string;
  name: string;
  kind: string;
  active?: boolean;
  requiredFields?: string[];
  isInitial?: boolean;
};

export type OperationLead = Record<string, unknown> & {
  id: string;
  clientId?: string;
  stageId?: string;
  status?: string;
  agreementStatus?: string;
  advanceStatus?: string;
  advanceExceptionReason?: string;
  signedContractDocumentId?: string;
  verifiedAdvanceTransactionId?: string;
};

export type OperationCustomer = Record<string, unknown> & {
  id: string;
};

export type OperationDocument = Record<string, unknown> & {
  id: string;
  documentType?: string;
  status?: string;
  customerId?: string;
  clientId?: string;
  leadId?: string;
  version?: number;
  signedAt?: string;
  signatureEvidenceRef?: string;
};

export type FinanceDocument = Record<string, unknown> & {
  id: string;
  type: "Invoice" | "Cash receipt";
  clientId?: string;
  leadId?: string;
  appliesToInvoiceId?: string;
  amount: number;
  tax: number;
  paid: number;
  status: string;
};

export type OperationCommercialPolicy = Record<string, unknown> & {
  id: string;
  version: number;
  status: "draft" | "awaiting_rr_approval" | "awaiting_ca_approval" | "awaiting_legal_approval" | "approved" | "superseded";
  paymentMilestones?: Array<Record<string, unknown>>;
};

export type OperationProperty = {
  id: string;
  customerId: string;
  sourceOpportunityId: string;
  displayName: string;
  addressText: string;
  addressVerificationStatus: "needs_confirmation" | "confirmed";
  createdAt: string;
  updatedAt: string;
};

export type OperationProject = {
  id: string;
  reference: string;
  customerId: string;
  propertyId: string;
  sourceOpportunityId: string;
  currentMilestone: "production_preflight" | "production" | "execution" | "handover" | "warranty";
  operationalStatus: "blocked" | "active" | "completed" | "cancelled";
  blockers: string[];
  createdAt: string;
  updatedAt: string;
};

export type OperationAuditEvent = {
  id: string;
  occurredAt: string;
  actor: "admin-session";
  action: string;
  entityType: "customer" | "lead" | "project" | "property" | "invoice" | "receipt" | "payment" | "workspace";
  entityId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  amountCents?: number;
  reason?: string;
};

const value = (record: Record<string, unknown>, key: string): string =>
  typeof record[key] === "string" ? (record[key] as string).trim() : "";

const moneyCents = (input: unknown): number => {
  const numeric = typeof input === "number" ? input : Number(input);
  return Number.isFinite(numeric) ? Math.round((numeric + Number.EPSILON) * 100) : Number.NaN;
};

const invoiceTotalCents = (document: FinanceDocument): number => {
  const amountCents = moneyCents(document.amount);
  const tax = Number(document.tax);
  if (!Number.isFinite(amountCents) || !Number.isFinite(tax) || tax < 0) return Number.NaN;
  return Math.round(amountCents * (1 + tax / 100));
};

function stageForLead(lead: OperationLead | undefined, stages: OperationStage[]): OperationStage | undefined {
  if (!lead) return undefined;
  return stages.find((stage) => stage.id === value(lead, "stageId")) ||
    stages.find((stage) => stage.name === value(lead, "status"));
}

function isAcceptedSaleStage(stage: OperationStage | undefined): boolean {
  return stage?.kind === "won";
}

function fieldMissing(lead: OperationLead, field: string): boolean {
  switch (field) {
    case "name": return !value(lead, "name");
    case "contact": return !value(lead, "phone") && !value(lead, "email");
    case "project": return !value(lead, "project");
    case "serviceType": return !value(lead, "serviceType");
    case "location": return !value(lead, "location");
    case "area": return !value(lead, "area");
    case "budget": return !value(lead, "budget");
    case "timeline": return !value(lead, "timeline");
    case "nextAction": return !value(lead, "nextAction");
    case "email": return !value(lead, "email");
    case "phone": return !value(lead, "phone");
    case "notes": return !value(lead, "notes");
    case "lostReason": return !value(lead, "lostReason");
    case "agreementSigned": return value(lead, "agreementStatus") !== "signed";
    case "advanceConfirmed":
      return value(lead, "advanceStatus") !== "received" &&
        !(value(lead, "advanceStatus") === "waived" && Boolean(value(lead, "advanceExceptionReason")));
    case "signedContractEvidence": return !value(lead, "signedContractDocumentId");
    case "verifiedAdvanceEvidence": return !value(lead, "verifiedAdvanceTransactionId");
    case "clientId": return !value(lead, "clientId");
    default: return false;
  }
}

function signedContractEvidenceExists(lead: OperationLead, documents: OperationDocument[]): boolean {
  const id = value(lead, "signedContractDocumentId");
  if (!id) return false;
  return documents.some((document) => {
    const type = value(document, "documentType").toLowerCase().replaceAll("_", "-");
    return document.id === id &&
      ["works-contract", "final-contract"].includes(type) &&
      document.status === "signed" &&
      (document.customerId || document.clientId) === lead.clientId &&
      document.leadId === lead.id &&
      typeof document.version === "number" && document.version > 0 &&
      Boolean(value(document, "signedAt")) &&
      Boolean(value(document, "signatureEvidenceRef"));
  });
}

export function isApprovedBookingAdvanceReceipt(
  document: FinanceDocument,
  policies: OperationCommercialPolicy[],
): boolean {
  if (document.type !== "Cash receipt" || value(document, "paymentPurpose") !== "booking_advance") return false;
  const policyId = value(document, "paymentPolicyId");
  const milestoneId = value(document, "paymentMilestoneId");
  const version = Number(document.paymentPolicyVersion);
  if (!policyId || !milestoneId || !Number.isInteger(version) || version < 1) return false;
  const policy = policies.find((item) => item.id === policyId && item.version === version && item.status === "approved");
  if (!policy || !Array.isArray(policy.paymentMilestones)) return false;
  return policy.paymentMilestones.some((milestone) =>
    value(milestone, "id") === milestoneId &&
    value(milestone, "purpose") === "booking_advance" &&
    milestone.active !== false
  );
}

function verifiedAdvanceEvidenceExists(
  lead: OperationLead,
  financeDocuments: FinanceDocument[],
  commercialPolicies: OperationCommercialPolicy[],
): boolean {
  const id = value(lead, "verifiedAdvanceTransactionId");
  if (!id) return false;
  return financeDocuments.some((document) =>
    document.id === id &&
    document.type === "Cash receipt" &&
    document.clientId === lead.clientId &&
    document.leadId === lead.id &&
    isApprovedBookingAdvanceReceipt(document, commercialPolicies) &&
    value(document, "paymentVerificationStatus") === "verified" &&
    Boolean(value(document, "paymentVerificationReference")) &&
    Boolean(value(document, "paymentVerifiedAt")) &&
    moneyCents(document.amount) > 0 &&
    moneyCents(document.paid) === moneyCents(document.amount)
  );
}

/** Reject invalid stage changes at the server boundary, not only in UI controls. */
export function validateLeadStageTransitions(input: {
  previousLeads: OperationLead[];
  nextLeads: OperationLead[];
  stages: OperationStage[];
  customers: OperationCustomer[];
  documents: OperationDocument[];
  financeDocuments: FinanceDocument[];
  commercialPolicies: OperationCommercialPolicy[];
}): string | null {
  const nextIds = new Set<string>();
  for (const lead of input.nextLeads) {
    if (!value(lead, "id")) return "Every lead must have a stable ID.";
    if (nextIds.has(lead.id)) return `Duplicate lead ID “${lead.id}” is not allowed.`;
    nextIds.add(lead.id);
  }

  const previousById = new Map(input.previousLeads.map((lead) => [lead.id, lead]));
  const customerIds = new Set(input.customers.map((customer) => customer.id));
  for (const lead of input.nextLeads) {
    const previous = previousById.get(lead.id);
    const previousStage = stageForLead(previous, input.stages);
    const nextStage = stageForLead(lead, input.stages);
    const changedStage = !previous || previousStage?.id !== nextStage?.id;

    if (value(lead, "clientId") && !customerIds.has(value(lead, "clientId"))) {
      return `Lead “${lead.id}” links to a customer record that does not exist.`;
    }
    if (!changedStage) continue;
    if (!nextStage) return `Choose a recognised sales stage for lead “${lead.id}” before saving.`;
    if (nextStage.active === false) return `Lead “${lead.id}” cannot move into the inactive stage “${nextStage.name}”.`;

    const required = new Set(nextStage.requiredFields || []);
    if (nextStage.kind === "won") {
      ["agreementSigned", "advanceConfirmed", "signedContractEvidence", "verifiedAdvanceEvidence", "clientId", "location"].forEach((field) => required.add(field));
    } else if (nextStage.kind === "lost" || nextStage.kind === "disqualified") {
      required.add("lostReason");
    }

    const missing = [...required].filter((field) => fieldMissing(lead, field));
    if (missing.length) {
      const labels: Record<string, string> = {
        agreementSigned: "signed agreement",
        advanceConfirmed: "verified/authorised advance",
        signedContractEvidence: "signed contract version and signature evidence",
        verifiedAdvanceEvidence: "bank-verified advance receipt and reference",
        clientId: "linked customer record",
        location: "property/site location",
        lostReason: "loss/disqualification reason",
      };
      const fields = missing.map((field) => labels[field] || field).join(", ");
      return `Cannot move lead “${lead.id}” to “${nextStage.name}”. Complete: ${fields}.`;
    }
    if (nextStage.kind === "won") {
      if (!signedContractEvidenceExists(lead, input.documents)) {
        return `Cannot activate a project from lead “${lead.id}”: the linked contract is not a signed, versioned document with signature evidence for this customer and opportunity.`;
      }
      if (!verifiedAdvanceEvidenceExists(lead, input.financeDocuments, input.commercialPolicies)) {
        return `Cannot activate a project from lead “${lead.id}”: link a bank-verified advance receipt with its reference and verification timestamp.`;
      }
    }
  }
  return null;
}

/** Validate changes to the legacy invoice/receipt array before writing it back. */
export function validateFinanceDocumentChanges(
  previous: FinanceDocument[],
  next: FinanceDocument[],
  options: { allowVerifiedReceiptTransition?: boolean } = {},
): string | null {
  const previousById = new Map(previous.map((document) => [document.id, document]));
  const nextById = new Map<string, FinanceDocument>();

  for (const document of next) {
    if (!value(document, "id")) return "Every financial document must have a stable ID.";
    if (nextById.has(document.id)) return `Duplicate financial document ID “${document.id}” is not allowed.`;
    nextById.set(document.id, document);
    const amount = moneyCents(document.amount);
    const paid = moneyCents(document.paid);
    const tax = Number(document.tax);
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(paid) || paid < 0 || !Number.isFinite(tax) || tax < 0) {
      return `Financial document “${document.id}” has an invalid amount, tax or received value.`;
    }
    if (document.type === "Cash receipt" && (tax !== 0 || paid !== amount)) {
      return `Cash receipt “${document.id}” must have zero tax and its received amount must equal its receipt amount.`;
    }
  }

  for (const prior of previous) {
    const current = nextById.get(prior.id);
    if (!current) return `Issued financial document “${prior.id}” cannot be deleted from the operations history.`;
    const immutableFields = ["type", "client", "email", "phone", "project", "date", "due", "description", "amount", "tax"];
    for (const field of immutableFields) {
      if (prior[field] !== undefined && prior[field] !== null && prior[field] !== "" && prior[field] !== current[field]) {
        return `Financial document “${prior.id}” is historical. Its ${field} field cannot be rewritten; create a correction/credit note workflow instead.`;
      }
    }
    for (const field of ["clientId", "leadId", "appliesToInvoiceId"]) {
      if (prior[field] && prior[field] !== current[field]) {
        return `Financial document “${prior.id}” cannot be relinked to a different customer, opportunity or invoice.`;
      }
    }
    const verifiedReceiptTransition = options.allowVerifiedReceiptTransition === true &&
      prior.type === "Cash receipt" && current.type === "Cash receipt" &&
      value(prior, "paymentVerificationStatus") === "awaiting_verification" &&
      value(current, "paymentVerificationStatus") === "verified" &&
      !value(prior, "paymentVerificationReference") && Boolean(value(current, "paymentVerificationReference")) &&
      !value(prior, "paymentVerifiedAt") && Boolean(value(current, "paymentVerifiedAt")) &&
      !value(prior, "paymentVerifiedBy") && Boolean(value(current, "paymentVerifiedBy"));
    for (const field of ["paymentVerificationStatus", "paymentVerificationReference", "paymentVerifiedAt", "paymentVerifiedBy", "paymentVerificationNotes"]) {
      if (prior[field] !== current[field] && !verifiedReceiptTransition) {
        return `Payment verification fields on “${prior.id}” can only be changed through the audited verification workflow.`;
      }
    }
  }

  for (const document of next) {
    const prior = previousById.get(document.id);
    if (document.type === "Cash receipt" && !prior) {
      if (document.paymentVerificationStatus !== undefined && document.paymentVerificationStatus !== "awaiting_verification") {
        return `New cash receipt “${document.id}” must begin in Awaiting verification.`;
      }
      if (document.appliesToInvoiceId) {
        const invoice = nextById.get(document.appliesToInvoiceId);
        if (!invoice || invoice.type !== "Invoice") return `Cash receipt “${document.id}” links to an invoice that does not exist.`;
        if (invoice.clientId && document.clientId && invoice.clientId !== document.clientId) return `Cash receipt “${document.id}” belongs to a different customer than invoice “${invoice.id}”.`;
        if (invoice.leadId && document.leadId && invoice.leadId !== document.leadId) return `Cash receipt “${document.id}” belongs to a different opportunity than invoice “${invoice.id}”.`;
        if (value(invoice, "project").toLocaleLowerCase() !== value(document, "project").toLocaleLowerCase()) return `Cash receipt “${document.id}” does not match the linked invoice project.`;
      }
    }
  }

  for (const invoice of next.filter((document) => document.type === "Invoice")) {
    const prior = previousById.get(invoice.id);
    const oldPaid = prior ? moneyCents(prior.paid) : 0;
    const newPaid = moneyCents(invoice.paid);
    if (newPaid < oldPaid) return `Received amount on invoice “${invoice.id}” cannot decrease. Use an authorised adjustment/credit-note workflow.`;
    const allocationDelta = newPaid - oldPaid;
    const newlyVerifiedReceipts = next.filter((document) => {
      if (document.type !== "Cash receipt" || document.appliesToInvoiceId !== invoice.id ||
        value(document, "paymentVerificationStatus") !== "verified") return false;
      const earlier = previousById.get(document.id);
      return !earlier || value(earlier, "paymentVerificationStatus") !== "verified";
    });
    const allocatedCents = newlyVerifiedReceipts.reduce((sum, document) => sum + moneyCents(document.amount), 0);

    if (allocationDelta !== allocatedCents) {
      return `Invoice “${invoice.id}” received amount must change by exactly the value of receipts newly verified against it; expected ₹${(allocationDelta / 100).toFixed(2)} in newly verified receipts, found ₹${(allocatedCents / 100).toFixed(2)}.`;
    }
    const totalCents = invoiceTotalCents(invoice);
    if (newPaid > totalCents) return `Invoice “${invoice.id}” cannot have receipts allocated beyond its total.`;
    const pendingAllocations = next
      .filter((document) => document.type === "Cash receipt" &&
        document.appliesToInvoiceId === invoice.id &&
        value(document, "paymentVerificationStatus") === "awaiting_verification")
      .reduce((sum, document) => sum + moneyCents(document.amount), 0);
    if (newPaid + pendingAllocations > totalCents) {
      return `Invoice “${invoice.id}” has pending receipts that exceed its remaining balance. Review the pending receipts before adding another allocation.`;
    }
  }
  return null;
}

function safeId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 110) || "unknown";
}

/** Create at most one project and one site record for each newly accepted opportunity. */
export function materializeAcceptedProjects(input: {
  previousLeads: OperationLead[];
  nextLeads: OperationLead[];
  stages: OperationStage[];
  customers: OperationCustomer[];
  existingProjects: OperationProject[];
  existingProperties: OperationProperty[];
  now: string;
}): { ok: true; projects: OperationProject[]; properties: OperationProperty[]; createdProjects: OperationProject[] } |
   { ok: false; message: string } {
  const projectByOpportunity = new Map<string, OperationProject>();
  const projectIds = new Set<string>();
  for (const project of input.existingProjects) {
    if (projectIds.has(project.id)) return { ok: false, message: `Duplicate project ID “${project.id}” must be reconciled before continuing.` };
    projectIds.add(project.id);
    if (projectByOpportunity.has(project.sourceOpportunityId)) return { ok: false, message: `More than one project is linked to opportunity “${project.sourceOpportunityId}”. Manual reconciliation is required.` };
    projectByOpportunity.set(project.sourceOpportunityId, project);
  }

  const propertyByOpportunity = new Map<string, OperationProperty>();
  const propertyIds = new Set<string>();
  for (const property of input.existingProperties) {
    if (propertyIds.has(property.id)) return { ok: false, message: `Duplicate property/site ID “${property.id}” must be reconciled before continuing.` };
    propertyIds.add(property.id);
    if (propertyByOpportunity.has(property.sourceOpportunityId)) return { ok: false, message: `More than one property/site is linked to opportunity “${property.sourceOpportunityId}”. Manual reconciliation is required.` };
    propertyByOpportunity.set(property.sourceOpportunityId, property);
  }

  const previousById = new Map(input.previousLeads.map((lead) => [lead.id, lead]));
  const customersById = new Map(input.customers.map((customer) => [customer.id, customer]));
  const projects = [...input.existingProjects];
  const properties = [...input.existingProperties];
  const createdProjects: OperationProject[] = [];

  for (const lead of input.nextLeads) {
    const oldLead = previousById.get(lead.id);
    const oldStage = stageForLead(oldLead, input.stages);
    const newStage = stageForLead(lead, input.stages);
    if (!isAcceptedSaleStage(newStage) || isAcceptedSaleStage(oldStage)) continue;
    if (projectByOpportunity.has(lead.id)) continue;

    const customerId = value(lead, "clientId");
    const customer = customersById.get(customerId);
    if (!customer) return { ok: false, message: `Accepted opportunity “${lead.id}” has no canonical customer record; it cannot be converted into a project.` };

    const siteId = `SITE-${safeId(lead.id)}`;
    let property = propertyByOpportunity.get(lead.id);
    if (!property) {
      if (propertyIds.has(siteId)) return { ok: false, message: `Site ID “${siteId}” is already used by another record; manual reconciliation is required.` };
      property = {
        id: siteId,
        customerId,
        sourceOpportunityId: lead.id,
        displayName: value(lead, "project") || "Project site",
        addressText: value(lead, "location"),
        addressVerificationStatus: "needs_confirmation",
        createdAt: input.now,
        updatedAt: input.now,
      };
      properties.push(property);
      propertyByOpportunity.set(lead.id, property);
      propertyIds.add(siteId);
    } else if (property.customerId !== customerId) {
      return { ok: false, message: `The site for opportunity “${lead.id}” is linked to a different customer. Manual reconciliation is required.` };
    }

    const projectId = `PRJ-${safeId(lead.id)}`;
    if (projectIds.has(projectId)) return { ok: false, message: `Project ID “${projectId}” is already in use. Manual reconciliation is required.` };
    const project: OperationProject = {
      id: projectId,
      reference: `RR-PRJ-${safeId(lead.id).slice(-32).toUpperCase()}`,
      customerId,
      propertyId: property.id,
      sourceOpportunityId: lead.id,
      currentMilestone: "production_preflight",
      operationalStatus: "blocked",
      blockers: [
        "Final quotation version and signed design approval must be linked before production release.",
        "Production specification and quality-check requirements must be confirmed before manufacturing."
      ],
      createdAt: input.now,
      updatedAt: input.now,
    };
    projects.push(project);
    createdProjects.push(project);
    projectByOpportunity.set(lead.id, project);
    projectIds.add(projectId);
  }
  return { ok: true, projects, properties, createdProjects };
}

/** Create server-owned audit entries from the accepted state change; clients cannot supply them. */
export function deriveOperationsAuditEvents(input: {
  previousCustomers: OperationCustomer[];
  nextCustomers: OperationCustomer[];
  previousLeads: OperationLead[];
  nextLeads: OperationLead[];
  previousFinanceDocuments: FinanceDocument[];
  nextFinanceDocuments: FinanceDocument[];
  createdProjects: OperationProject[];
  now: string;
  newId: () => string;
}): OperationAuditEvent[] {
  const events: OperationAuditEvent[] = [];
  const append = (action: string, entityType: OperationAuditEvent["entityType"], entityId: string, details: Partial<OperationAuditEvent> = {}) => {
    events.push({ id: input.newId(), occurredAt: input.now, actor: "admin-session", action, entityType, entityId, ...details });
  };
  const priorCustomers = new Set(input.previousCustomers.map((customer) => customer.id));
  for (const customer of input.nextCustomers) {
    if (!priorCustomers.has(customer.id)) append("customer.created", "customer", customer.id, { after: { name: value(customer, "name") } });
  }

  const priorLeads = new Map(input.previousLeads.map((lead) => [lead.id, lead]));
  for (const lead of input.nextLeads) {
    const prior = priorLeads.get(lead.id);
    if (!prior) {
      append("lead.created", "lead", lead.id, { after: { clientId: value(lead, "clientId"), status: value(lead, "status"), stageId: value(lead, "stageId") } });
    } else if (value(prior, "stageId") !== value(lead, "stageId") || value(prior, "status") !== value(lead, "status")) {
      append("lead.stage_changed", "lead", lead.id, {
        before: { status: value(prior, "status"), stageId: value(prior, "stageId") },
        after: { status: value(lead, "status"), stageId: value(lead, "stageId") },
      });
    }
  }

  const priorFinance = new Map(input.previousFinanceDocuments.map((document) => [document.id, document]));
  for (const document of input.nextFinanceDocuments) {
    const prior = priorFinance.get(document.id);
    if (!prior) {
      if (document.type === "Cash receipt") {
        append("receipt.recorded_awaiting_verification", "receipt", document.id, {
          after: { clientId: value(document, "clientId"), leadId: value(document, "leadId"), appliesToInvoiceId: value(document, "appliesToInvoiceId"), verificationStatus: "awaiting_verification" },
          amountCents: moneyCents(document.amount),
          reason: "Recorded by an authenticated admin; this event is not proof of bank settlement.",
        });
      } else {
        append("invoice.created", "invoice", document.id, {
          after: { clientId: value(document, "clientId"), leadId: value(document, "leadId"), project: value(document, "project") },
          amountCents: invoiceTotalCents(document),
        });
      }
    } else if (document.type === "Invoice" && moneyCents(document.paid) > moneyCents(prior.paid)) {
      append("payment.allocation_recorded", "payment", document.id, {
        before: { paidCents: moneyCents(prior.paid) },
        after: { paidCents: moneyCents(document.paid) },
        amountCents: moneyCents(document.paid) - moneyCents(prior.paid),
        reason: "Allocation is supported by newly recorded receipt document(s); bank verification is tracked separately.",
      });
    }
  }

  for (const project of input.createdProjects) {
    append("project.created_blocked_at_preproduction", "project", project.id, {
      after: { customerId: project.customerId, propertyId: project.propertyId, sourceOpportunityId: project.sourceOpportunityId, currentMilestone: project.currentMilestone, operationalStatus: project.operationalStatus, blockers: project.blockers },
    });
  }
  return events;
}
