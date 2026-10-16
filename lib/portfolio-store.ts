import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { del, get, list, put } from "@vercel/blob";

export type PortfolioAsset = {
  id: string;
  url: string;
  pathname: string;
  contentType: string;
  kind: "image" | "video";
  title: string;
  project: string;
  description: string;
  category: string;
  published: boolean;
  siteSlot?: string;
  createdAt: string;
};

const MANIFEST_PATH = "rr-creative-interiors/portfolio/manifest.enc";

function publicMediaToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error("Portfolio storage is not configured. Connect a public Vercel Blob store to this project.");
  }
  return token;
}

function manifestKey(token: string): Buffer {
  return createHash("sha256")
    .update(`rr-creative-interiors:portfolio-manifest:v1:${token}`, "utf8")
    .digest();
}

function encryptManifest(items: PortfolioAsset[], token: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", manifestKey(token), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(items), "utf8"),
    cipher.final(),
  ]);

  return JSON.stringify({
    version: 1,
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    data: encrypted.toString("base64"),
  });
}

function decryptManifest(encoded: string, token: string): unknown {
  const envelope: unknown = JSON.parse(encoded);
  if (!envelope || typeof envelope !== "object") {
    throw new Error("The portfolio manifest has an invalid format.");
  }

  const record = envelope as { version?: unknown; iv?: unknown; tag?: unknown; data?: unknown };
  if (
    record.version !== 1 ||
    typeof record.iv !== "string" ||
    typeof record.tag !== "string" ||
    typeof record.data !== "string"
  ) {
    throw new Error("The portfolio manifest version is not supported.");
  }

  const decipher = createDecipheriv("aes-256-gcm", manifestKey(token), Buffer.from(record.iv, "base64"));
  decipher.setAuthTag(Buffer.from(record.tag, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(record.data, "base64")),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString("utf8")) as unknown;
}

export async function loadPortfolio(): Promise<PortfolioAsset[]> {
  const token = publicMediaToken();
  const result = await list({ prefix: MANIFEST_PATH, token });
  const manifest = result.blobs.find((blob) => blob.pathname === MANIFEST_PATH);
  if (!manifest) return [];

  const manifestData = await get(manifest.url, {
    access: "public",
    token,
    useCache: false,
  });
  if (!manifestData || manifestData.statusCode !== 200) {
    throw new Error("Could not read the encrypted portfolio library manifest.");
  }

  const encoded = await new Response(manifestData.stream).text();
  const data = decryptManifest(encoded, token);
  if (!Array.isArray(data)) return [];
  return data.filter((item): item is PortfolioAsset => {
    return Boolean(
      item &&
        typeof item === "object" &&
        typeof (item as PortfolioAsset).id === "string" &&
        typeof (item as PortfolioAsset).url === "string" &&
        typeof (item as PortfolioAsset).published === "boolean"
    );
  });
}

export async function savePortfolio(items: PortfolioAsset[]): Promise<void> {
  const token = publicMediaToken();
  await put(MANIFEST_PATH, encryptManifest(items, token), {
    access: "public",
    token,
    contentType: "application/octet-stream",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

export async function deletePortfolioBlob(url: string): Promise<void> {
  await del(url, { token: publicMediaToken() });
}
