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
  createdAt: string;
};

const MANIFEST_PATH = "rr-creative-interiors/portfolio/manifest.json";

function publicMediaToken(): string {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new Error("Public portfolio media storage is not configured. Connect a public Vercel Blob store and set BLOB_READ_WRITE_TOKEN.");
  }
  return token;
}

function privateManifestToken(): string {
  const token = process.env.RR_PORTFOLIO_MANIFEST_BLOB_TOKEN;
  if (!token) {
    throw new Error("Private portfolio metadata storage is not configured. Create a separate private Vercel Blob store and set RR_PORTFOLIO_MANIFEST_BLOB_TOKEN.");
  }
  return token;
}

export async function loadPortfolio(): Promise<PortfolioAsset[]> {
  const token = privateManifestToken();
  const result = await list({ prefix: MANIFEST_PATH, token });
  const manifest = result.blobs.find((blob) => blob.pathname === MANIFEST_PATH);
  if (!manifest) return [];

  const manifestData = await get(manifest.url, {
    access: "private",
    token,
    useCache: false,
  });
  if (!manifestData || manifestData.statusCode !== 200) {
    throw new Error("Could not read the private portfolio library manifest.");
  }

  const data: unknown = await new Response(manifestData.stream).json();
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
  const token = privateManifestToken();
  await put(MANIFEST_PATH, JSON.stringify(items), {
    access: "private",
    token,
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

export async function deletePortfolioBlob(url: string): Promise<void> {
  await del(url, { token: publicMediaToken() });
}
