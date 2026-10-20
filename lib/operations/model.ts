/**
 * RR Creative Interiors — canonical operations domain model.
 *
 * These types are the single vocabulary used by CRM, projects, documents,
 * payments, approvals, tasks, production, handover and warranty.
 * Persistence adapters must preserve the invariants in this module.
 */

export const LEAD_STAGES = [
  "new_enquiry",
  "contacted",
  "site_visit",
  "proposal_sent",
  "negotiation",
  "won",
  "lost",
] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

export const PROJECT_STAGES = [
  "booking",
  "design",
  "design_approval",
  "contract",
  "production_ready",
  "production",
  "quality_check",
  "dispatch",
  "installation",
  "handover",
  "warranty",
  "closed",
  "on_hold",
  "cancelled",
] as const;
export type ProjectStage = (typeof PROJECT_STAGES)[number];

export type RecordBase = {
  id: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  version: number;
};

export type Customer = RecordBase & {
  displayName: string;
  normalizedName: string;
  primaryEmail: string | null;
  normalizedEmail: string | null;
  primaryPhone: string | null;
  normalizedPhone: string | null;
  communicationPreference: "whatsapp" | "email" | "phone" | "none";
  consentAt: string | null;
  notes: string;
  archivedAt: string | null;
};

export type Contact = RecordBase & {
  customerId: string;
  name: string;
  role: "owner" | "spouse" | "family" | "representative" | "site_contact" | "other";
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
  canApprove: boolean;
  canReceiveFinanceDocuments: boolean;
};

export type Project = RecordBase & {
  customerId: string;
  projectCode: string;
  name: string;
  projectType: "residential" | "commercial" | "renovation" | "other";
  address: string;
  apartment: string;
  floor: string;
  possessionDate: string | null;
  siteReady: boolean | null;
  leadId: string | null;
  stage: ProjectStage;
  ownerId: string;
  designerId: string | null;
  estimatedBudgetMinor: number | null;
  currency: "INR";
  targetStartDate: string | null;
  committedHandoverDate: string | null;
  deliveryClockStartedAt: string | null;
  deliveryClockPausedAt: string | null;
  holdReason: string | null;
  closedAt: string | null;
};

export type QuoteLine = {
  id: string;
  room: string;
  description: string;
  quantity: number;
  unit: string;
  unitPriceMinor: number;
  taxCode: string;
  taxRateBps: number;
  included: boolean;
};

export type Quote = RecordBase & {
  projectId: string;
  quoteNumber: string;
  revision: number;
  status: "draft" | "validation_failed" | "issued" | "accepted" | "superseded" | "rejected" | "expired";
  lines: QuoteLine[];
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
  currency: "INR";
  validUntil: string | null;
  paymentPolicyVersionId: string | null;
  exclusions: string[];
  assumptions: string[];
  issuedAt: string | null;
  acceptedAt: string | null;
  supersedesQuoteId: string | null;
  documentId: string | null;
};

export type PaymentMilestone = RecordBase & {
  projectId: string;
  quoteId: string;
  label: string;
  sequence: number;
  amountMinor: number;
  dueAt: string | null;
  trigger: "booking" | "design_signoff" | "production_release" | "dispatch" | "handover" | "custom";
  status: "not_due" | "due" | "partially_paid" | "paid" | "waived" | "disputed";
  waivedReason: string | null;
};

export type Transaction = RecordBase & {
  projectId: string;
  milestoneId: string | null;
  direction: "in" | "out";
  kind: "customer_payment" | "refund" | "supplier_payment" | "adjustment";
  amountMinor: number;
  currency: "INR";
  method: "upi" | "bank_transfer" | "cash" | "cheque" | "gateway" | "other";
  reference: string | null;
  evidenceDocumentId: string | null;
  verification: "unverified" | "verified" | "rejected";
  verifiedBy: string | null;
  verifiedAt: string | null;
  idempotencyKey: string;
  notes: string;
};

export type DocumentKind =
  | "initial_quote"
  | "booking_form"
  | "advance_receipt"
  | "design_approval"
  | "final_quote"
  | "works_contract"
  | "change_order"
  | "payment_request"
  | "payment_receipt"
  | "tax_invoice"
  | "handover_pack"
  | "warranty_certificate"
  | "other";

export type ProjectDocument = RecordBase & {
  projectId: string;
  customerId: string;
  kind: DocumentKind;
  documentNumber: string;
  version: number;
  status: "draft" | "issued" | "sent" | "viewed" | "signed" | "superseded" | "void";
  title: string;
  storagePath: string | null;
  sha256: string | null;
  mimeType: string;
  sourceSnapshot: Record<string, unknown>;
  issuedAt: string | null;
  signedAt: string | null;
  supersedesDocumentId: string | null;
};

