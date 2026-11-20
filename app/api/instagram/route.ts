import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The token stays on the server. Never expose it in NEXT_PUBLIC_* variables.
type InstagramMedia = {
  id: string;
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  timestamp?: string;
  children?: { data?: InstagramMedia[] };
};

type GalleryItem = {
  id: string;
  type: "image" | "video";
  src: string;
  poster?: string;
  date?: string;
  album?: boolean;
};

function safeMediaUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function asGalleryItem(media: InstagramMedia, album = false): GalleryItem | null {
  const type = media.media_type === "VIDEO" ? "video" : media.media_type === "IMAGE" ? "image" : null;
  const src = safeMediaUrl(media.media_url);
  if (!type || !src || typeof media.id !== "string") return null;
  return {
    id: media.id,
    type,
    src,
    poster: type === "video" ? safeMediaUrl(media.thumbnail_url) : undefined,
    date: media.timestamp,
    album,
  };
}

function normalizeMedia(posts: InstagramMedia[]): GalleryItem[] {
  const items: GalleryItem[] = [];
  const ids = new Set<string>();

  for (const post of posts) {
    // A carousel is a single Instagram upload containing several images/videos.
    const children = post.media_type === "CAROUSEL_ALBUM" ? post.children?.data : undefined;
    const entries = children?.length ? children : [post];
    for (const child of entries) {
      const item = asGalleryItem(
        { ...child, timestamp: child.timestamp || post.timestamp },
        Boolean(children?.length)
      );
      if (!item || ids.has(item.id)) continue;
      ids.add(item.id);
      items.push(item);
      if (items.length >= 16) return items;
    }
  }
  return items;
}

export async function GET() {
  const token = process.env.INSTAGRAM_ACCESS_TOKEN?.trim();
  if (!token) {
    // No placeholder Instagram content: hide the section until RR connects its account.
    return NextResponse.json({ configured: false, items: [] }, {
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  const versionSetting = process.env.INSTAGRAM_GRAPH_API_VERSION?.trim();
  const version = versionSetting && /^v\d+\.\d+$/.test(versionSetting) ? versionSetting : "v27.0";
  const userIdSetting = process.env.INSTAGRAM_USER_ID?.trim();
  const userId = userIdSetting && /^\d+$/.test(userIdSetting) ? userIdSetting : "me";

  const url = new URL("https://graph.instagram.com/" + version + "/" + userId + "/media");
  url.searchParams.set("fields", "id,media_type,media_url,thumbnail_url,timestamp,children{id,media_type,media_url,thumbnail_url}");
  url.searchParams.set("limit", "18");
  url.searchParams.set("access_token", token);

  try {
    const upstream = await fetch(url, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(12000),
    });
    if (!upstream.ok) throw new Error("Instagram service unavailable");
    const data: unknown = await upstream.json();
    if (!data || typeof data !== "object" || !("data" in data) || !Array.isArray(data.data)) {
      throw new Error("Unexpected Instagram response");
    }

    const items = normalizeMedia(data.data as InstagramMedia[]);
    return NextResponse.json({ configured: true, items }, {
      headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
    });
  } catch {
    // Never return the upstream error (it may include credentials or account identifiers).
    return NextResponse.json({ configured: true, items: [], unavailable: true }, {
      status: 502,
      headers: { "Cache-Control": "private, no-store" },
    });
  }
}
