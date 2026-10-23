export const OPERATIONS_PHASES = [
  "initial_quote", "booking", "design", "final_approval", "production", "execution", "handover", "warranty", "closed",
] as const;
export type OperationsPhase = typeof OPERATIONS_PHASES[number];

export const DOCUMENT_KINDS = [
  "initial_quote", "booking_form", "booking_receipt", "design_approval", "final_quote", "works_contract",
  "change_order", "payment_receipt", "tax_invoice", "handover_pack", "warranty_certificate",
] as const;
export type ProjectDocumentKind = typeof DOCUMENT_KINDS[number];
export type DocumentStatus = "draft" | "ready_to_send" | "sent" | "awaiting_signature" | "signed" | "accepted" | "issued" | "superseded" | "void";
export type QuoteStatus = "draft" | "issued" | "accepted" | "rejected" | "superseded";
export type ApprovalDecision = "pending" | "approved" | "changes_requested" | "rejected";
export type TransactionStatus = "pending_verification" | "verified" | "reversed";
export type TaskStatus = "open" | "in_progress" | "waiting_client" | "blocked" | "done" | "cancelled";
export type ChecklistStatus = "pending" | "passed" | "failed" | "not_applicable";

export type PolicyMilestone = { id: string; name: string; percent: number; trigger: string };
export type BusinessPolicy = {
  revision: number;
  approved: boolean;
  approvedBy: string;
  approvedAt: string;
  paymentMilestones: PolicyMilestone[];
  gst: { approved: boolean; rate: number | null; defaultTaxCode: string; notes: string };
  delivery: { approved: boolean; duration: number | null; unit: "working_days" | "calendar_days"; graceDays: number | null; clockStartsAt: string; pauseConditions: string[]; notes: string };
  warranty: { approved: boolean; joineryMonths: number | null; startRule: "invoice_date" | "handover_date" | "other"; thirdPartyRule: string; exclusions: string; serviceFeeRule: string; notes: string };
  contract: { approved: boolean; version: string; signatureMethod: string; cancellationPolicy: string; stampDutyReviewed: boolean; notes: string };
  communications: { approvedTemplates: boolean; ownerEmailProvider: string; whatsappMode: "manual" | "api"; remindersEnabled: boolean; businessHours: string };
  reviewedByCA: boolean;
  reviewedByLegal: boolean;
};

export type ProjectRecord = {
  id: string;
  code: string;
  clientId: string;
  linkedLeadId: string;
  title: string;
  serviceType: string;
  propertyAddress: string;
  propertyName: string;
  apartment: string;
  floor: string;
  areaSqFt: number | null;
  possessionDate: string;
  scopeSummary: string;
  phase: OperationsPhase;
  priority: "normal" | "high" | "urgent";
  owner: string;
  targetStartDate: string;
  committedDeliveryDate: string;
  siteReady: boolean;
  createdAt: string;
  updatedAt: string;
  blockedReason: string;
  notes: string;
};

export type QuoteLine = { id: string; description: string; qty: number; unit: string; unitPrice: number; taxCode: string };
export type QuoteVersion = {
  id: string; projectId: string; kind: "initial" | "final" | "change";
  revision: number; status: QuoteStatus; issueDate: string; validUntil: string;
  lines: QuoteLine[]; exclusions: string; assumptions: string; scopeVersion: string;
  subtotal: number; taxRate: number | null; taxAmount: number | null; total: number | null;
  createdAt: string; createdBy: string; supersedesId: string; acceptedAt: string; customerComments: string;
  preflightPassed: boolean; preflightErrors: string[];
};

export type ProjectMilestone = {
  id: string; projectId: string; policyMilestoneId: string; name: string; percent: number;
  amount: number | null; trigger: string; dueDate: string; status: "not_due" | "due" | "partially_paid" | "paid" | "waived";
  waiverReason: string; paidAmount: number; createdAt: string;
};