export type Approval = RecordBase & {
  projectId: string;
  documentId: string;
  approverContactId: string | null;
  approverName: string;
  status: "pending" | "approved" | "changes_requested" | "declined" | "expired";
  decision: string | null;
  requestedAt: string;
  decidedAt: string | null;
  evidenceDocumentId: string | null;
  tokenHash: string | null;
};

export type Task = RecordBase & {
  projectId: string | null;
  customerId: string | null;
  title: string;
  description: string;
  ownerId: string | null;
  dueAt: string | null;
  status: "open" | "in_progress" | "blocked" | "done" | "cancelled";
  priority: "low" | "normal" | "high" | "urgent";
  blockedReason: string | null;
  completedAt: string | null;
  dedupeKey: string | null;
};

export type DomainEvent = RecordBase & {
  eventType: string;
  aggregateType: "customer" | "lead" | "project" | "quote" | "payment" | "document" | "approval" | "task" | "warranty";
  aggregateId: string;
  actorId: string;
  occurredAt: string;
  idempotencyKey: string;
  payload: Record<string, unknown>;
  deliveryState: "pending" | "processing" | "delivered" | "retry" | "dead_letter";
  attemptCount: number;
  nextAttemptAt: string | null;
  lastError: string | null;
};

export type ProductionChecklistItem = RecordBase & {
  projectId: string;
  phase: "procurement" | "production" | "quality" | "dispatch" | "site_readiness" | "installation" | "snag" | "handover";
  itemKey: string;
  label: string;
  required: boolean;
  status: "pending" | "passed" | "failed" | "not_applicable";
  evidenceDocumentId: string | null;
  checkedBy: string | null;
  checkedAt: string | null;
  notes: string;
};

export type Warranty = RecordBase & {
  projectId: string;
  customerId: string;
  certificateDocumentId: string | null;
  invoiceDocumentId: string | null;
  joineryStartDate: string | null;
  joineryEndDate: string | null;
  policyVersion: string;
  status: "draft" | "active" | "expired" | "void";
  coverageSnapshot: Array<{ category: string; durationMonths: number | null; terms: string }>;
};

export type WarrantyClaim = RecordBase & {
  warrantyId: string;
  projectId: string;
  customerId: string;
  claimNumber: string;
  description: string;
  category: string;
  reportedAt: string;
  status: "received" | "triage" | "inspection" | "approved" | "rejected" | "scheduled" | "resolved" | "closed";
  ownerId: string | null;
  nextActionAt: string | null;
  resolution: string | null;
};

export type MessageJob = RecordBase & {
  projectId: string | null;
  customerId: string;
  channel: "whatsapp_manual" | "email" | "whatsapp_api";
  templateKey: string;
  recipient: string;
  renderedSubject: string | null;
  renderedBody: string;
  status: "draft" | "queued" | "sent" | "failed" | "cancelled";
  idempotencyKey: string;
  attemptCount: number;
  lastAttemptAt: string | null;
  sentAt: string | null;
  providerMessageId: string | null;
  lastError: string | null;
};

export type OperationsRecord =
  | Customer | Contact | Project | Quote | PaymentMilestone | Transaction
  | ProjectDocument | Approval | Task | DomainEvent | ProductionChecklistItem
  | Warranty | WarrantyClaim | MessageJob;

export type GateResult = { allowed: true; missing: [] } | { allowed: false; missing: string[] };

