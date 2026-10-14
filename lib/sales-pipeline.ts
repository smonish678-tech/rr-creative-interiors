export type PipelineStageKind = "open" | "nurture" | "won" | "lost" | "disqualified";
export type PipelineTone = "gold" | "blue" | "green" | "red" | "stone";
export type PipelineAutomationTrigger = "invoice_saved" | "receipt_saved";
export type PipelineField =
  | "name"
  | "contact"
  | "project"
  | "serviceType"
  | "location"
  | "area"
  | "budget"
  | "timeline"
  | "nextAction"
  | "email"
  | "phone"
  | "notes"
  | "lostReason"
  | "agreementSigned"
  | "advanceConfirmed";

export type SalesPipelineStage = {
  id: string;
  name: string;
  kind: PipelineStageKind;
  tone: PipelineTone;
  followUpDays: number | null;
  defaultNextAction: string;
  requiredFields: PipelineField[];
  active: boolean;
  isInitial: boolean;
  automationTriggers: PipelineAutomationTrigger[];
};

export const PIPELINE_FIELD_OPTIONS: Array<{ key: PipelineField; label: string; help: string }> = [
  { key: "name", label: "Customer name", help: "A named person or organisation." },
  { key: "contact", label: "Phone or email", help: "At least one reliable contact method." },
  { key: "project", label: "Project requirement", help: "What the customer wants done." },
  { key: "serviceType", label: "Service type", help: "Turnkey, design-only, renovation, modular or furniture." },
  { key: "location", label: "Property / project location", help: "Where the project is located." },
  { key: "area", label: "Approximate area", help: "Optional until the stage requires it." },
  { key: "budget", label: "Estimated budget", help: "Customer's budget or an explicit unknown recorded in notes." },
  { key: "timeline", label: "Expected start timeline", help: "When the customer wants to begin." },
  { key: "nextAction", label: "Next action", help: "A specific action someone must take." },
  { key: "email", label: "Email address", help: "A valid email address is available." },
  { key: "phone", label: "Phone number", help: "A usable phone number is available." },
  { key: "notes", label: "Conversation / meeting notes", help: "The key outcome or context is recorded." },
  { key: "lostReason", label: "Lost / disqualification reason", help: "Why the opportunity will not proceed." },
  { key: "agreementSigned", label: "Agreement signed", help: "Manually confirm the signed agreement is stored." },
  { key: "advanceConfirmed", label: "Initial payment confirmed", help: "Manually confirm receipt or a documented authorised exception." },
];

export const DEFAULT_SALES_PIPELINE: SalesPipelineStage[] = [
  { id: "new-enquiry", name: "New enquiry", kind: "open", tone: "gold", followUpDays: 0, defaultNextAction: "Make first contact", requiredFields: ["name", "contact", "project"], active: true, isInitial: true, automationTriggers: [] },
  { id: "contacted", name: "Contacted", kind: "open", tone: "blue", followUpDays: 1, defaultNextAction: "Confirm qualification details", requiredFields: ["contact", "nextAction"], active: true, isInitial: false, automationTriggers: [] },
  { id: "qualified", name: "Qualified", kind: "open", tone: "blue", followUpDays: 1, defaultNextAction: "Book a consultation or site visit", requiredFields: ["serviceType", "location", "budget", "timeline"], active: true, isInitial: false, automationTriggers: [] },
  { id: "site-visit", name: "Site visit", kind: "open", tone: "blue", followUpDays: 1, defaultNextAction: "Complete the visit and record requirements", requiredFields: ["location"], active: true, isInitial: false, automationTriggers: [] },
  { id: "proposal-preparation", name: "Proposal preparation", kind: "open", tone: "gold", followUpDays: 2, defaultNextAction: "Prepare the estimate and scope", requiredFields: ["serviceType", "project", "budget"], active: true, isInitial: false, automationTriggers: [] },
  { id: "proposal-sent", name: "Proposal sent", kind: "open", tone: "gold", followUpDays: 2, defaultNextAction: "Follow up on the proposal", requiredFields: ["contact"], active: true, isInitial: false, automationTriggers: [] },
  { id: "negotiation", name: "Negotiation", kind: "open", tone: "blue", followUpDays: 2, defaultNextAction: "Resolve questions and revisions", requiredFields: ["nextAction"], active: true, isInitial: false, automationTriggers: [] },
  { id: "invoice-prepared", name: "Invoice prepared", kind: "open", tone: "gold", followUpDays: 2, defaultNextAction: "Follow up on invoice and agreement", requiredFields: ["contact"], active: true, isInitial: false, automationTriggers: ["invoice_saved"] },
  { id: "agreement-pending", name: "Agreement pending", kind: "open", tone: "gold", followUpDays: 2, defaultNextAction: "Get the final agreement signed", requiredFields: ["contact"], active: true, isInitial: false, automationTriggers: [] },
  { id: "awaiting-advance", name: "Awaiting advance", kind: "open", tone: "gold", followUpDays: 2, defaultNextAction: "Confirm the initial payment", requiredFields: ["agreementSigned"], active: true, isInitial: false, automationTriggers: [] },
  { id: "won", name: "Won / onboarding", kind: "won", tone: "green", followUpDays: null, defaultNextAction: "Start project onboarding", requiredFields: ["agreementSigned", "advanceConfirmed"], active: true, isInitial: false, automationTriggers: ["receipt_saved"] },
  { id: "nurture", name: "Nurture", kind: "nurture", tone: "stone", followUpDays: 30, defaultNextAction: "Revisit this lead", requiredFields: [], active: true, isInitial: false, automationTriggers: [] },
  { id: "lost", name: "Lost", kind: "lost", tone: "red", followUpDays: null, defaultNextAction: "No further action required", requiredFields: ["lostReason"], active: true, isInitial: false, automationTriggers: [] },
  { id: "disqualified", name: "Disqualified", kind: "disqualified", tone: "red", followUpDays: null, defaultNextAction: "No further action required", requiredFields: ["lostReason"], active: true, isInitial: false, automationTriggers: [] },
];

