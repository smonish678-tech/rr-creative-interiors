import { resolveCustomerIdentity, type CustomerRecord } from "@/lib/customer-matching";
import { loadOperationsWorkspace, type WorkspaceRecord } from "@/lib/workspace-store";
import {
  DEFAULT_CHECKLISTS,
  PROJECT_STAGES,
  calcQuote,
  createQuoteLine,
  defaultOperationsSettings,
  deriveMilestoneStatus,
  getPhase0Blockers,
  getStageTransitionGate,
  newId,
  nowIso,
  safeRecordId,
  type ChecklistItem,
  type OpsBundle,
  type OpsChecklist,
  type OpsCustomer,
  type OpsEvent,
  type OpsProject,
  type OpsTask,
  type OperationsSettings,
  type ProjectStage,
} from "@/lib/operations-model";
import {
  appendOpsEvent,
  createOpsRecord,
  getOpsRecord,
  loadOpsBundle,
  updateOpsRecord,
} from "@/lib/operations-store";

type CommandResult = { ok: true; result: Record<string, unknown> } | { ok: false; error: string; blockers?: string[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function text(value: unknown, max = 500): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function optionalText(value: unknown, max = 500): string {
  return text(value, max);
}

function recordField(record: WorkspaceRecord | undefined, field: string): string {
  const value = record?.[field];
  return typeof value === "string" ? value : "";
}

function actorName(): string {
  return process.env.ADMIN_EMAIL || "RR administrator";
}

function ensureValidStage(value: unknown): ProjectStage {
  if (typeof value !== "string" || !PROJECT_STAGES.includes(value as ProjectStage)) {
    throw new Error("Choose a valid project stage.");
  }
  return value as ProjectStage;
}

function matchableCustomer(customer: OpsCustomer): CustomerRecord {
  return {
    id: customer.id,
    name: customer.name,
    email: customer.emails[0] || "",
    phone: customer.phones[0] || "",
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
  };
}

function canonicalCustomerId(sourceId: string): string {
  return "customer_" + safeRecordId(sourceId);
}

function projectIdForLead(leadId: string): string {
  return "project_" + safeRecordId("lead:" + leadId);
}

function projectCodeFor(projectId: string): string {
  return "RR-PJ-" + safeRecordId(projectId).slice(0, 8).toUpperCase();
}

function eventInput(eventType: string, entityType: string, entityId: string, projectId: string, summary: string, idempotencyKey: string, payload: Record<string, unknown> = {}) {
  return {
    eventType, entityType, entityId, projectId, occurredAt: nowIso(), actor: actorName(),
    idempotencyKey, summary, payload,
  };
}

async function recordEvent(eventType: string, entityType: string, entityId: string, projectId: string, summary: string, key: string, payload: Record<string, unknown> = {}) {
  return appendOpsEvent(eventInput(eventType, entityType, entityId, projectId, summary, key, payload));
}

function makeTask(projectId: string, category: OpsTask["category"], title: string, dueDate = "", blocksStage: ProjectStage | "" = ""): OpsTask {
  const now = nowIso();
  const dedupeKey = category + ":" + title.toLocaleLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 70);
  return {
    id: "task_" + safeRecordId(projectId + ":" + dedupeKey),
    projectId, category, title, description: "", owner: actorName(), dueDate,
    status: "open", priority: "normal", blocksStage, blockerReason: "", sourceEventId: "",
    dedupeKey, completedAt: "", createdAt: now, updatedAt: now,
  };
}

function makeChecklist(projectId: string, template: (typeof DEFAULT_CHECKLISTS)[number]): OpsChecklist {
  const now = nowIso();
  const items: ChecklistItem[] = template.items.map((label, index) => ({
    id: "item_" + safeRecordId(projectId + ":" + template.category + ":" + index + ":" + label),
    label, required: true, status: "not-started", note: "", evidenceFileName: "", evidenceUrl: "",
    completedAt: "", completedBy: "",
  }));
  return {
    id: "check_" + safeRecordId(projectId + ":" + template.category),
    projectId, category: template.category, title: template.title, status: "not-started", items,
    signedOffBy: "", signedOffAt: "", signOffNote: "", createdAt: now, updatedAt: now,
  };
}

async function ensureProjectScaffolding(project: OpsProject) {
  for (const template of DEFAULT_CHECKLISTS) {
    const checklist = makeChecklist(project.id, template);
    try {
      await createOpsRecord("checklists", checklist);
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("already exists")) throw error;
    }
  }
  const tasks = [
    makeTask(project.id, "booking", "Complete booking form and capture client acknowledgement", "", "design"),
    makeTask(project.id, "finance", "Verify booking advance and allocate it to the correct milestone", "", "design"),
    makeTask(project.id, "design", "Arrange site measurement and design brief", "", "design"),
  ];
  for (const task of tasks) {
    try {
      await createOpsRecord("tasks", task);
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("already exists")) throw error;
    }
  }
}

