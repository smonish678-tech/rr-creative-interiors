import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { get, list, put } from "@vercel/blob";
import { DEFAULT_SALES_PIPELINE, normalizeSalesPipeline, type SalesPipelineStage } from "@/lib/sales-pipeline";
import { resolveCustomerIdentity, type CustomerRecord } from "@/lib/customer-matching";

export type WorkspaceRecord = Record<string, unknown>;

export type OperationsWorkspace = {
  leads: WorkspaceRecord[];
  invoices: WorkspaceRecord[];
  clients: WorkspaceRecord[];
  properties: WorkspaceRecord[];
  projects: WorkspaceRecord[];
  documents: WorkspaceRecord[];
  auditEvents: WorkspaceRecord[];
  commercialPolicies: WorkspaceRecord[];
  studioName: string;
  studioEmail: string;
  pipelineStages: SalesPipelineStage[];
};

export type OperationsWorkspaceSnapshot = {
  workspace: OperationsWorkspace;
  revision: string | null;
};

/** A conditional write failed because another session committed first. */
export class WorkspaceConflictError extends Error {
  constructor(message = "The operations workspace changed in another session. Refresh the workspace and review the latest records before saving again.") {
    super(message);
    this.name = "WorkspaceConflictError";
  }
}

const WORKSPACE_PATH = "rr-creative-interiors/workspace/operations.enc";
const PUBLIC_ENQUIRY_PREFIX = "rr-creative-interiors/public-enquiries/";

export type PublicEnquiryInboxRecord = {
  submissionId: string;
  receivedAt: string;
  name: string;
  phone: string;
  email: string;
  serviceType: string;
  budget: string;
  message: string;
};

function storageToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error("Workspace storage is not configured. Connect a Vercel Blob store to this project.");
  }
  return token;
}

function encryptionKey(token: string): Buffer {
  return createHash("sha256")
    .update(`rr-creative-interiors:operations-workspace:v1:${token}`, "utf8")
    .digest();
}

function encryptValue(value: unknown, token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(token), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return JSON.stringify({ version: 1, iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: ciphertext.toString("base64") });
}

function encryptWorkspace(workspace: OperationsWorkspace, token: string): string {
  return encryptValue(workspace, token);
}

function decryptValue(serialized: string, token: string): unknown {
  const envelope: unknown = JSON.parse(serialized);
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) throw new Error("Stored record has an invalid format.");
  const item = envelope as { version?: unknown; iv?: unknown; tag?: unknown; data?: unknown };
  if (item.version !== 1 || typeof item.iv !== "string" || typeof item.tag !== "string" || typeof item.data !== "string") {
    throw new Error("Stored record version is not supported.");
  }
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(token), Buffer.from(item.iv, "base64"));
  decipher.setAuthTag(Buffer.from(item.tag, "base64"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(item.data, "base64")), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8")) as unknown;
}

function decryptWorkspace(serialized: string, token: string): OperationsWorkspace {
  const value = decryptValue(serialized, token);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Stored workspace has an invalid format.");
  const data = value as Partial<OperationsWorkspace>;
  return {
    leads: Array.isArray(data.leads) ? data.leads.filter(isRecord) : [],
    invoices: Array.isArray(data.invoices) ? data.invoices.filter(isRecord) : [],
    clients: Array.isArray(data.clients) ? data.clients.filter(isRecord) : [],
    properties: Array.isArray(data.properties) ? data.properties.filter(isRecord) : [],
    projects: Array.isArray(data.projects) ? data.projects.filter(isRecord) : [],
    documents: Array.isArray(data.documents) ? data.documents.filter(isRecord) : [],
    auditEvents: Array.isArray(data.auditEvents) ? data.auditEvents.filter(isRecord) : [],
    commercialPolicies: Array.isArray(data.commercialPolicies) ? data.commercialPolicies.filter(isRecord) : [],
    studioName: typeof data.studioName === "string" ? data.studioName : "RR Creative Interiors",
    studioEmail: typeof data.studioEmail === "string" ? data.studioEmail : "accounts@rrcreativeinteriors.in",
    pipelineStages: normalizeSalesPipeline(data.pipelineStages),
  };
}