const VALID_KINDS: PipelineStageKind[] = ["open", "nurture", "won", "lost", "disqualified"];
const VALID_TONES: PipelineTone[] = ["gold", "blue", "green", "red", "stone"];
const VALID_AUTOMATION_TRIGGERS: PipelineAutomationTrigger[] = ["invoice_saved", "receipt_saved"];
const VALID_FIELDS = PIPELINE_FIELD_OPTIONS.map((field) => field.key);
const MAX_FOLLOW_UP_DAYS = 365;

export function isSalesPipelineStageList(value: unknown): value is SalesPipelineStage[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > 30) return false;
  const stages = value as unknown[];
  const ids = new Set<string>();
  const names = new Set<string>();
  let activeInitialCount = 0;
  let activeOpenCount = 0;
  let activeWonCount = 0;
  let activeLossCount = 0;
  const assignedTriggers = new Set<PipelineAutomationTrigger>();

  for (const item of stages) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const stage = item as Partial<SalesPipelineStage>;
    if (
      typeof stage.id !== "string" || !stage.id.trim() || stage.id.length > 100 ||
      typeof stage.name !== "string" || !stage.name.trim() || stage.name.length > 70 ||
      !stage.kind || !VALID_KINDS.includes(stage.kind) ||
      !stage.tone || !VALID_TONES.includes(stage.tone) ||
      !(stage.followUpDays === null || (typeof stage.followUpDays === "number" && Number.isInteger(stage.followUpDays) && stage.followUpDays >= 0 && stage.followUpDays <= MAX_FOLLOW_UP_DAYS)) ||
      typeof stage.defaultNextAction !== "string" || stage.defaultNextAction.length > 180 ||
      !Array.isArray(stage.requiredFields) || !stage.requiredFields.every((field) => typeof field === "string" && VALID_FIELDS.includes(field as PipelineField)) ||
      typeof stage.active !== "boolean" || typeof stage.isInitial !== "boolean" ||
      (stage.automationTriggers !== undefined && (!Array.isArray(stage.automationTriggers) || !stage.automationTriggers.every((trigger) => typeof trigger === "string" && VALID_AUTOMATION_TRIGGERS.includes(trigger as PipelineAutomationTrigger))))
    ) return false;

    const normalizedName = stage.name.trim().toLocaleLowerCase();
    if (ids.has(stage.id) || names.has(normalizedName)) return false;
    ids.add(stage.id);
    names.add(normalizedName);
    for (const trigger of stage.automationTriggers || []) {
      if (assignedTriggers.has(trigger)) return false;
      assignedTriggers.add(trigger);
    }
    if (stage.active && stage.isInitial && stage.kind === "open") activeInitialCount += 1;
    if (stage.active && stage.kind === "open") activeOpenCount += 1;
    if (stage.active && stage.kind === "won") activeWonCount += 1;
    if (stage.active && (stage.kind === "lost" || stage.kind === "disqualified")) activeLossCount += 1;
  }

  return activeInitialCount === 1 && activeOpenCount >= 1 && activeWonCount >= 1 && activeLossCount >= 1;
}

export function normalizeSalesPipeline(value: unknown): SalesPipelineStage[] {
  const source = isSalesPipelineStageList(value)
    ? value.map((stage) => ({
        ...stage,
        name: stage.name.trim(),
        requiredFields: [...new Set(stage.requiredFields)],
        automationTriggers: Array.isArray(stage.automationTriggers) ? [...new Set(stage.automationTriggers)] : [],
      }))
    : DEFAULT_SALES_PIPELINE.map((stage) => ({
        ...stage,
        requiredFields: [...stage.requiredFields],
        automationTriggers: [...stage.automationTriggers],
      }));

  const pipeline = [...source];
  const invoiceStageExists = pipeline.some((stage) => stage.id === "invoice-prepared" || stage.name.toLocaleLowerCase() === "invoice prepared");
  if (!invoiceStageExists) {
    const template = DEFAULT_SALES_PIPELINE.find((stage) => stage.id === "invoice-prepared")!;
    const insertAt = pipeline.findIndex((stage) => stage.kind === "won" || stage.kind === "nurture" || stage.kind === "lost" || stage.kind === "disqualified");
    pipeline.splice(insertAt < 0 ? pipeline.length : insertAt, 0, { ...template, requiredFields: [...template.requiredFields], automationTriggers: [] });
  }

  if (!pipeline.some((stage) => stage.automationTriggers.includes("invoice_saved"))) {
    const invoiceStage = pipeline.find((stage) => stage.id === "invoice-prepared" || stage.name.toLocaleLowerCase() === "invoice prepared");
    if (invoiceStage) invoiceStage.automationTriggers = [...invoiceStage.automationTriggers, "invoice_saved"];
  }
  if (!pipeline.some((stage) => stage.automationTriggers.includes("receipt_saved"))) {
    const wonStage = pipeline.find((stage) => stage.kind === "won" && stage.active);
    if (wonStage) wonStage.automationTriggers = [...wonStage.automationTriggers, "receipt_saved"];
  }

  return pipeline;
}
