export type PipelineStageKind = "open" | "nurture" | "won" | "lost" | "disqualified";
export type PipelineTone = "gold" | "blue" | "green" | "red" | "stone";
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
  { id: "new-enquiry", name: "New enquiry", kind: "open", tone: "gold", followUpDays: 0, defaultNextAction: "Make first contact", requiredFields: ["name", "contact", "project"], active: true, isInitial: true },
  { id: "contacted", name: "Contacted", kind: "open", tone: "blue", followUpDays: 1, defaultNextAction: "Confirm qualification details", requiredFields: ["contact", "nextAction"], active: true, isInitial: false },
  { id: "qualified", name: "Qualified", kind: "open", tone: "blue", followUpDays: 1, defaultNextAction: "Book a consultation or site visit", requiredFields: ["serviceType", "location", "budget", "timeline"], active: true, isInitial: false },
  { id: "site-visit", name: "Site visit", kind: "open", tone: "blue", followUpDays: 1, defaultNextAction: "Complete the visit and record requirements", requiredFields: ["location"], active: true, isInitial: false },
  { id: "proposal-preparation", name: "Proposal preparation", kind: "open", tone: "gold", followUpDays: 2, defaultNextAction: "Prepare the estimate and scope", requiredFields: ["serviceType", "project", "budget"], active: true, isInitial: false },
  { id: "proposal-sent", name: "Proposal sent", kind: "open", tone: "gold", followUpDays: 2, defaultNextAction: "Follow up on the proposal", requiredFields: ["contact"], active: true, isInitial: false },
  { id: "negotiation", name: "Negotiation", kind: "open", tone: "blue", followUpDays: 2, defaultNextAction: "Resolve questions and revisions", requiredFields: ["nextAction"], active: true, isInitial: false },
  { id: "agreement-pending", name: "Agreement pending", kind: "open", tone: "gold", followUpDays: 2, defaultNextAction: "Get the final agreement signed", requiredFields: ["contact"], active: true, isInitial: false },
  { id: "awaiting-advance", name: "Awaiting advance", kind: "open", tone: "gold", followUpDays: 2, defaultNextAction: "Confirm the initial payment", requiredFields: ["agreementSigned"], active: true, isInitial: false },
  { id: "won", name: "Won / onboarding", kind: "won", tone: "green", followUpDays: null, defaultNextAction: "Start project onboarding", requiredFields: ["agreementSigned", "advanceConfirmed"], active: true, isInitial: false },
  { id: "nurture", name: "Nurture", kind: "nurture", tone: "stone", followUpDays: 30, defaultNextAction: "Revisit this lead", requiredFields: [], active: true, isInitial: false },
  { id: "lost", name: "Lost", kind: "lost", tone: "red", followUpDays: null, defaultNextAction: "No further action required", requiredFields: ["lostReason"], active: true, isInitial: false },
  { id: "disqualified", name: "Disqualified", kind: "disqualified", tone: "red", followUpDays: null, defaultNextAction: "No further action required", requiredFields: ["lostReason"], active: true, isInitial: false },
];

const VALID_KINDS: PipelineStageKind[] = ["open", "nurture", "won", "lost", "disqualified"];
const VALID_TONES: PipelineTone[] = ["gold", "blue", "green", "red", "stone"];
const VALID_FIELDS = PIPELINE_FIELD_OPTIONS.map((field) => field.key);
const MAX_FOLLOW_UP_DAYS = 365;

export function isSalesPipelineStageList(value: unknown): value is SalesPipelineStage[] {
  if (!Array.isArray(value) || value.length < 2 || value.length > 30) return false;
  const stages = value as unknown[];
  const ids = new Set<string>();
  const names = new Set<string>();
  let activeInitialCount = 0;
  let activeOpenCount = 0;

  for (const item of stages) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    const stage = item as Partial<SalesPipelineStage>;
    if (
      typeof stage.id !== "string" || !stage.id.trim() || stage.id.length > 100 ||
      typeof stage.name !== "string" || !stage.name.trim() || stage.name.length > 70 ||
      !stage.kind || !VALID_KINDS.includes(stage.kind) ||
      !stage.tone || !VALID_TONES.includes(stage.tone) ||
      !(stage.followUpDays === null || (Number.isInteger(stage.followUpDays) && stage.followUpDays >= 0 && stage.followUpDays <= MAX_FOLLOW_UP_DAYS)) ||
      typeof stage.defaultNextAction !== "string" || stage.defaultNextAction.length > 180 ||
      !Array.isArray(stage.requiredFields) || !stage.requiredFields.every((field) => typeof field === "string" && VALID_FIELDS.includes(field as PipelineField)) ||
      typeof stage.active !== "boolean" || typeof stage.isInitial !== "boolean"
    ) return false;

    const normalizedName = stage.name.trim().toLocaleLowerCase();
    if (ids.has(stage.id) || names.has(normalizedName)) return false;
    ids.add(stage.id);
    names.add(normalizedName);
    if (stage.active && stage.isInitial && stage.kind === "open") activeInitialCount += 1;
    if (stage.active && stage.kind === "open") activeOpenCount += 1;
  }

  return activeInitialCount === 1 && activeOpenCount >= 1;
}

export function normalizeSalesPipeline(value: unknown): SalesPipelineStage[] {
  if (!isSalesPipelineStageList(value)) return DEFAULT_SALES_PIPELINE.map((stage) => ({ ...stage, requiredFields: [...stage.requiredFields] }));
  return value.map((stage) => ({
    ...stage,
    name: stage.name.trim(),
    requiredFields: [...new Set(stage.requiredFields)],
  }));
}
