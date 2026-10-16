import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { del, get, list, put } from "@vercel/blob";
import type { WebsiteAssetAssignments, WebsiteAssetConfig, WebsiteAssetRecord, WebsiteAssetSlot } from "@/lib/website-assets";
import { WEBSITE_ASSET_SLOT_OPTIONS } from "@/lib/website-assets";

const MANIFEST_PATH = "rr-creative-interiors/site-assets/manifest.enc";

function storageToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("Website asset storage is not configured. Connect the RR Vercel Blob store first.");
  return token;
}

function encryptionKey(token: string): Buffer {
  return createHash("sha256").update(`rr-creative-interiors:site-assets:v1:${token}`, "utf8").digest();
}

function encryptConfig(config: WebsiteAssetConfig, token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(token), iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(config), "utf8"), cipher.final()]);
  return JSON.stringify({ version: 1, iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: ciphertext.toString("base64") });
}

function decryptConfig(encoded: string, token: string): WebsiteAssetConfig {
  const envelope: unknown = JSON.parse(encoded);
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) throw new Error("Website asset manifest is invalid.");
  const item = envelope as { version?: unknown; iv?: unknown; tag?: unknown; data?: unknown };
  if (item.version !== 1 || typeof item.iv !== "string" || typeof item.tag !== "string" || typeof item.data !== "string") {
    throw new Error("Website asset manifest version is not supported.");
  }
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(token), Buffer.from(item.iv, "base64"));
  decipher.setAuthTag(Buffer.from(item.tag, "base64"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(item.data, "base64")), decipher.final()]);
  const value: unknown = JSON.parse(plaintext.toString("utf8"));
  if (!value || typeof value !== "object" || Array.isArray(value)) return emptyConfig();
  const source = value as Partial<WebsiteAssetConfig>;
  const assets = Array.isArray(source.assets) ? source.assets.filter(isAsset) : [];
  const assignments: WebsiteAssetAssignments = {};
  if (source.assignments && typeof source.assignments === "object" && !Array.isArray(source.assignments)) {
    const available = new Set(assets.map((asset) => asset.id));
    for (const slot of WEBSITE_ASSET_SLOT_OPTIONS) {
      const assigned = (source.assignments as Record<string, unknown>)[slot.key];
      if (typeof assigned === "string" && available.has(assigned)) assignments[slot.key] = assigned;
    }
  }
  return { assets, assignments };
}

function isAsset(value: unknown): value is WebsiteAssetRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Partial<WebsiteAssetRecord>;
  return typeof item.id === "string" && typeof item.url === "string" && typeof item.pathname === "string" &&
    typeof item.contentType === "string" && typeof item.fileName === "string" && typeof item.createdAt === "string";
}

function emptyConfig(): WebsiteAssetConfig {
  return { assets: [], assignments: {} };
}

export async function loadWebsiteAssetConfig(): Promise<WebsiteAssetConfig> {
  const token = storageToken();
  const page = await list({ prefix: MANIFEST_PATH, token });
  const manifest = page.blobs.find((blob) => blob.pathname === MANIFEST_PATH);
  if (!manifest) return emptyConfig();
  const response = await get(manifest.url, { access: "public", token, useCache: false });
  if (!response || response.statusCode !== 200) throw new Error("Could not read the website asset manifest.");
  return decryptConfig(await new Response(response.stream).text(), token);
}

export async function saveWebsiteAssetConfig(config: WebsiteAssetConfig): Promise<void> {
  const token = storageToken();
  await put(MANIFEST_PATH, encryptConfig(config, token), {
    access: "public", token, contentType: "application/octet-stream", addRandomSuffix: false, allowOverwrite: true,
  });
}

export function publicWebsiteAssetMap(config: WebsiteAssetConfig): Partial<Record<WebsiteAssetSlot, string>> {
  const byId = new Map(config.assets.map((asset) => [asset.id, asset.url]));
  const result: Partial<Record<WebsiteAssetSlot, string>> = {};
  for (const slot of WEBSITE_ASSET_SLOT_OPTIONS) {
    const id = config.assignments[slot.key];
    const url = id ? byId.get(id) : undefined;
    if (url) result[slot.key] = url;
  }
  return result;
}

export async function removeWebsiteAsset(id: string): Promise<void> {
  const config = await loadWebsiteAssetConfig();
  const asset = config.assets.find((item) => item.id === id);
  if (!asset) throw new Error("Website asset not found.");
  const assigned = WEBSITE_ASSET_SLOT_OPTIONS.find((slot) => config.assignments[slot.key] === id);
  if (assigned) throw new Error(`This image is assigned to “${assigned.label}”. Replace or clear that slot before deleting it.`);
  const token = storageToken();
  await del(asset.url, { token });
  await saveWebsiteAssetConfig({ ...config, assets: config.assets.filter((item) => item.id !== id) });
}