async function getOrCreateCustomerFromLead(
  lead: WorkspaceRecord,
  legacyClients: WorkspaceRecord[],
  bundle: OpsBundle,
): Promise<{ customer: OpsCustomer; conflict: boolean }> {
  const leadId = recordField(lead, "id");
  const legacyClientId = recordField(lead, "clientId");
  const existingByLegacy = legacyClientId
    ? bundle.customers.find((item) => item.legacyClientId === legacyClientId || item.id === canonicalCustomerId(legacyClientId))
    : undefined;
  if (existingByLegacy) return { customer: existingByLegacy, conflict: existingByLegacy.identityReviewRequired };

  const legacyClient = legacyClientId ? legacyClients.find((item) => recordField(item, "id") === legacyClientId) : undefined;
  const name = recordField(legacyClient, "name") || recordField(lead, "name") || "Unnamed customer";
  const email = recordField(legacyClient, "email") || recordField(lead, "email");
  const phone = recordField(legacyClient, "phone") || recordField(lead, "phone");
  const converted = bundle.customers.map(matchableCustomer);
  const match = resolveCustomerIdentity(converted, email, phone);
  if (match.status === "matched") {
    const customer = bundle.customers.find((item) => item.id === match.customer.id);
    if (customer) return { customer, conflict: customer.identityReviewRequired };
  }

  const now = nowIso();
  const baseId = legacyClientId || leadId;
  const customer: OpsCustomer = {
    id: canonicalCustomerId(baseId),
    legacyClientId: legacyClientId || undefined,
    name,
    emails: email ? [email] : [],
    phones: phone ? [phone] : [],
    billingAddress: recordField(legacyClient, "address") || recordField(lead, "location"),
    gstin: "",
    pan: "",
    identityReviewRequired: match.status === "conflict",
    identityReviewReason: match.status === "conflict" ? match.reason : "",
    createdAt: now,
    updatedAt: now,
  };
  try {
    await createOpsRecord("customers", customer);
    await recordEvent("customer.created-from-legacy-crm", "customer", customer.id, "", "Customer record linked from the existing CRM", "customer-import:" + customer.id, { legacyClientId: customer.legacyClientId || "", leadId });
    return { customer, conflict: customer.identityReviewRequired };
  } catch (error) {
    const latest = await getOpsRecord<OpsCustomer>("customers", customer.id);
    if (latest) return { customer: latest, conflict: latest.identityReviewRequired };
    throw error;
  }
}