export type PaymentTransaction = {
  id: string; projectId: string; milestoneId: string; kind: "advance" | "milestone" | "refund" | "adjustment";
  amount: number; currency: "INR"; status: TransactionStatus; method: "upi" | "bank_transfer" | "cheque" | "cash" | "gateway" | "other";
  transactionReference: string; receivedAt: string; verifiedAt: string; verifiedBy: string;
  evidenceNote: string; reversalOfId: string; createdAt: string;
};

export type ProjectDocument = {
  id: string; projectId: string; kind: ProjectDocumentKind; title: string; number: string;
  status: DocumentStatus; version: number; sourceQuoteId: string; sourceApprovalId: string;
  snapshot: Record<string, unknown>; privateFilePath: string; sha256: string;
  sentAt: string; signedAt: string; signedBy: string; externalEnvelopeId: string;
  supersedesId: string; issuedAt: string; createdAt: string; createdBy: string;
};

export type ProjectApproval = {
  id: string; projectId: string; kind: "design" | "quotation" | "contract" | "change_order" | "handover" | "waiver";
  targetId: string; targetVersion: number; decision: ApprovalDecision; requestedAt: string; decidedAt: string;
  decidedBy: string; comments: string; evidenceDocumentId: string;
};

export type OperationsTask = {
  id: string; projectId: string; phase: OperationsPhase; title: string; description: string;
  owner: string; dueDate: string; status: TaskStatus; blockedReason: string; gateKey: string;
  sourceEventId: string; reminderCount: number; lastReminderAt: string; completedAt: string;
  createdAt: string; updatedAt: string;
};

export type OperationsChecklist = {
  id: string; projectId: string; gate: "booking" | "design_signoff" | "production_release" | "dispatch" | "site_readiness" | "installation" | "handover";
  title: string; required: boolean; status: ChecklistStatus; resultNote: string; evidenceDocumentId: string;
  checkedBy: string; checkedAt: string; notApplicableReason: string;
};

export type CommunicationsItem = {
  id: string; projectId: string; kind: "whatsapp" | "email";
  trigger: string; templateKey: string; recipient: string; subject: string; body: string;
  status: "draft" | "ready" | "opened" | "sent" | "failed" | "cancelled";
  idempotencyKey: string; createdAt: string; sentAt: string; failureReason: string; attemptCount: number;
};

export type WarrantyRecord = {
  id: string; projectId: string; documentId: string; invoiceDocumentId: string;
  joineryMonths: number | null; startDate: string; endDate: string; status: "pending_policy" | "active" | "expired" | "void";
  thirdPartyNotes: string; createdAt: string;
};

export type WarrantyClaim = {
  id: string; projectId: string; warrantyId: string; claimNumber: string; receivedAt: string;
  customerName: string; issue: string; productArea: string; status: "new" | "triage" | "under_warranty" | "chargeable" | "scheduled" | "in_progress" | "resolved" | "rejected";
  priority: "normal" | "high" | "urgent"; eligibilityNotes: string; nextAction: string; nextActionDate: string;
  resolution: string; closedAt: string; createdAt: string; updatedAt: string;
};

export type OperationsEvent = {
  id: string; projectId: string; type: string; title: string; detail: string;
  actor: string; occurredAt: string; idempotencyKey: string;
};

export type OperationsData = {
  schemaVersion: 1;
  revision: number;
  lastSavedAt: string;
  policy: BusinessPolicy;
  projects: ProjectRecord[];
  quotes: QuoteVersion[];
  milestones: ProjectMilestone[];
  transactions: PaymentTransaction[];
  documents: ProjectDocument[];
  approvals: ProjectApproval[];
  tasks: OperationsTask[];
  checklists: OperationsChecklist[];
  communications: CommunicationsItem[];
  warranties: WarrantyRecord[];
  warrantyClaims: WarrantyClaim[];
  events: OperationsEvent[];
};