function isRecord(value: unknown): value is WorkspaceRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isPublicEnquiryInboxRecord(value: unknown): value is PublicEnquiryInboxRecord {
  if (!isRecord(value)) return false;
  return typeof value.submissionId === "string" && /^[0-9a-f-]{36}$/i.test(value.submissionId) &&
    typeof value.receivedAt === "string" && typeof value.name === "string" && typeof value.phone === "string" &&
    typeof value.email === "string" && typeof value.serviceType === "string" && typeof value.budget === "string" &&
    typeof value.message === "string";
}

async function readPublicEnquiry(blob: { url: string }, token: string): Promise<PublicEnquiryInboxRecord | null> {
  const response = await get(blob.url, { access: "public", token, useCache: false });
  if (!response || response.statusCode !== 200) return null;
  const value = decryptValue(await new Response(response.stream).text(), token);
  return isPublicEnquiryInboxRecord(value) ? value : null;
}

async function listAllBlobs(prefix: string, token: string) {
  const blobs: Array<{ pathname: string; url: string }> = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, token, ...(cursor ? { cursor } : {}) });
    blobs.push(...page.blobs);
    cursor = page.cursor || undefined;
  } while (cursor && blobs.length < 10000);
  return blobs;
}

export async function savePublicEnquiryInbox(record: PublicEnquiryInboxRecord): Promise<"saved" | "duplicate"> {
  const token = storageToken();
  const pathname = `${PUBLIC_ENQUIRY_PREFIX}${record.submissionId}.enc`;
  const existing = (await list({ prefix: pathname, token })).blobs.find((blob) => blob.pathname === pathname);
  if (existing) {
    const previous = await readPublicEnquiry(existing, token);
    if (previous && previous.submissionId === record.submissionId &&
      previous.name === record.name && previous.phone === record.phone && previous.email === record.email &&
      previous.serviceType === record.serviceType && previous.budget === record.budget && previous.message === record.message) {
      return "duplicate";
    }
    throw new Error("This enquiry submission reference has already been used. Refresh the form and try again.");
  }
  try {
    await put(pathname, encryptValue(record, token), {
      access: "public", token, contentType: "application/octet-stream", addRandomSuffix: false, allowOverwrite: false,
    });
    return "saved";
  } catch (error) {
    const raced = (await list({ prefix: pathname, token })).blobs.find((blob) => blob.pathname === pathname);
    if (raced) {
      const previous = await readPublicEnquiry(raced, token);
      if (previous && previous.submissionId === record.submissionId && previous.name === record.name && previous.phone === record.phone &&
        previous.email === record.email && previous.serviceType === record.serviceType && previous.budget === record.budget && previous.message === record.message) return "duplicate";
    }
    throw error;
  }
}

