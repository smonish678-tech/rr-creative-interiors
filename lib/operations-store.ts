import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { get, list, put } from "@vercel/blob";
import {
  defaultOperationsSettings,
  safeRecordId,
  type OpsApproval,
  type OpsBundle,
  type OpsChecklist,
  type OpsCustomer,
  type OpsDocument,
  type OpsEvent,
  type OpsMessage,
  type OpsMilestone,
  type OpsProject,
  type OpsQuote,
  type OpsTask,
  type OpsTransaction,
  type OpsWarranty,
  type OpsWarrantyClaim,
  type OperationsSettings,
  type OpsBackup,
} from "@/lib/operations-model";

export type OpsCollection =
  | "customers" | "projects" | "quotes" | "milestones" | "transactions" | "documents"
  | "approvals" | "tasks" | "messages" | "checklists" | "warranties" | "warrantyClaims"
  | "settings" | "events" | "backups";

type OpsRecord = { id: string; createdAt?: string; updatedAt?: string };
const ROOT = "rr-creative-interiors/ops-v1";

function token(): string {
  const value = process.env.BLOB_READ_WRITE_TOKEN;
  if (!value) throw new Error("Operations storage is not configured. Connect the RR Vercel Blob store.");
  return value;
}

function keyFor(secret: string): Buffer {
  return createHash("sha256").update("rr-creative-interiors:operations-v1:" + secret, "utf8").digest();
}

function encrypt(value: unknown, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFor(secret), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return JSON.stringify({ v: 1, iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: data.toString("base64") });
}

function decrypt(serialized: string, secret: string): unknown {
  const envelope: unknown = JSON.parse(serialized);
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) throw new Error("An operations record has an invalid envelope.");
  const item = envelope as { v?: unknown; iv?: unknown; tag?: unknown; data?: unknown };
  if (item.v !== 1 || typeof item.iv !== "string" || typeof item.tag !== "string" || typeof item.data !== "string") throw new Error("An operations record version is unsupported.");
  const decipher = createDecipheriv("aes-256-gcm", keyFor(secret), Buffer.from(item.iv, "base64"));
  decipher.setAuthTag(Buffer.from(item.tag, "base64"));
  const clear = Buffer.concat([decipher.update(Buffer.from(item.data, "base64")), decipher.final()]);
  return JSON.parse(clear.toString("utf8")) as unknown;
}

function recordPath(collection: OpsCollection, id: string): string {
  return ROOT + "/" + collection + "/" + safeRecordId(id) + ".enc";
}

async function findBlob(pathname: string, secret: string) {
  const found = await list({ prefix: pathname, token: secret });
  return found.blobs.find((blob) => blob.pathname === pathname);
}

async function readBlob(blob: { url: string }, secret: string): Promise<unknown> {
  const result = await get(blob.url, { access: "public", token: secret, useCache: false });
  if (!result || result.statusCode !== 200) throw new Error("An operations record could not be loaded.");
  return decrypt(await new Response(result.stream).text(), secret);
}

export async function getOpsRecord<T extends OpsRecord>(collection: OpsCollection, id: string): Promise<T | null> {
  const secret = token();
  const blob = await findBlob(recordPath(collection, id), secret);
  if (!blob) return null;
  const value = await readBlob(blob, secret);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("An operations record is malformed.");
  return value as T;
}

export async function listOpsRecords<T extends OpsRecord>(collection: OpsCollection, limit = 2000): Promise<T[]> {
  const secret = token();
  const prefix = ROOT + "/" + collection + "/";
  const blobs: Array<{ pathname: string; url: string }> = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, token: secret, ...(cursor ? { cursor } : {}) });
    blobs.push(...page.blobs);
    cursor = page.cursor || undefined;
  } while (cursor && blobs.length < limit);
  const files = blobs.filter((blob) => blob.pathname.endsWith(".enc")).slice(0, limit);
  const values: T[] = [];
  for (let index = 0; index < files.length; index += 20) {
    const chunk = files.slice(index, index + 20);
    const records = await Promise.all(chunk.map(async (blob) => {
      const value = await readBlob(blob, secret);
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("An operations record is malformed.");
      return value as T;
    }));
    values.push(...records);
  }
  return values.sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
}

