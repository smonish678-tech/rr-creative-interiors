import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { list, put } from "@vercel/blob";
import { loadOperationsWorkspace } from "@/lib/workspace-store";
import { loadProjectOperations } from "@/lib/operations-store";

const BACKUP_PREFIX = "rr-creative-interiors/operations/backups/";

function token() {
  const value = process.env.BLOB_READ_WRITE_TOKEN;
  if (!value) throw new Error("Backup storage is not configured.");
  return value;
}
function encryptBackup(payload: unknown, readWriteToken: string) {
  const key = createHash("sha256").update(`rr-creative-interiors:encrypted-backup:v1:${readWriteToken}`).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const bytes = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return JSON.stringify({ version: 1, iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: bytes.toString("base64") });
}
export async function createDailyOperationsBackup() {
  const readWriteToken = token();
  const [crmWorkspace, operations] = await Promise.all([loadOperationsWorkspace(), loadProjectOperations()]);
  const now = new Date();
  const stamp = now.toISOString().slice(0, 13).replace(/[-:T]/g, "");
  const pathname = `${BACKUP_PREFIX}${stamp}.enc`;
  const existing = (await list({ prefix: pathname, token: readWriteToken })).blobs.find((blob) => blob.pathname === pathname);
  if (existing) return { created: false, pathname, operationRevision: operations.revision, leads: crmWorkspace.leads.length, projects: operations.projects.length };
  await put(pathname, encryptBackup({
    format: "rr-operations-backup-v1", createdAt: now.toISOString(),
    crmWorkspace, operations,
  }, readWriteToken), {
    access: "public", token: readWriteToken, contentType: "application/octet-stream", addRandomSuffix: false, allowOverwrite: false,
  });
  return { created: true, pathname, operationRevision: operations.revision, leads: crmWorkspace.leads.length, projects: operations.projects.length };
}
