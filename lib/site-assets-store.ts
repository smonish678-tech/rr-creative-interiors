import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { get, list, put } from "@vercel/blob";
import { SITE_ASSET_KEY_SET, type SiteAssetKey, type SiteAssetManifest, type SiteAssetRecord } from "@/lib/site-assets";

const MANIFEST_PATH = "rr-creative-interiors/site-assets/manifest.enc";
export const SITE_ASSET_UPLOAD_PREFIX = "rr-creative-interiors/site-assets/uploads/";

function storageToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) throw new Error("Website asset storage is not configured. Connect the RR Vercel Blob store first.");
  return token;
}

function encryptionKey(token: string): Buffer {
  return createHash("sha256").update(`rr-creative-interiors:site-assets:v1:${token}`, "utf8").digest();
}

function encryptManifest(assets: SiteAssetManifest, token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(token), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(assets), "utf8"), cipher.final()]);
  return JSON.stringify({ version: 1, iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: encrypted.toString("base64") });
}

function decryptManifest(encoded: string, token: string): unknown {
  const envelope: unknown = JSON.parse(encoded);
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) throw new Error("Website asset manifest has an invalid format.");
  const item = envelope as { version?: unknown; iv?: unknown; tag?: unknown; data?: unknown };
  if (item.version !== 1 || typeof item.iv !== "string" || typeof item.tag !== "string" || typeof item.data !== "string") {
    throw new Error("Website asset manifest version is not supported.");
  }
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(token), Buffer.from(item.iv, "base64"));
  decipher.setAuthTag(Buffer.from(item.tag, "base64"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(item.data, "base64")), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8")) as unknown;
}

function isValidRecord(value: unknown): value is SiteAssetRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Partial<SiteAssetRecord>;
  if (typeof record.url !== "string" || typeof record.pathname !== "string" || typeof record.contentType !== "string" || typeof record.updatedAt !== "string") return false;
  try {
    const url = new URL(record.url);
    const urlPath = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    return url.protocol === "https:" && url.hostname.endsWith(".blob.vercel-storage.com") &&
      record.pathname.startsWith(SITE_ASSET_UPLOAD_PREFIX) && urlPath === record.pathname &&
      ["image/jpeg", "image/png", "image/webp", "image/avif", "image/heic"].includes(record.contentType);
  } catch { return false; }
}

export async function loadSiteAssets(): Promise<SiteAssetManifest> {
  const token = storageToken();
  const listing = await list({ prefix: MANIFEST_PATH, token });
  const blob = listing.blobs.find((item) => item.pathname === MANIFEST_PATH);
  if (!blob) return {};
  const response = await get(blob.url, { access: "public", token, useCache: false });
  if (!response || response.statusCode !== 200) throw new Error("Could not read website asset settings.");
  const decoded = decryptManifest(await new Response(response.stream).text(), token);
  if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) return {};
  const manifest: SiteAssetManifest = {};
  for (const [key, value] of Object.entries(decoded as Record<string, unknown>)) {
    if (SITE_ASSET_KEY_SET.has(key) && isValidRecord(value)) manifest[key as SiteAssetKey] = value;
  }
  return manifest;
}

export async function saveSiteAssets(manifest: SiteAssetManifest): Promise<void> {
  const token = storageToken();
  const validated: SiteAssetManifest = {};
  for (const [key, value] of Object.entries(manifest)) {
    if (!SITE_ASSET_KEY_SET.has(key)) throw new Error(`Unsupported website asset slot: ${key}`);
    if (!isValidRecord(value)) throw new Error(`The uploaded image for ${key} is not valid.`);
    validated[key as SiteAssetKey] = value;
  }
  await put(MANIFEST_PATH, encryptManifest(validated, token), {
    access: "public",
    token,
    contentType: "application/octet-stream",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}