export async function createOpsRecord<T extends OpsRecord>(collection: OpsCollection, record: T): Promise<T> {
  const secret = token();
  const pathname = recordPath(collection, record.id);
  if (await findBlob(pathname, secret)) {
    const existing = await getOpsRecord<T>(collection, record.id);
    if (existing && JSON.stringify(existing) === JSON.stringify(record)) return existing;
    throw new Error("This record already exists. Refresh the operations workspace before retrying.");
  }
  try {
    await put(pathname, encrypt(record, secret), {
      access: "public", token: secret, contentType: "application/octet-stream",
      addRandomSuffix: false, allowOverwrite: false,
    });
    return record;
  } catch (error) {
    const existing = await getOpsRecord<T>(collection, record.id);
    if (existing && JSON.stringify(existing) === JSON.stringify(record)) return existing;
    throw error;
  }
}

export async function updateOpsRecord<T extends OpsRecord>(
  collection: OpsCollection,
  record: T,
  expectedUpdatedAt?: string,
): Promise<T> {
  const secret = token();
  const current = await getOpsRecord<T>(collection, record.id);
  if (!current) throw new Error("Record not found. Refresh the operations workspace.");
  if (expectedUpdatedAt && current.updatedAt !== expectedUpdatedAt) throw new Error("This record changed in another admin tab. Refresh before saving again.");
  await put(recordPath(collection, record.id), encrypt(record, secret), {
    access: "public", token: secret, contentType: "application/octet-stream",
    addRandomSuffix: false, allowOverwrite: true,
  });
  return record;
}

export async function appendOpsEvent(input: Omit<OpsEvent, "id"> & { idempotencyKey: string }): Promise<OpsEvent> {
  const eventId = "evt_" + safeRecordId(input.idempotencyKey);
  const event: OpsEvent = { ...input, id: eventId };
  try {
    return await createOpsRecord("events", event);
  } catch (error) {
    const existing = await getOpsRecord<OpsEvent>("events", eventId);
    if (existing && existing.idempotencyKey === input.idempotencyKey && existing.eventType === input.eventType && existing.entityId === input.entityId) return existing;
    throw error;
  }
}

export async function loadOpsBundle(): Promise<OpsBundle> {
  const [
    customers, projects, quotes, milestones, transactions, documents, approvals,
    tasks, messages, checklists, warranties, warrantyClaims, settings,
  ] = await Promise.all([
    listOpsRecords<OpsCustomer>("customers"),
    listOpsRecords<OpsProject>("projects"),
    listOpsRecords<OpsQuote>("quotes"),
    listOpsRecords<OpsMilestone>("milestones"),
    listOpsRecords<OpsTransaction>("transactions"),
    listOpsRecords<OpsDocument>("documents"),
    listOpsRecords<OpsApproval>("approvals"),
    listOpsRecords<OpsTask>("tasks"),
    listOpsRecords<OpsMessage>("messages"),
    listOpsRecords<OpsChecklist>("checklists"),
    listOpsRecords<OpsWarranty>("warranties"),
    listOpsRecords<OpsWarrantyClaim>("warrantyClaims"),
    getOpsRecord<OperationsSettings>("settings", "global"),
  ]);
  return {
    customers, projects, quotes, milestones, transactions, documents, approvals,
    tasks, messages, checklists, warranties, warrantyClaims, settings: settings || defaultOperationsSettings(),
  };
}

export async function saveOpsBackup(backup: OpsBackup): Promise<OpsBackup> {
  return createOpsRecord("backups", backup);
}