export function defaultBusinessPolicy(): BusinessPolicy {
  return {
    revision: 1, approved: false, approvedBy: "", approvedAt: "", paymentMilestones: [],
    gst: { approved: false, rate: null, defaultTaxCode: "", notes: "CA review required: GST treatment, HSN/SAC and advance-document workflow are not yet approved." },
    delivery: { approved: false, duration: null, unit: "working_days", graceDays: null, clockStartsAt: "", pauseConditions: [], notes: "Confirm trigger date, working/calendar days, grace and client/site delay rules." },
    warranty: { approved: false, joineryMonths: null, startRule: "invoice_date", thirdPartyRule: "", exclusions: "", serviceFeeRule: "", notes: "Legal/owner approval required; do not issue a warranty until terms are confirmed." },
    contract: { approved: false, version: "", signatureMethod: "manual_upload", cancellationPolicy: "", stampDutyReviewed: false, notes: "Contract/terms need legal review before issue." },
    communications: { approvedTemplates: false, ownerEmailProvider: "", whatsappMode: "manual", remindersEnabled: false, businessHours: "09:00-18:00 Asia/Kolkata" },
    reviewedByCA: false, reviewedByLegal: false,
  };
}

export function emptyOperationsData(): OperationsData {
  return {
    schemaVersion: 1, revision: 0, lastSavedAt: "", policy: defaultBusinessPolicy(),
    projects: [], quotes: [], milestones: [], transactions: [], documents: [], approvals: [],
    tasks: [], checklists: [], communications: [], warranties: [], warrantyClaims: [], events: [],
  };
}

export function normalizeOperationsData(value: unknown): OperationsData {
  const defaults = emptyOperationsData();
  if (!value || typeof value !== "object" || Array.isArray(value)) return defaults;
  const source = value as Partial<OperationsData>;
  const policy = source.policy && typeof source.policy === "object" ? { ...defaults.policy, ...source.policy } : defaults.policy;
  return {
    ...defaults, ...source, schemaVersion: 1, policy,
    projects: Array.isArray(source.projects) ? source.projects : [],
    quotes: Array.isArray(source.quotes) ? source.quotes : [],
    milestones: Array.isArray(source.milestones) ? source.milestones : [],
    transactions: Array.isArray(source.transactions) ? source.transactions : [],
    documents: Array.isArray(source.documents) ? source.documents : [],
    approvals: Array.isArray(source.approvals) ? source.approvals : [],
    tasks: Array.isArray(source.tasks) ? source.tasks : [],
    checklists: Array.isArray(source.checklists) ? source.checklists : [],
    communications: Array.isArray(source.communications) ? source.communications : [],
    warranties: Array.isArray(source.warranties) ? source.warranties : [],
    warrantyClaims: Array.isArray(source.warrantyClaims) ? source.warrantyClaims : [],
    events: Array.isArray(source.events) ? source.events : [],
  };
}

const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function quoteTotals(lines: QuoteLine[], taxRate: number | null) {
  const subtotal = money(lines.reduce((sum, line) => sum + line.qty * line.unitPrice, 0));
  const taxAmount = taxRate === null ? null : money(subtotal * taxRate / 100);
  return { subtotal, taxAmount, total: taxAmount === null ? null : money(subtotal + taxAmount) };
}

export function quotePreflight(quote: QuoteVersion, policy: BusinessPolicy) {
  const errors: string[] = [];
  if (!quote.lines.length) errors.push("Add at least one priced line item.");
  if (quote.lines.some((line) => !line.description.trim() || !Number.isFinite(line.qty) || line.qty <= 0 || !Number.isFinite(line.unitPrice) || line.unitPrice < 0)) errors.push("Every quote line must have a description, quantity above zero and a non-negative unit price.");
  const totals = quoteTotals(quote.lines, policy.gst.approved ? policy.gst.rate : null);
  if (quote.kind !== "initial") {
    if (!policy.gst.approved || policy.gst.rate === null) errors.push("CA-approved GST treatment/rate is missing; this quote can only remain a draft.");
    if (!policy.delivery.approved) errors.push("Delivery terms are not approved.");
    if (!policy.paymentMilestones.length || Math.abs(policy.paymentMilestones.reduce((sum, milestone) => sum + milestone.percent, 0) - 100) > 0.01) errors.push("Approved payment milestones must add up to 100%.");
    if (!policy.contract.approved) errors.push("Approved commercial/contract terms are missing.");
  }
  return { ...totals, errors, passed: errors.length === 0 };
}

