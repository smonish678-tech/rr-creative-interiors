import { createHash, randomUUID } from "node:crypto";

export const PROJECT_STAGES = ["booking", "design", "design-signoff", "production", "execution", "handover", "complete", "on-hold"] as const;
export type ProjectStage = (typeof PROJECT_STAGES)[number];

export const PROJECT_STAGE_LABELS: Record<ProjectStage, string> = {
  booking: "Booking & advance",
  design: "Design development",
  "design-signoff": "Design & contract sign-off",
  production: "Production",
  execution: "Installation & execution",
  handover: "Handover",
  complete: "Handed over",
  "on-hold": "On hold",
};

export type OpsCustomer = {
  id: string;
  legacyClientId?: string;
  name: string;
  emails: string[];
  phones: string[];
  billingAddress: string;
  gstin: string;
  pan: string;
  identityReviewRequired: boolean;
  identityReviewReason: string;
  createdAt: string;
  updatedAt: string;
};

export type OpsProject = {
  id: string;
  projectCode: string;
  sourceLeadId?: string;
  customerId: string;
  title: string;
  serviceType: string;
  propertyAddress: string;
  apartmentNumber: string;
  floorNumber: string;
  approximateArea: string;
  possessionDate: string;
  stage: ProjectStage;
  previousStage: ProjectStage | "";
  createdAt: string;
  updatedAt: string;
  nextAction: string;
  nextActionDue: string;
  targetHandoverDate: string;
  stageEnteredAt: string;
  holdReason: string;
  cancelledReason: string;
  legacyInvoiceIds: string[];
};

export type QuoteLine = {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  rate: number;
  taxRate: number | null;
  amount: number;
  taxAmount: number | null;
  total: number | null;
};

export type OpsQuote = {
  id: string;
  projectId: string;
  kind: "initial" | "final" | "change-order";
  version: number;
  status: "draft" | "ready-for-review" | "issued" | "accepted" | "rejected" | "superseded" | "void";
  currency: "INR";
  lines: QuoteLine[];
  subtotal: number;
  taxTotal: number | null;
  total: number | null;
  exclusions: string[];
  assumptions: string[];
  validityDays: number | null;
  paymentScheduleVersion: string;
  commercialTermsVersion: string;
  issuedAt: string;
  acceptedAt: string;
  createdAt: string;
  updatedAt: string;
  parentQuoteId: string;
  changeReason: string;
};

export type OpsMilestone = {
  id: string;
  projectId: string;
  quoteId: string;
  sequence: number;
  label: string;
  trigger: string;
  amount: number;
  percentage: number | null;
  dueDate: string;
  status: "planned" | "due" | "partially-paid" | "paid" | "waived" | "cancelled";
  waivedReason: string;
  createdAt: string;
  updatedAt: string;
};

export type PaymentAllocation = { milestoneId: string; amount: number };

export type OpsTransaction = {
  id: string;
  projectId: string;
  milestoneAllocations: PaymentAllocation[];
  type: "customer-payment" | "refund" | "supplier-payment" | "adjustment";
  amount: number;
  currency: "INR";
  method: "upi" | "bank-transfer" | "cash" | "cheque" | "gateway" | "other";
  receivedAt: string;
  reference: string;
  evidenceFileName: string;
  evidenceBlobUrl: string;
  verificationStatus: "pending" | "verified" | "rejected";
  verifiedBy: string;
  verifiedAt: string;
  verificationNote: string;
  receiptDocumentId: string;
  createdAt: string;
  updatedAt: string;
};

export type DocumentKind =
  | "initial-quote" | "booking-form" | "advance-receipt" | "design-approval"
  | "final-quote" | "works-contract" | "change-order" | "payment-notice"
  | "payment-receipt" | "tax-invoice" | "handover-pack" | "warranty-certificate";

export type DocumentStatus = "draft" | "ready-for-review" | "issued" | "pending-signature" | "signed" | "changes-requested" | "superseded" | "void";