export function checkGate(stage: ProjectStage, facts: {
  acceptedQuote?: boolean;
  bookingSigned?: boolean;
  bookingPaymentVerified?: boolean;
  designDocumentReady?: boolean;\n  designApproved?: boolean;
  finalQuoteAccepted?: boolean;
  worksContractSigned?: boolean;
  productionMilestonesVerified?: boolean;
  requiredProcurementComplete?: boolean;\n  requiredProductionComplete?: boolean;
  qualityPassed?: boolean;
  dispatchPaymentVerified?: boolean;
  siteReady?: boolean;
  installationComplete?: boolean;
  snagsResolvedOrAccepted?: boolean;
  handoverAcknowledged?: boolean;
  financeReconciled?: boolean;
  warrantyRegistered?: boolean;
}): GateResult {
  const required: Partial<Record<ProjectStage, Array<[keyof typeof facts, string]>>> = {
    design: [["acceptedQuote", "An accepted quote is required before design work starts."], ["bookingSigned", "The booking form must be signed."], ["bookingPaymentVerified", "The booking payment must be verified."]],
    design_approval: [["designDocumentReady", "A reviewable design approval document must be issued."]],
    contract: [["designApproved", "An approved design is required."], ["finalQuoteAccepted", "The final quotation must be accepted."]],
    production_ready: [["designApproved", "The design must be approved."], ["finalQuoteAccepted", "The final quotation must be accepted."], ["worksContractSigned", "The works contract must be signed."], ["productionMilestonesVerified", "The required production milestone payment must be verified."]],
    production: [["requiredProcurementComplete", "Required procurement checks must be complete."]],
    quality_check: [["requiredProductionComplete", "Required production checks must be complete."]],
    dispatch: [["qualityPassed", "The required quality checks must pass."], ["dispatchPaymentVerified", "The applicable dispatch payment must be verified."]],
    installation: [["siteReady", "Site readiness must be confirmed."]],
    handover: [["installationComplete", "Installation must be marked complete."], ["snagsResolvedOrAccepted", "Snags must be resolved or explicitly accepted."], ["financeReconciled", "Project finances must be reconciled."], ["handoverAcknowledged", "Handover acknowledgement must be recorded."]],
    warranty: [["handoverAcknowledged", "Handover must be acknowledged."], ["warrantyRegistered", "The warranty record must be registered."]],
    closed: [["financeReconciled", "Project finances must be reconciled."], ["warrantyRegistered", "Warranty must be registered."]],
  };
  const missing = (required[stage] ?? [])
    .filter(([key]) => facts[key] !== true)
    .map(([, message]) => message);
  return missing.length ? { allowed: false, missing } : { allowed: true, missing: [] };
}

export function normalizeEmail(value: string | null | undefined): string | null {
  const normalized = value?.trim().toLowerCase();
  return normalized || null;
}

export function normalizePhone(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  return digits.length === 10 ? `91${digits}` : digits;
}

export function detectPossibleDuplicate(customer: Pick<Customer, "normalizedEmail" | "normalizedPhone" | "normalizedName">,
  candidates: Array<Pick<Customer, "id" | "normalizedEmail" | "normalizedPhone" | "normalizedName">>) {
  return candidates.filter((candidate) =>
    Boolean(
      (customer.normalizedEmail && candidate.normalizedEmail === customer.normalizedEmail) ||
      (customer.normalizedPhone && candidate.normalizedPhone === customer.normalizedPhone)
    )
  );
}

export function assertMinorCurrency(amountMinor: number, label: string): void {
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) {
    throw new Error(`${label} must be a non-negative integer in paise.`);
  }
}

export function assertQuoteMath(quote: Pick<Quote, "lines" | "subtotalMinor" | "taxMinor" | "totalMinor">): string[] {
  const errors: string[] = [];
  const active = quote.lines.filter((line) => line.included);
  for (const line of active) {
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) errors.push(`Line ${line.id}: quantity must be greater than zero.`);
    assertMinorCurrency(line.unitPriceMinor, `Line ${line.id} unit price`);
    if (!Number.isInteger(line.taxRateBps) || line.taxRateBps < 0 || line.taxRateBps > 10000) {
      errors.push(`Line ${line.id}: tax rate is invalid.`);
    }
  }
  const subtotal = active.reduce((sum, line) => sum + Math.round(line.quantity * line.unitPriceMinor), 0);
  const tax = active.reduce((sum, line) => sum + Math.round(Math.round(line.quantity * line.unitPriceMinor) * line.taxRateBps / 10000), 0);
  if (subtotal !== quote.subtotalMinor) errors.push("Line totals do not match the quotation subtotal.");
  if (tax !== quote.taxMinor) errors.push("Line tax does not match the quotation tax total.");
  if (subtotal + tax !== quote.totalMinor) errors.push("Subtotal plus tax does not match the quotation grand total.");
  return errors;
}

export function assertMilestoneSchedule(milestones: Array<Pick<PaymentMilestone, "amountMinor">>, quoteTotalMinor: number): string[] {
  const errors: string[] = [];
  if (!Number.isSafeInteger(quoteTotalMinor) || quoteTotalMinor < 0) errors.push("Quotation total is invalid.");
  for (const milestone of milestones) {
    if (!Number.isSafeInteger(milestone.amountMinor) || milestone.amountMinor < 0) errors.push("Every payment milestone must be a non-negative integer in paise.");
  }
  if (milestones.reduce((sum, item) => sum + item.amountMinor, 0) !== quoteTotalMinor) {
    errors.push("Payment milestones must sum exactly to the approved quotation total.");
  }
  return errors;
}