async function convertLeadToProject(leadId: string) {
  const workspace = await loadOperationsWorkspace({ includePublicEnquiries: true });
  const lead = workspace.leads.find((item) => recordField(item, "id") === leadId);
  if (!lead) throw new Error("That CRM lead could not be found. Refresh the CRM and try again.");
  const bundle = await loadOpsBundle();
  const existing = bundle.projects.find((project) => project.sourceLeadId === leadId);
  if (existing) return { project: existing, duplicate: true, blockers: getStageTransitionGate(existing, existing.stage, bundle).blockers };

  const { customer, conflict } = await getOrCreateCustomerFromLead(lead, workspace.clients, bundle);
  const now = nowIso();
  const projectId = projectIdForLead(leadId);
  const project: OpsProject = {
    id: projectId,
    projectCode: projectCodeFor(projectId),
    sourceLeadId: leadId,
    customerId: customer.id,
    title: recordField(lead, "project") || (recordField(lead, "serviceType") + " project").trim() || "Interior project",
    serviceType: recordField(lead, "serviceType"),
    propertyAddress: recordField(lead, "location"),
    apartmentNumber: "",
    floorNumber: "",
    approximateArea: recordField(lead, "area"),
    possessionDate: "",
    stage: "booking",
    previousStage: "",
    createdAt: now,
    updatedAt: now,
    nextAction: "Prepare booking form and verify booking payment",
    nextActionDue: "",
    targetHandoverDate: "",
    stageEnteredAt: now,
    holdReason: "",
    cancelledReason: "",
    legacyInvoiceIds: workspace.invoices.filter((invoice) => recordField(invoice, "leadId") === leadId).map((invoice) => recordField(invoice, "id")),
  };
  try {
    await createOpsRecord("projects", project);
  } catch (error) {
    const latest = await getOpsRecord<OpsProject>("projects", projectId);
    if (latest && latest.sourceLeadId === leadId) return { project: latest, duplicate: true, blockers: [] };
    throw error;
  }
  await ensureProjectScaffolding(project);
  await recordEvent("project.created-from-lead", "project", project.id, project.id, "CRM lead converted into a project exactly once", "project-from-lead:" + leadId, { leadId, customerId: customer.id, identityReviewRequired: conflict });
  return {
    project,
    duplicate: false,
    blockers: conflict ? ["Customer contact details conflicted with an existing record. Review customer identity before issuing client documents."] : [],
  };
}

async function createCustomer(input: Record<string, unknown>) {
  const name = text(input.name, 140);
  const email = text(input.email, 254).toLowerCase();
  const phone = text(input.phone, 40);
  if (name.length < 2) throw new Error("Enter the customer's full name or organisation name.");
  if (!email && !phone) throw new Error("Enter at least one contact identifier (phone or email). Names alone are never used to merge customers.");
  const bundle = await loadOpsBundle();
  const match = resolveCustomerIdentity(bundle.customers.map(matchableCustomer), email, phone);
  if (match.status === "matched") return { customer: bundle.customers.find((item) => item.id === match.customer.id), existing: true };
  const now = nowIso();
  const customer: OpsCustomer = {
    id: newId("customer"),
    name, emails: email ? [email] : [], phones: phone ? [phone] : [],
    billingAddress: text(input.billingAddress, 1000), gstin: text(input.gstin, 20), pan: text(input.pan, 20),
    identityReviewRequired: match.status === "conflict",
    identityReviewReason: match.status === "conflict" ? match.reason : "",
    createdAt: now, updatedAt: now,
  };
  await createOpsRecord("customers", customer);
  await recordEvent("customer.created", "customer", customer.id, "", "Customer created in Project Operations", "customer-created:" + customer.id, { identityReviewRequired: customer.identityReviewRequired });
  return { customer, existing: false };
}

async function createManualProject(input: Record<string, unknown>) {
  const customerId = text(input.customerId, 200);
  const title = text(input.title, 180);
  if (!customerId) throw new Error("Select an existing customer.");
  if (!title) throw new Error("Enter a project name.");
  const bundle = await loadOpsBundle();
  const customer = bundle.customers.find((item) => item.id === customerId);
  if (!customer) throw new Error("Customer record not found. Refresh and select the customer again.");
  const now = nowIso();
  const projectId = newId("project");
  const project: OpsProject = {
    id: projectId, projectCode: projectCodeFor(projectId), customerId,
    title, serviceType: text(input.serviceType, 100), propertyAddress: text(input.propertyAddress, 1200),
    apartmentNumber: text(input.apartmentNumber, 80), floorNumber: text(input.floorNumber, 80),
    approximateArea: text(input.approximateArea, 80), possessionDate: text(input.possessionDate, 30),
    stage: "booking", previousStage: "", createdAt: now, updatedAt: now, stageEnteredAt: now,
    nextAction: "Prepare booking form and verify booking payment", nextActionDue: "",
    targetHandoverDate: text(input.targetHandoverDate, 30), holdReason: "", cancelledReason: "", legacyInvoiceIds: [],
  };
  await createOpsRecord("projects", project);
  await ensureProjectScaffolding(project);
  await recordEvent("project.created", "project", project.id, project.id, "Project created from an existing customer", "project-created:" + project.id, { customerId });
  return { project, duplicate: false, blockers: [] };
}