function dateWithOffset(start: string, days: number | null): string {
  if (days === null) return "";
  const date = new Date(start);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function appendPublicEnquiryLeads(workspace: OperationsWorkspace, records: PublicEnquiryInboxRecord[]): OperationsWorkspace {
  if (!records.length) return workspace;
  const leads = [...workspace.leads];
  const customers = workspace.clients.map((item) => ({
    id: typeof item.id === "string" ? item.id : "",
    name: typeof item.name === "string" ? item.name : "",
    email: typeof item.email === "string" ? item.email : "",
    phone: typeof item.phone === "string" ? item.phone : "",
    createdAt: typeof item.createdAt === "string" ? item.createdAt : "",
    updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : "",
  })).filter((item) => item.id && item.name) as CustomerRecord[];
  const pipeline = normalizeSalesPipeline(workspace.pipelineStages);
  const initialStage = pipeline.find((stage) => stage.active && stage.isInitial && stage.kind === "open") ||
    pipeline.find((stage) => stage.active && stage.kind === "open") || DEFAULT_SALES_PIPELINE[0];
  const knownSubmissions = new Set(leads.map((lead) => typeof lead.publicSubmissionId === "string" ? lead.publicSubmissionId : "").filter(Boolean));
  const pending = records.filter((record) => !knownSubmissions.has(record.submissionId)).sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));

  for (const record of pending) {
    const shortId = record.submissionId.replace(/-/g, "").slice(0, 16).toUpperCase();
    const leadId = `LD-WEB-${shortId}`;
    if (leads.some((lead) => lead.id === leadId)) continue;
    const match = resolveCustomerIdentity(customers, record.email, record.phone);
    let customer: CustomerRecord;
    let identityWarning = "";
    if (match.status === "matched") {
      customer = match.customer;
      const index = customers.findIndex((item) => item.id === customer.id);
      if (index >= 0) {
        const refreshed = { ...customer, email: customer.email || record.email, phone: customer.phone || record.phone, updatedAt: record.receivedAt };
        customers[index] = refreshed;
        customer = refreshed;
      }
      if (record.name.trim().toLocaleLowerCase() !== customer.name.trim().toLocaleLowerCase()) {
        identityWarning = `Name supplied on the website enquiry: ${record.name}. The existing customer name was retained because the contact matched by ${match.matchedBy}.\n\n`;
      }
    } else {
      if (match.status === "conflict") identityWarning = "Potential customer-identity conflict: the contact details match different or inconsistent existing customer records. This enquiry was kept as a separate customer for manual review.\n\n";
      let customerId = `CL-WEB-${shortId}`;
      let suffix = 2;
      while (customers.some((item) => item.id === customerId)) customerId = `CL-WEB-${shortId}-${suffix++}`;
      customer = { id: customerId, name: record.name, email: record.email, phone: record.phone, createdAt: record.receivedAt, updatedAt: record.receivedAt };
      customers.push(customer);
    }
    const summary = record.message.replace(/\s+/g, " ").trim();
    const shortSummary = summary.length > 88 ? `${summary.slice(0, 85).trimEnd()}…` : summary;
    const project = `${record.serviceType || "Website enquiry"} — ${shortSummary}`.slice(0, 160);
    const date = record.receivedAt.slice(0, 10);
    const lead = {
      id: leadId, clientId: customer.id, publicSubmissionId: record.submissionId, publicSubmissionReceivedAt: record.receivedAt,
      name: customer.name, email: customer.email || record.email, phone: customer.phone || record.phone,
      project, source: "Website enquiry", budget: record.budget, status: initialStage.name, stageId: initialStage.id,
      date, notes: `${identityWarning}${record.message}`, serviceType: record.serviceType, location: "", area: "", timeline: "",
      nextAction: initialStage.defaultNextAction || "Review new website enquiry", nextFollowUpDate: dateWithOffset(date, initialStage.followUpDays),
      lostReason: "", agreementStatus: "not-started", advanceStatus: "not-requested", advanceExceptionReason: "",
    };
    leads.unshift(lead);
    knownSubmissions.add(record.submissionId);
  }
  return { ...workspace, leads, clients: customers };
}

async function loadStoredWorkspace(token: string): Promise<OperationsWorkspaceSnapshot> {
  const result = await list({ prefix: WORKSPACE_PATH, token });
  const blob = result.blobs.find((item) => item.pathname === WORKSPACE_PATH);
  if (!blob) {
    return {
      revision: null,
      workspace: {
        leads: [], invoices: [], clients: [], properties: [], projects: [], documents: [], auditEvents: [], commercialPolicies: [],
        studioName: "RR Creative Interiors", studioEmail: "accounts@rrcreativeinteriors.in",
        pipelineStages: DEFAULT_SALES_PIPELINE.map((stage) => ({ ...stage, requiredFields: [...stage.requiredFields], automationTriggers: [...stage.automationTriggers] })),
      },
    };
  }
  if (typeof blob.etag !== "string" || !blob.etag) {
    throw new Error("Workspace storage did not return a revision token. Refusing to save without concurrency protection.");
  }
  const response = await get(blob.url, { access: "public", token, useCache: false });
  if (!response || response.statusCode !== 200) throw new Error("Could not load the encrypted operations workspace.");
  return { workspace: decryptWorkspace(await new Response(response.stream).text(), token), revision: blob.etag };
}

