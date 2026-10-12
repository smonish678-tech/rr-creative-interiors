import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { get, list, put } from "@vercel/blob";

export type WorkspaceRecord = Record<string, unknown>;

export type OperationsWorkspace = {
  leads: WorkspaceRecord[];
  invoices: WorkspaceRecord[];
  studioName: string;
  studioEmail: string;
};

const WORKSPACE_PATH = "rr-creative-interiors/workspace/operations.enc";

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

function encryptWorkspace(workspace: OperationsWorkspace, token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(token), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(workspace), "utf8"),
    cipher.final(),
  ]);
  return JSON.stringify({
    version: 1,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: ciphertext.toString("base64"),
  });
}

function decryptWorkspace(serialized: string, token: string): OperationsWorkspace {
  const envelope: unknown = JSON.parse(serialized);
  if (!envelope || typeof envelope !== "object") {
    throw new Error("Stored workspace has an invalid format.");
  }
  const item = envelope as { version?: unknown; iv?: unknown; tag?: unknown; data?: unknown };
  if (
    item.version !== 1 ||
    typeof item.iv !== "string" ||
    typeof item.tag !== "string" ||
    typeof item.data !== "string"
  ) {
    throw new Error("Stored workspace version is not supported.");
  }

  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(token), Buffer.from(item.iv, "base64"));
  decipher.setAuthTag(Buffer.from(item.tag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(item.data, "base64")),
    decipher.final(),
  ]);
  const value: unknown = JSON.parse(plaintext.toString("utf8"));
  if (!value || typeof value !== "object") {
    throw new Error("Stored workspace has an invalid format.");
  }

  const data = value as Partial<OperationsWorkspace>;
  return {
    leads: Array.isArray(data.leads) ? data.leads.filter(isRecord) : [],
    invoices: Array.isArray(data.invoices) ? data.invoices.filter(isRecord) : [],
    studioName: typeof data.studioName === "string" ? data.studioName : "RR Creative Interiors",
    studioEmail: typeof data.studioEmail === "string" ? data.studioEmail : "accounts@rrcreativeinteriors.in",
  };
}

function isRecord(value: unknown): value is WorkspaceRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export async function loadOperationsWorkspace(): Promise<OperationsWorkspace> {
  const token = storageToken();
  const result = await list({ prefix: WORKSPACE_PATH, token });
  const blob = result.blobs.find((item) => item.pathname === WORKSPACE_PATH);
  if (!blob) {
    return {
      leads: [],
      invoices: [],
      studioName: "RR Creative Interiors",
      studioEmail: "accounts@rrcreativeinteriors.in",
    };
  }

  const response = await get(blob.url, { access: "public", token, useCache: false });
  if (!response || response.statusCode !== 200) {
    throw new Error("Could not load the encrypted operations workspace.");
  }
  const encrypted = await new Response(response.stream).text();
  return decryptWorkspace(encrypted, token);
}

export async function saveOperationsWorkspace(workspace: OperationsWorkspace): Promise<void> {
  const token = storageToken();
  await put(WORKSPACE_PATH, encryptWorkspace(workspace, token), {
    access: "public",
    token,
    contentType: "application/octet-stream",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}