async function updateProject(input: Record<string, unknown>) {
  const projectId = text(input.projectId, 200);
  const expectedUpdatedAt = text(input.expectedUpdatedAt, 40);
  const current = await getOpsRecord<OpsProject>("projects", projectId);
  if (!current) throw new Error("Project not found. Refresh the operations workspace.");
  const patch = isRecord(input.patch) ? input.patch : {};
  const allowed = ["title", "serviceType", "propertyAddress", "apartmentNumber", "floorNumber", "approximateArea", "possessionDate", "nextAction", "nextActionDue", "targetHandoverDate", "holdReason"] as const;
  const updated = { ...current } as OpsProject;
  for (const field of allowed) {
    if (typeof patch[field] === "string") (updated as unknown as Record<string, unknown>)[field] = text(patch[field], field === "propertyAddress" ? 1200 : 500);
  }
  updated.updatedAt = nowIso();
  await updateOpsRecord("projects", updated, expectedUpdatedAt || undefined);
  await recordEvent("project.updated", "project", projectId, projectId, "Project details updated", "project-updated:" + projectId + ":" + updated.updatedAt, { changedFields: allowed.filter((field) => patch[field] !== undefined) as unknown as Record<string, unknown> });
  return { project: updated };
}

async function transitionProject(input: Record<string, unknown>) {
  const projectId = text(input.projectId, 200);
  const target = ensureValidStage(input.targetStage);
  const expectedUpdatedAt = text(input.expectedUpdatedAt, 40);
  const current = await getOpsRecord<OpsProject>("projects", projectId);
  if (!current) throw new Error("Project not found. Refresh the operations workspace.");
  const bundle = await loadOpsBundle();
  bundle.milestones = bundle.milestones.map((item) => ({ ...item, status: deriveMilestoneStatus(item, bundle.transactions) }));
  const gate = getStageTransitionGate(current, target, bundle);
  if (!gate.allowed) return { blocked: true, blockers: gate.blockers, project: current };
  const now = nowIso();
  const updated: OpsProject = {
    ...current,
    previousStage: target === "on-hold" ? current.stage : current.stage === "on-hold" ? "" : current.previousStage,
    stage: target,
    holdReason: target === "on-hold" ? text(input.reason, 1000) : "",
    updatedAt: now,
    stageEnteredAt: now,
    nextAction: target === "design" ? "Complete design brief and site measurements"
      : target === "design-signoff" ? "Prepare design approval and final quotation"
      : target === "production" ? "Complete procurement and production quality checks"
      : target === "execution" ? "Confirm site readiness and installation slot"
      : target === "handover" ? "Close snags and prepare handover packet"
      : target === "complete" ? "Maintain warranty records and close outstanding tasks"
      : target === "on-hold" ? "Resolve the recorded hold reason"
      : "Confirm design requirements and next steps",
  };
  await updateOpsRecord("projects", updated, expectedUpdatedAt || undefined);
  await recordEvent("project.stage-changed", "project", projectId, projectId, "Project stage changed to " + target, "project-stage:" + projectId + ":" + now, { previousStage: current.stage, targetStage: target, blockers: [] });
  return { blocked: false, blockers: [], project: updated };
}

async function createTask(input: Record<string, unknown>) {
  const projectId = text(input.projectId, 200);
  const bundle = await loadOpsBundle();
  if (!bundle.projects.some((project) => project.id === projectId)) throw new Error("Project not found.");
  const title = text(input.title, 200);
  if (!title) throw new Error("Enter a task title.");
  const category = text(input.category, 40) as OpsTask["category"];
  const allowedCategories: OpsTask["category"][] = ["sales","booking","design","procurement","production","quality","dispatch","site-readiness","installation","snag","handover","warranty","finance","communication","admin"];
  if (!allowedCategories.includes(category)) throw new Error("Choose a valid task category.");
  const now = nowIso();
  const task: OpsTask = {
    id: newId("task"), projectId, category, title, description: text(input.description, 1500),
    owner: text(input.owner, 140) || actorName(), dueDate: text(input.dueDate, 30),
    status: "open", priority: (["low","normal","high","critical"].includes(text(input.priority, 20)) ? text(input.priority, 20) : "normal") as OpsTask["priority"],
    blocksStage: input.blocksStage ? ensureValidStage(input.blocksStage) : "",
    blockerReason: "", sourceEventId: "", dedupeKey: "manual:" + newId("dedupe"), completedAt: "",
    createdAt: now, updatedAt: now,
  };
  await createOpsRecord("tasks", task);
  await recordEvent("task.created", "task", task.id, projectId, "Task created: " + title, "task-created:" + task.id, { category, dueDate: task.dueDate });
  return { task };
}

