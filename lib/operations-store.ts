import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { get, list, put } from "@vercel/blob";
import { emptyOperationsData, normalizeOperationsData, type OperationsData } from "@/lib/project-operations";

const STORE_PATH = "rr-creative-interiors/operations/v1/project-passport.enc";

function storageToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("Project Operations storage is unavailable. Configure the existing RR Vercel Blob store.");
  return token;
}
function key(token: string): Buffer {
  return createHash("sha256").update(`rr-creative-interiors:project-operations:v1:${token}`).digest();
}
function encrypt(value: unknown, token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(token), iv);
  const bytes = Buffer.concat([cipher.update(JSON.stringify(value), "utf8"), cipher.final()]);
  return JSON.stringify({ version: 1, iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: bytes.toString("base64") });
}
function decrypt(serialized: string, token: string): OperationsData {
  const raw: unknown = JSON.parse(serialized);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Project Operations storage envelope is invalid.");
  const envelope = raw as { version?: unknown; iv?: unknown; tag?: unknown; data?: unknown };
  if (envelope.version !== 1 || typeof envelope.iv !== "string" || typeof envelope.tag !== "string" || typeof envelope.data !== "string") throw new Error("Project Operations storage version is not supported.");
  const decipher = createDecipheriv("aes-256-gcm", key(token), Buffer.from(envelope.iv, "base64"));
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  const bytes = Buffer.concat([decipher.update(Buffer.from(envelope.data, "base64")), decipher.final()]);
  return normalizeOperationsData(JSON.parse(bytes.toString("utf8")) as unknown);
}

export async function loadProjectOperations(): Promise<OperationsData> {
  const token = storageToken();
  const response = await list({ prefix: STORE_PATH, token });
  const blob = response.blobs.find((item) => item.pathname === STORE_PATH);
  if (!blob) return emptyOperationsData();
  const stored = await get(blob.url, { access: "public", token, useCache: false });
  if (!stored || stored.statusCode !== 200) throw new Error("Could not load the encrypted Project Operations record.");
  return decrypt(await new Response(stored.stream).text(), token);
}

export async function saveProjectOperations(data: OperationsData, expectedRevision: number): Promise<OperationsData> {
  const current = await loadProjectOperations();
  if (current.revision !== expectedRevision) {
    throw new Error("This Project Operations page is out of date. Refresh before saving so you do not overwrite newer changes.");
  }
  const token = storageToken();
  const next: OperationsData = { ...data, schemaVersion: 1, revision: current.revision + 1, lastSavedAt: new Date().toISOString() };
  await put(STORE_PATH, encrypt(next, token), {
    access: "public", token, contentType: "application/octet-stream", addRandomSuffix: false, allowOverwrite: true,
  });
  return next;
}