export type OpsDocument = {
  id: string;
  projectId: string;
  customerId: string;
  kind: DocumentKind;
  documentNumber: string;
  version: number;
  status: DocumentStatus;
  title: string;
  htmlSnapshot: string;
  contentHash: string;
  relatedQuoteId: string;
  relatedMilestoneId: string;
  relatedTransactionId: string;
  termsVersion: string;
  taxPolicyVersion: string;
  issuedAt: string;
  signedAt: string;
  createdAt: string;
  updatedAt: string;
  draftBlockers: string[];
  approvalLinkExpiresAt: string;
};

export type ApprovalKind = "quote" | "design" | "works-contract" | "change-order" | "handover";
export type OpsApproval = {
  id: string;
  projectId: string;
  documentId: string;
  documentVersion: number;
  kind: ApprovalKind;
  status: "requested" | "approved" | "changes-requested" | "rejected" | "expired" | "revoked";
  requestedAt: string;
  decidedAt: string;
  signerName: string;
  signerEmail: string;
  decisionNote: string;
  consentTextVersion: string;
  auditEventId: string;
};

export type OpsTask = {
  id: string;
  projectId: string;
  category: "sales" | "booking" | "design" | "procurement" | "production" | "quality" | "dispatch" | "site-readiness" | "installation" | "snag" | "handover" | "warranty" | "finance" | "communication" | "admin";
  title: string;
  description: string;
  owner: string;
  dueDate: string;
  status: "open" | "in-progress" | "blocked" | "done" | "cancelled";
  priority: "low" | "normal" | "high" | "critical";
  blocksStage: ProjectStage | "";
  blockerReason: string;
  sourceEventId: string;
  dedupeKey: string;
  completedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type OpsMessage = {
  id: string;
  projectId: string;
  customerId: string;
  channel: "whatsapp" | "email";
  purpose: string;
  recipient: string;
  subject: string;
  body: string;
  status: "draft" | "ready" | "opened" | "sent" | "failed" | "cancelled";
  dedupeKey: string;
  attemptCount: number;
  lastAttemptAt: string;
  sentAt: string;
  lastError: string;
  externalMessageId: string;
  createdAt: string;
  updatedAt: string;
};

export type ChecklistItem = {
  id: string;
  label: string;
  required: boolean;
  status: "not-started" | "in-progress" | "pass" | "fail" | "not-applicable";
  note: string;
  evidenceFileName: string;
  evidenceUrl: string;
  completedAt: string;
  completedBy: string;
};

export type OpsChecklist = {
  id: string;
  projectId: string;
  category: "booking" | "design" | "procurement" | "production-qc" | "dispatch" | "site-readiness" | "installation" | "snags" | "handover";
  title: string;
  status: "not-started" | "in-progress" | "blocked" | "passed";
  items: ChecklistItem[];
  signedOffBy: string;
  signedOffAt: string;
  signOffNote: string;
  createdAt: string;
  updatedAt: string;
};

export type OpsWarranty = {
  id: string;
  projectId: string;
  customerId: string;
  documentId: string;
  invoiceId: string;
  certificateNumber: string;
  scope: string;
  joineryYears: number | null;
  coverageStartsAt: "invoice-date" | "handover-date" | null;
  coverageStartDate: string;
  coverageEndDate: string;
  termsVersion: string;
  status: "draft" | "active" | "expired" | "suspended" | "void";
  issuedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type WarrantyClaimStatus = "new" | "triage" | "awaiting-customer" | "in-warranty" | "out-of-warranty" | "scheduled" | "resolved" | "rejected";
export type OpsWarrantyClaim = {
  id: string;
  projectId: string;
  warrantyId: string;
  customerId: string;
  claimNumber: string;
  title: string;
  description: string;
  reportedAt: string;
  evidence: Array<{ fileName: string; url: string }>;
  status: WarrantyClaimStatus;
  diagnosis: string;
  resolution: string;
  appointmentDate: string;
  responsibleOwner: string;
  closedAt: string;
  createdAt: string;
  updatedAt: string;
};

export type OpsEvent = {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string;
  projectId: string;
  occurredAt: string;
  actor: string;
  idempotencyKey: string;
  summary: string;
  payload: Record<string, unknown>;
};

export type OpsPaymentStage = { key: string; label: string; amountPercent: number; trigger: string };

export type OperationsSettings = {
  id: "global";
  companyProfileApproved: boolean;
  taxConfigApproved: boolean;
  paymentScheduleApproved: boolean;
  deliveryPolicyApproved: boolean;
  contractTemplateApproved: boolean;
  warrantyPolicyApproved: boolean;
  approvedBy: string;
  approvedAt: string;
  version: string;
  gstin: string;
  companyLegalName: string;
  invoicePrefix: string;
  receiptPrefix: string;
  quoteValidityDays: number | null;
  taxInclusiveInQuotes: boolean | null;
  defaultTaxRate: number | null;
  paymentStages: OpsPaymentStage[];
  deliveryDays: number | null;
  deliveryDayType: "working-days" | "calendar-days" | null;
  deliveryClockStartsOn: string;
  graceDays: number | null;
  warrantyJoineryYears: number | null;
  warrantyStartRule: "invoice-date" | "handover-date" | null;
  warrantyTermsText: string;
  cancellationTermsVersion: string;
  approvedTermsText: string;
  updatedAt: string;
};

export type OpsBackup = {
  id: string;
  createdAt: string;
  createdBy: string;
  version: string;
  recordCounts: Record<string, number>;
  checksum: string;
  snapshot: Record<string, unknown>;
};

export type OpsBundle = {
  customers: OpsCustomer[];
  projects: OpsProject[];
  quotes: OpsQuote[];
  milestones: OpsMilestone[];
  transactions: OpsTransaction[];
  documents: OpsDocument[];
  approvals: OpsApproval[];
  tasks: OpsTask[];
  messages: OpsMessage[];
  checklists: OpsChecklist[];
  warranties: OpsWarranty[];
  warrantyClaims: OpsWarrantyClaim[];
  events: OpsEvent[];
  backups: OpsBackup[];
  settings: OperationsSettings;
};

export type GateAssessment = { allowed: boolean; blockers: string[] };

export const DOCUMENT_LABELS: Record<DocumentKind, string> = {
  "initial-quote": "Initial quotation",
  "booking-form": "Booking form",
  "advance-receipt": "Advance receipt",
  "design-approval": "Design sign-off",
  "final-quote": "Final quotation",
  "works-contract": "Works contract",
  "change-order": "Change order",
  "payment-notice": "Payment notice",
  "payment-receipt": "Payment receipt",
  "tax-invoice": "Tax invoice",
  "handover-pack": "Handover pack",
  "warranty-certificate": "Warranty certificate",
};

export const DEFAULT_CHECKLISTS: Array<{ category: OpsChecklist["category"]; title: string; items: string[] }> = [
  { category: "booking", title: "Booking readiness", items: ["Booking form version is complete and signed", "Booking milestone is reconciled against actual funds received", "Customer and site details are confirmed"] },
  { category: "design", title: "Design sign-off", items: ["Site measurements and client brief are recorded", "Design revision to be approved is identified", "Material and finish selections are recorded", "Client's design decision is recorded"] },
  { category: "procurement", title: "Procurement readiness", items: ["Materials are specified against approved design", "Supplier and lead time are recorded", "Substitutions have written approval", "Purchase/lead-time risks are reviewed"] },
  { category: "production-qc", title: "Production quality checks", items: ["Production order matches signed specifications", "Dimensions and assembly checked", "Finish and visible surfaces checked", "QC defects have been resolved or formally accepted"] },
  { category: "dispatch", title: "Dispatch readiness", items: ["Dispatch inventory and quantities are reconciled", "Site readiness and access are confirmed", "Delivery/installation slot is agreed", "Required milestone payment is verified or approved exception recorded"] },
  { category: "site-readiness", title: "Site readiness", items: ["Access, lift, parking and protection arrangements confirmed", "Civil/electrical/plumbing prerequisites checked", "Site measurements or conditions revalidated", "Customer/site contact and working slot confirmed"] },
  { category: "installation", title: "Installation completion", items: ["Installation follows approved scope and drawings", "Work area left safe and clean", "Installed items checked with customer/site representative", "Snag items recorded with owners and dates"] },
  { category: "snags", title: "Snag closure", items: ["Every snag is resolved or has an authorised written exception"] },
  { category: "handover", title: "Handover", items: ["Handover acknowledgement is recorded", "Customer care/maintenance instructions are supplied", "Final finance reconciliation is complete or approved exception recorded", "Warranty certificate is generated from the approved policy"] },
];

export function newId(prefix: string): string {
  return prefix + "_" + randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function safeRecordId(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

export function defaultOperationsSettings(): OperationsSettings {
  return {
    id: "global",
    companyProfileApproved: false,
    taxConfigApproved: false,
    paymentScheduleApproved: false,
    deliveryPolicyApproved: false,
    contractTemplateApproved: false,
    warrantyPolicyApproved: false,
    approvedBy: "",
    approvedAt: "",
    version: "unapproved",
    gstin: "",
    companyLegalName: "",
    invoicePrefix: "RR",
    receiptPrefix: "RR-REC",
    quoteValidityDays: null,
    taxInclusiveInQuotes: null,
    defaultTaxRate: null,
    paymentStages: [],
    deliveryDays: null,
    deliveryDayType: null,
    deliveryClockStartsOn: "",
    graceDays: null,
    warrantyJoineryYears: null,
    warrantyStartRule: null,
    warrantyTermsText: "",
    cancellationTermsVersion: "",
    approvedTermsText: "",
    updatedAt: nowIso(),
  };
}

export function calcQuote(lines: QuoteLine[]) {
  const subtotal = roundMoney(lines.reduce((sum, line) => sum + line.quantity * line.rate, 0));
  const taxRatesKnown = lines.every((line) => typeof line.taxRate === "number");
  const taxTotal = taxRatesKnown ? roundMoney(lines.reduce((sum, line) => sum + line.quantity * line.rate * (line.taxRate || 0) / 100, 0)) : null;
  return { subtotal, taxTotal, total: taxTotal === null ? null : roundMoney(subtotal + taxTotal) };
}

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function createQuoteLine(input: Partial<QuoteLine>): QuoteLine {
  const quantity = Number(input.quantity);
  const rate = Number(input.rate);
  const taxRate = typeof input.taxRate === "number" ? input.taxRate : null;
  if (!input.description?.trim()) throw new Error("Every quote line needs a description.");
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("Quantity must be greater than zero.");
  if (!Number.isFinite(rate) || rate < 0) throw new Error("Rate cannot be negative.");
  if (taxRate !== null && (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100)) throw new Error("Tax rate must be between 0% and 100%.");
  const amount = roundMoney(quantity * rate);
  const taxAmount = taxRate === null ? null : roundMoney(amount * taxRate / 100);
  return { id: input.id || newId("line"), description: input.description.trim().slice(0, 500), quantity, unit: input.unit || "unit", rate, taxRate, amount, taxAmount, total: taxRate === null ? null : roundMoney(amount + taxAmount) };
}

export function getPhase0Blockers(settings: OperationsSettings, kind?: DocumentKind): string[] {
  const blockers: string[] = [];
  if (!settings.companyProfileApproved) blockers.push("Approve the RR legal entity/profile used on documents.");
  if (["initial-quote", "final-quote", "change-order"].includes(kind || "")) {
    if (!settings.taxConfigApproved) blockers.push("CA must approve quote tax handling and GST settings.");
    if (settings.quoteValidityDays === null || settings.quoteValidityDays < 1) blockers.push("Set and approve quotation validity.");
    if (settings.taxInclusiveInQuotes === null) blockers.push("Confirm whether the quote value is tax-inclusive or tax-exclusive.");
  }
  if (["booking-form", "final-quote", "works-contract", "change-order"].includes(kind || "")) {
    if (!settings.paymentScheduleApproved) blockers.push("Approve the payment milestones and percentages.");
    if (!settings.contractTemplateApproved) blockers.push("Approve the current booking/works-contract wording.");
  }
  if (["tax-invoice", "advance-receipt", "payment-receipt"].includes(kind || "")) {
    if (!settings.taxConfigApproved) blockers.push("CA must approve the tax-document rules and numbering.");
  }
  if (kind === "works-contract" || kind === "booking-form") {
    if (!settings.deliveryPolicyApproved) blockers.push("Approve the delivery-clock and grace-period wording.");
  }
  if (kind === "warranty-certificate") {
    if (!settings.warrantyPolicyApproved) blockers.push("Approve the warranty coverage and start-date rule.");
  }
  return [...new Set(blockers)];
}

function hasApprovedDocumentApproval(bundle: OpsBundle, projectId: string, kind: ApprovalKind): boolean {
  return bundle.approvals.some((approval) => approval.projectId === projectId && approval.kind === kind && approval.status === "approved");
}

function hasDocument(bundle: OpsBundle, projectId: string, kind: DocumentKind): boolean {
  return bundle.documents.some((doc) => doc.projectId === projectId && doc.kind === kind && !["void", "superseded"].includes(doc.status));
}

function passedChecklist(bundle: OpsBundle, projectId: string, category: OpsChecklist["category"]): boolean {
  return bundle.checklists.some((checklist) => checklist.projectId === projectId && checklist.category === category && checklist.status === "passed");
}

export function getStageTransitionGate(project: OpsProject, target: ProjectStage, bundle: OpsBundle): GateAssessment {
  const blockers: string[] = [];
  if (project.stage === target) return { allowed: true, blockers: [] };
  if (target === "on-hold") return { allowed: true, blockers: [] };
  const progression = PROJECT_STAGES.filter((stage) => stage !== "on-hold");
  if (project.stage === "on-hold") {
    if (target !== project.previousStage) return { allowed: false, blockers: ["Resume the project at its prior stage first; the relevant gate will be checked again when progressing."] };
    return { allowed: true, blockers: [] };
  }
  if (progression.indexOf(target) !== progression.indexOf(project.stage) + 1) {
    return { allowed: false, blockers: ["Projects can only move forward one approved stage at a time. Use On hold for a pause."] };
  }

  const projectMilestones = bundle.milestones.filter((item) => item.projectId === project.id && item.status !== "cancelled");
  const fullyPaid = (items: OpsMilestone[]) => items.every((item) => item.status === "paid" || item.status === "waived");
  const hasVerifiedFunds = bundle.transactions.some((transaction) => transaction.projectId === project.id && transaction.type === "customer-payment" && transaction.verificationStatus === "verified");
  const openDesignTasks = bundle.tasks.some((task) => task.projectId === project.id && task.category === "design" && !["done", "cancelled"].includes(task.status));

  if (project.stage === "booking" && target === "design") {
    if (!bundle.documents.some((doc) => doc.projectId === project.id && doc.kind === "booking-form" && doc.status === "signed") || !hasApprovedDocumentApproval(bundle, project.id, "quote")) blockers.push("The booking form must be signed and the initial quotation approved.");
    if (!hasVerifiedFunds) blockers.push("Record and independently verify the booking payment.");
    if (!bundle.settings.companyProfileApproved) blockers.push("Approve the RR legal entity/profile before activating the project.");
  }
  if (project.stage === "design" && target === "design-signoff") {
    if (!hasDocument(bundle, project.id, "design-approval")) blockers.push("Create the design sign-off document for the revision being reviewed.");
    if (openDesignTasks) blockers.push("Complete open design tasks before requesting sign-off.");
  }
  if (project.stage === "design-signoff" && target === "production") {
    if (!hasApprovedDocumentApproval(bundle, project.id, "design")) blockers.push("Record client approval of the exact design version.");
    if (!hasApprovedDocumentApproval(bundle, project.id, "quote")) blockers.push("Record approval of the final quotation.");
    if (!hasApprovedDocumentApproval(bundle, project.id, "works-contract")) blockers.push("Record the signed works contract.");
    if (!bundle.settings.paymentScheduleApproved) blockers.push("Approve the project payment schedule before production release.");
    if (!projectMilestones.length) blockers.push("Add the approved payment milestone schedule to this project.");
    if (!fullyPaid(projectMilestones.filter((item) => item.status === "due" || item.status === "partially-paid" || item.status === "planned"))) blockers.push("Every due milestone must be verified paid or formally waived.");
    if (!bundle.settings.deliveryPolicyApproved) blockers.push("Approve the delivery-clock policy before production release.");
  }
  if (project.stage === "production" && target === "execution") {
    if (!passedChecklist(bundle, project.id, "production-qc")) blockers.push("Production QC checklist must pass.");
    const dispatchMilestones = projectMilestones.filter((item) => /dispatch|manufactured|ready for delivery/i.test(item.trigger + " " + item.label));
    if (!dispatchMilestones.length) blockers.push("Define which approved payment milestone is due before dispatch.");
    else if (!fullyPaid(dispatchMilestones)) blockers.push("Verify the pre-dispatch milestone before dispatch.");
  }
  if (project.stage === "execution" && target === "handover") {
    if (!passedChecklist(bundle, project.id, "site-readiness")) blockers.push("Site readiness must be confirmed.");
    if (!passedChecklist(bundle, project.id, "installation")) blockers.push("Installation checklist must pass.");
    if (bundle.tasks.some((task) => task.projectId === project.id && task.category === "snag" && !["done", "cancelled"].includes(task.status))) blockers.push("Resolve snag tasks or record an authorised written exception.");
  }
  if (project.stage === "handover" && target === "complete") {
    if (!hasApprovedDocumentApproval(bundle, project.id, "handover")) blockers.push("Record client handover acknowledgement.");
    if (!bundle.settings.warrantyPolicyApproved || !hasDocument(bundle, project.id, "warranty-certificate")) blockers.push("Approved warranty policy and warranty certificate are required.");
    if (!projectMilestones.length || !fullyPaid(projectMilestones)) blockers.push("Reconcile all payment milestones or record an authorised written exception.");
    if (bundle.tasks.some((task) => task.projectId === project.id && task.category === "handover" && !["done", "cancelled"].includes(task.status))) blockers.push("Complete the handover checklist.");
  }

  return { allowed: blockers.length === 0, blockers: [...new Set(blockers)] };
}

export function calcMilestoneBalances(milestone: OpsMilestone, transactions: OpsTransaction[]) {
  const allocated = transactions.filter((transaction) => transaction.projectId === milestone.projectId && transaction.verificationStatus === "verified" && transaction.type === "customer-payment")
    .reduce((sum, transaction) => sum + transaction.milestoneAllocations.filter((allocation) => allocation.milestoneId === milestone.id).reduce((inner, allocation) => inner + allocation.amount, 0), 0);
  const received = roundMoney(allocated);
  return { received, balance: roundMoney(Math.max(0, milestone.amount - received)) };
}

export function deriveMilestoneStatus(milestone: OpsMilestone, transactions: OpsTransaction[]): OpsMilestone["status"] {
  if (milestone.status === "waived" || milestone.status === "cancelled") return milestone.status;
  const { received, balance } = calcMilestoneBalances(milestone, transactions);
  if (balance <= 0) return "paid";
  if (received > 0) return "partially-paid";
  if (milestone.dueDate && milestone.dueDate <= new Date().toISOString().slice(0, 10)) return "due";
  return "planned";
}