async function updateTask(input: Record<string, unknown>) {
  const taskId = text(input.taskId, 200);
  const current = await getOpsRecord<OpsTask>("tasks", taskId);
  if (!current) throw new Error("Task not found. Refresh the project.");
  const patch = isRecord(input.patch) ? input.patch : {};
  const allowedStatus: OpsTask["status"][] = ["open","in-progress","blocked","done","cancelled"];
  if (patch.status !== undefined && (typeof patch.status !== "string" || !allowedStatus.includes(patch.status as OpsTask["status"]))) throw new Error("Choose a valid task status.");
  const updated: OpsTask = {
    ...current,
    status: (patch.status as OpsTask["status"]) || current.status,
    owner: typeof patch.owner === "string" ? text(patch.owner, 140) : current.owner,
    dueDate: typeof patch.dueDate === "string" ? text(patch.dueDate, 30) : current.dueDate,
    blockerReason: typeof patch.blockerReason === "string" ? text(patch.blockerReason, 1000) : current.blockerReason,
    completedAt: patch.status === "done" ? nowIso() : patch.status && patch.status !== "done" ? "" : current.completedAt,
    updatedAt: nowIso(),
  };
  await updateOpsRecord("tasks", updated, text(input.expectedUpdatedAt, 40) || undefined);
  await recordEvent("task.updated", "task", taskId, current.projectId, "Task updated: " + current.title, "task-updated:" + taskId + ":" + updated.updatedAt, { status: updated.status, blockerReason: updated.blockerReason });
  return { task: updated };
}

export async function runOperationsCommand(input: Record<string, unknown>): Promise<CommandResult> {
  try {
    const command = text(input.command, 80);
    if (command === "convert-lead") {
      const result = await convertLeadToProject(text(input.leadId, 200));
      return { ok: true, result: result as unknown as Record<string, unknown> };
    }
    if (command === "create-customer") return { ok: true, result: await createCustomer(input) as unknown as Record<string, unknown> };
    if (command === "create-project") return { ok: true, result: await createManualProject(input) as unknown as Record<string, unknown> };
    if (command === "update-project") return { ok: true, result: await updateProject(input) as unknown as Record<string, unknown> };
    if (command === "transition-project") {
      const result = await transitionProject(input);
      return { ok: true, result: result as unknown as Record<string, unknown> };
    }
    if (command === "create-task") return { ok: true, result: await createTask(input) as unknown as Record<string, unknown> };
    if (command === "update-task") return { ok: true, result: await updateTask(input) as unknown as Record<string, unknown> };
    throw new Error("This operations action is not available.");
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "The operations action failed." };
  }
}

export function phase0Checklist(settings: OperationsSettings) {
  return [
    { key: "companyProfileApproved", label: "Company identity and GSTIN", complete: settings.companyProfileApproved, detail: settings.companyLegalName || "Company legal name not confirmed" },
    { key: "taxConfigApproved", label: "CA-approved tax and invoice policy", complete: settings.taxConfigApproved, detail: settings.defaultTaxRate === null ? "Tax treatment not configured" : "Default tax rate: " + settings.defaultTaxRate + "%" },
    { key: "paymentScheduleApproved", label: "Approved payment milestones", complete: settings.paymentScheduleApproved, detail: settings.paymentStages.length ? settings.paymentStages.length + " milestones configured" : "No payment schedule has been approved" },
    { key: "deliveryPolicyApproved", label: "Delivery clock and grace period", complete: settings.deliveryPolicyApproved, detail: settings.deliveryDays === null ? "Delivery timing not configured" : String(settings.deliveryDays) + " " + (settings.deliveryDayType || "days") },
    { key: "contractTemplateApproved", label: "Approved booking and works-contract text", complete: settings.contractTemplateApproved, detail: settings.cancellationTermsVersion || "Contract wording not approved" },
    { key: "warrantyPolicyApproved", label: "Approved warranty terms", complete: settings.warrantyPolicyApproved, detail: settings.warrantyJoineryYears === null ? "Warranty period not configured" : String(settings.warrantyJoineryYears) + " years" },
  ];
}