export function projectGateBlockers(project: ProjectRecord, data: OperationsData, target: OperationsPhase): string[] {
  const blockers: string[] = [];
  const docs = data.documents.filter((item) => item.projectId === project.id && item.status !== "superseded" && item.status !== "void");
  const quotes = data.quotes.filter((item) => item.projectId === project.id && item.status !== "superseded" && item.status !== "rejected");
  const acceptedFinalQuote = quotes.some((item) => item.kind === "final" && item.status === "accepted" && item.preflightPassed);
  const acceptedInitialQuote = quotes.some((item) => item.kind === "initial" && item.status === "accepted");
  const signedBooking = docs.some((item) => item.kind === "booking_form" && item.status === "signed");
  const signedContract = docs.some((item) => item.kind === "works_contract" && item.status === "signed");
  const designApproval = data.approvals.some((item) => item.projectId === project.id && item.kind === "design" && item.decision === "approved");
  const verifiedMoney = data.transactions.filter((item) => item.projectId === project.id && item.status === "verified" && item.kind !== "refund").reduce((sum, item) => sum + item.amount, 0);
  const requiredChecklist = (gate: OperationsChecklist["gate"]) => data.checklists.filter((item) => item.projectId === project.id && item.gate === gate && item.required);
  const gateChecklistReady = (gate: OperationsChecklist["gate"]) => requiredChecklist(gate).every((item) => item.status === "passed" || item.status === "not_applicable" && Boolean(item.notApplicableReason.trim()));
  if (["booking", "design", "final_approval", "production", "execution", "handover", "warranty", "closed"].includes(target) && !acceptedInitialQuote) {
    blockers.push("An accepted initial quote is missing.");
  }
  if (["design", "final_approval", "production", "execution", "handover", "warranty", "closed"].includes(target)) {
    if (!signedBooking) blockers.push("Signed booking form is missing.");
    const bookingMilestone = data.milestones.find((item) => item.projectId === project.id && /booking|order booking/i.test(item.name));
    if (bookingMilestone && bookingMilestone.amount !== null && bookingMilestone.paidAmount + 0.009 < bookingMilestone.amount) blockers.push("Verified booking payment is outstanding.");
    if (!bookingMilestone) blockers.push("Project booking milestone has not been initialized from an approved payment policy.");
  }
  if (["final_approval", "production", "execution", "handover", "warranty", "closed"].includes(target)) {
    if (!designApproval) blockers.push("A design approval linked to a specific design version is missing.");
    const finalQuotePrepared = quotes.some((item) => item.kind === "final" && ["issued", "accepted"].includes(item.status));
    if (!finalQuotePrepared) blockers.push("A final quote must be prepared and issued for approval.");
  }
  if (["production", "execution", "handover", "warranty", "closed"].includes(target)) {
    if (!acceptedFinalQuote) blockers.push("The final quote has not been accepted or its quote preflight is incomplete.");
    if (!signedContract) blockers.push("The works contract is not signed against the approved final scope.");
    if (!data.policy.approved) blockers.push("Phase 0 business policy is not approved; financial/production gates remain locked.");
    if (!data.milestones.some((item) => item.projectId === project.id)) blockers.push("Project payment milestones are missing.");
    const dueBeforeProduction = data.milestones.filter((item) => item.projectId === project.id && /booking|advance|production release|before production/i.test(`${item.name} ${item.trigger}`) && item.status !== "waived");
    for (const milestone of dueBeforeProduction) {
      if (milestone.status !== "paid" && (milestone.amount === null || milestone.paidAmount + 0.009 < milestone.amount)) blockers.push(`Payment milestone “${milestone.name}” must be verified before production.`);
    }
  }
  if (["execution", "handover", "warranty", "closed"].includes(target) && !gateChecklistReady("production_release")) blockers.push("Production-release checklist is incomplete.");
  if (["handover", "warranty", "closed"].includes(target)) {
    if (!gateChecklistReady("dispatch")) blockers.push("Dispatch checklist is incomplete.");
    if (!gateChecklistReady("site_readiness")) blockers.push("Site-readiness checklist is incomplete.");
    if (!gateChecklistReady("installation")) blockers.push("Installation/QC checklist is incomplete.");
  }
  if (["warranty", "closed"].includes(target)) {
    if (!gateChecklistReady("handover")) blockers.push("Handover checklist is incomplete.");
    if (!docs.some((item) => item.kind === "handover_pack" && ["issued", "signed", "accepted"].includes(item.status))) blockers.push("An issued or accepted handover pack is missing.");
    if (!data.warranties.some((item) => item.projectId === project.id && item.status === "active")) blockers.push("Warranty registration is not active; check approved warranty policy and invoice evidence.");
  }
  if (target === "closed" && data.warrantyClaims.some((item) => item.projectId === project.id && !["resolved", "rejected"].includes(item.status))) blockers.push("Open warranty claims must be closed or explicitly transferred to the aftercare queue.");
  return blockers;
}

