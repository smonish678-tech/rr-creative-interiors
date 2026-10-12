import { del, list, put } from "@vercel/blob";

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
  createdAt: string;
};

const MANIFEST_PATH = "rr-creative-interiors/portfolio/manifest.json";

function blobToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error("Portfolio storage is not configured. Create a Vercel Blob store and add BLOB_READ_WRITE_TOKEN to this project's environment variables.");
  }
  return token;
}

export async function loadPortfolio(): Promise<PortfolioAsset[]> {
  const token = blobToken();
  const result = await list({ prefix: MANIFEST_PATH, token });
  const manifest = result.blobs.find((blob) => blob.pathname === MANIFEST_PATH);
  if (!manifest) return [];

  const response = await fetch(manifest.url, { cache: "no-store" });
  if (!response.ok) throw new Error("Could not read the portfolio library.");
  const data: unknown = await response.json();
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
  const token = blobToken();
  await put(MANIFEST_PATH, JSON.stringify(items), {
    access: "public",
    token,
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

export async function deletePortfolioBlob(url: string): Promise<void> {
  await del(url, { token: blobToken() });
}
