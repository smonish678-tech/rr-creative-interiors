import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const allowedContentTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/heic",
  "video/mp4",
  "video/webm",
  "video/quicktime",
];

export async function POST(request: Request) {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json(
      { error: "Portfolio uploads are not configured. Connect a Vercel Blob store to this project first." },
      { status: 503 }
    );
  }

  let body: HandleUploadBody;
  try {
    body = (await request.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Invalid upload request." }, { status: 400 });
  }

  try {
    const response = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname) => {
        if (!isAdminRequest(request)) throw new Error("Sign in as an administrator before uploading.");
        const isPortfolio = pathname.startsWith("rr-creative-interiors/portfolio/");
        const isWebsiteAsset = pathname.startsWith("rr-creative-interiors/site-assets/");
        if (!isPortfolio && !isWebsiteAsset) throw new Error("Uploads must use an approved RR media folder.");
        const fileExt = pathname.split(".").pop()?.toLowerCase() || "";
        const video = ["mp4", "webm", "mov", "quicktime"].includes(fileExt);
        if (isWebsiteAsset && video) throw new Error("Website brand and section slots accept images only. Use the Portfolio library for videos.");
        return {
          allowedContentTypes: isWebsiteAsset ? allowedContentTypes.filter((type) => ["image/jpeg", "image/png", "image/webp", "image/avif"].includes(type)) : allowedContentTypes,
          maximumSizeInBytes: video ? 150 * 1024 * 1024 : 30 * 1024 * 1024,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ purpose: isWebsiteAsset ? "rr-creative-interiors-site-assets" : "rr-creative-interiors-portfolio" }),
        };
      },
      onUploadCompleted: async ({ tokenPayload }) => {
        if (!tokenPayload) throw new Error("The upload did not include the expected portfolio marker.");
        const payload = JSON.parse(tokenPayload) as { purpose?: string };
        if (!["rr-creative-interiors-portfolio", "rr-creative-interiors-site-assets"].includes(payload.purpose || "")) {
          throw new Error("Unexpected upload purpose.");
        }
        // The authenticated browser saves item metadata after this upload completes.
      },
    });

    return NextResponse.json(response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "The upload could not be started.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