export function eventIdempotencyKey(projectId: string, type: string, subjectId: string) {
  return `${projectId}:${type}:${subjectId}`;
}

export function validateOperationsData(data: OperationsData): string[] {
  const errors: string[] = [];
  const checks: Array<[string, unknown[], number]> = [
    ["projects", data.projects, 5000], ["quotes", data.quotes, 20000], ["milestones", data.milestones, 50000],
    ["transactions", data.transactions, 50000], ["documents", data.documents, 50000], ["approvals", data.approvals, 50000],
    ["tasks", data.tasks, 50000], ["checklists", data.checklists, 100000], ["communications", data.communications, 50000],
    ["warranties", data.warranties, 5000], ["warrantyClaims", data.warrantyClaims, 50000], ["events", data.events, 100000],
  ];
  for (const [name, items, limit] of checks) {
    if (!Array.isArray(items) || items.length > limit) errors.push(`${name} collection is invalid or over its safe limit.`);
  }
  const unique = (name: string, ids: string[]) => {
    if (new Set(ids).size !== ids.length) errors.push(`${name} IDs must be unique.`);
  };
  unique("Project", data.projects.map((item) => item.id));
  unique("Project code", data.projects.map((item) => item.code));
  unique("Quote", data.quotes.map((item) => item.id));
  unique("Document", data.documents.map((item) => item.id));
  unique("Transaction", data.transactions.map((item) => item.id));
  unique("Event", data.events.map((item) => item.id));
  if (data.policy.paymentMilestones.length && Math.abs(data.policy.paymentMilestones.reduce((sum, item) => sum + item.percent, 0) - 100) > 0.01) errors.push("Payment milestone percentages must total exactly 100% before policy can be approved.");
  if (data.policy.gst.rate !== null && (!Number.isFinite(data.policy.gst.rate) || data.policy.gst.rate < 0 || data.policy.gst.rate > 100)) errors.push("GST rate must be between 0 and 100.");
  if (data.projects.some((project) => !project.id || !project.clientId || !project.code || !project.title.trim())) errors.push("Each project needs a stable ID, customer link, code and title.");
  if (data.quotes.some((quote) => !data.projects.some((project) => project.id === quote.projectId))) errors.push("A quote references a project that does not exist.");
  if (data.documents.some((doc) => !data.projects.some((project) => project.id === doc.projectId))) errors.push("A document references a project that does not exist.");
  if (data.transactions.some((transaction) => !data.projects.some((project) => project.id === transaction.projectId))) errors.push("A transaction references a project that does not exist.");
  return errors;
}