export async function loadOperationsWorkspaceSnapshot(options: { includePublicEnquiries?: boolean } = {}): Promise<OperationsWorkspaceSnapshot> {
  const token = storageToken();
  const snapshot = await loadStoredWorkspace(token);
  let workspace = snapshot.workspace;
  if (!options.includePublicEnquiries) return snapshot;

  const allInboxBlobs = await listAllBlobs(PUBLIC_ENQUIRY_PREFIX, token);
  const known = new Set(workspace.leads.map((lead) => typeof lead.publicSubmissionId === "string" ? lead.publicSubmissionId : "").filter(Boolean));
  const pendingBlobs = allInboxBlobs.filter((blobItem) => {
    const filename = blobItem.pathname.slice(PUBLIC_ENQUIRY_PREFIX.length).replace(/\.enc$/, "");
    return blobItem.pathname.endsWith(".enc") && /^[0-9a-f-]{36}$/i.test(filename) && !known.has(filename);
  });
  if (pendingBlobs.length) {
    const inboxRecords = (await Promise.all(pendingBlobs.map((item) => readPublicEnquiry(item, token)))).filter((item): item is PublicEnquiryInboxRecord => item !== null);
    workspace = appendPublicEnquiryLeads(workspace, inboxRecords);
  }
  return { workspace, revision: snapshot.revision };
}

export async function loadOperationsWorkspace(options: { includePublicEnquiries?: boolean } = {}): Promise<OperationsWorkspace> {
  return (await loadOperationsWorkspaceSnapshot(options)).workspace;
}

/**
 * Compare-and-swap save for the single encrypted workspace object.
 *
 * A missing revision means the caller observed an empty store; an existing
 * revision must match exactly. The Blob-side ifMatch precondition protects
 * the short interval between reading and writing. Conflicts are surfaced to
 * the UI and are never converted into a successful save.
 */
export async function saveOperationsWorkspace(workspace: OperationsWorkspace, expectedRevision: string | null): Promise<string> {
  const token = storageToken();
  const current = await loadStoredWorkspace(token);
  if (current.revision !== expectedRevision) throw new WorkspaceConflictError();

  try {
    const saved = await put(WORKSPACE_PATH, encryptWorkspace(workspace, token), {
      access: "public",
      token,
      contentType: "application/octet-stream",
      addRandomSuffix: false,
      allowOverwrite: Boolean(current.revision),
      ...(current.revision ? { ifMatch: current.revision } : {}),
    });
    if (typeof saved.etag !== "string" || !saved.etag) {
      throw new Error("Workspace write completed without a verifiable revision. Refresh the workspace before making further changes.");
    }
    return saved.etag;
  } catch (error) {
    if (error instanceof WorkspaceConflictError) throw error;
    const maybe = error as { status?: number; statusCode?: number; code?: string; name?: string; message?: string };
    if (maybe.status === 412 || maybe.statusCode === 412 || maybe.status === 409 || maybe.statusCode === 409 ||
      maybe.code === "BLOB_PRECONDITION_FAILED" || maybe.code === "BLOB_ALREADY_EXISTS" ||
      maybe.name === "BlobPreconditionFailedError" || maybe.name === "BlobAlreadyExistsError") {
      throw new WorkspaceConflictError();
    }
    throw error;
  }
}
