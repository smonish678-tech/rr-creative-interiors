import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { SITE_ASSET_KEY_SET } from "@/lib/site-assets";
import { SITE_ASSET_UPLOAD_PREFIX } from "@/lib/site-assets-store";

export const runtime = "nodejs";
export const maxDuration = 60;

const allowedContentTypes = ["image/jpeg", "image/png", "image/webp", "image/avif", "image/heic"];

export async function POST(request: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Website uploads are not configured. Connect the RR Vercel Blob store first." }, { status: 503 });
  }
  let body: HandleUploadBody;
  try { body = await request.json() as HandleUploadBody; } catch {
    return NextResponse.json({ error: "Invalid upload request." }, { status: 400 });
  }
  try {
    const response = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname) => {
        if (!isAdminRequest(request)) throw new Error("Sign in as an administrator before uploading website assets.");
        if (!pathname.startsWith(SITE_ASSET_UPLOAD_PREFIX)) throw new Error("This upload destination is not permitted.");
        return {
          allowedContentTypes,
          maximumSizeInBytes: 20 * 1024 * 1024,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ purpose: "rr-creative-interiors-site-asset", version: 1 }),
        };
      },
      onUploadCompleted: async ({ tokenPayload }) => {
        if (!tokenPayload) throw new Error("The upload did not include the expected website-asset marker.");
        const payload = JSON.parse(tokenPayload) as { purpose?: string; version?: number };
        if (payload.purpose !== "rr-creative-interiors-site-asset" || payload.version !== 1) {
          throw new Error("Unexpected website asset upload purpose.");
        }
      },
    });
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "The upload could not be started." }, { status: 400 });
  }
}
