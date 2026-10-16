import { NextResponse } from "next/server";
import { normalizeCustomerPhone } from "@/lib/customer-matching";
import { savePublicEnquiryInbox, type PublicEnquiryInboxRecord } from "@/lib/workspace-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 6;
const rateBuckets = new Map<string, { startedAt: number; count: number }>();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function cleanText(value: unknown, maximum: number): string {
  if (typeof value !== "string") return "";
  return value.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, maximum);
}

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  const host = (request.headers.get("x-forwarded-host") || request.headers.get("host") || new URL(request.url).host).split(",")[0].trim().toLowerCase();
  if (!origin || !host) return false;
  try { return new URL(origin).host.toLowerCase() === host; } catch { return false; }
}

function isRateLimited(request: Request): boolean {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0].trim();
  const ip = forwarded || request.headers.get("x-real-ip") || "unknown";
  const now = Date.now();
  const current = rateBuckets.get(ip);
  if (!current || now - current.startedAt >= RATE_WINDOW_MS) {
    rateBuckets.set(ip, { startedAt: now, count: 1 });
    if (rateBuckets.size > 2000) {
      for (const [key, bucket] of rateBuckets) if (now - bucket.startedAt >= RATE_WINDOW_MS) rateBuckets.delete(key);
    }
    return false;
  }
  if (current.count >= RATE_LIMIT) return true;
  current.count += 1;
  return false;
}

function normaliseService(value: string): string {
  const services: Record<string, string> = {
    "Residential interior": "Residential turnkey",
    "Turnkey interior": "Residential turnkey",
    "Commercial interior": "Commercial / corporate",
    "Corporate interior": "Commercial / corporate",
    "Renovation": "Renovation",
  };
  return services[value] || "";
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Please submit the enquiry from the RR Creative Interiors website." }, { status: 403 });
  }
  if (isRateLimited(request)) {
    return NextResponse.json({ error: "Too many enquiries were submitted from this connection. Please wait a few minutes and try again." }, { status: 429, headers: { "Retry-After": "600", "Cache-Control": "no-store" } });
  }
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > 12000) return NextResponse.json({ error: "The enquiry is too long. Please shorten the message and try again." }, { status: 413 });

  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 12000) return NextResponse.json({ error: "The enquiry is too long. Please shorten the message and try again." }, { status: 413 });
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid");
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Your enquiry could not be read. Please review the form and try again." }, { status: 400 });
  }

  // Quietly discard automated submissions that fill the hidden honeypot.
  if (cleanText(body.companyWebsite, 200)) return NextResponse.json({ accepted: true }, { status: 202, headers: { "Cache-Control": "no-store" } });

  const submissionId = cleanText(body.submissionId, 50);
  const name = cleanText(body.name, 100);
  const phone = cleanText(body.phone, 30);
  const email = cleanText(body.email, 254).toLowerCase();
  const submittedService = cleanText(body.serviceType, 60);
  const serviceType = normaliseService(submittedService);
  const budget = cleanText(body.budget, 24);
  const message = cleanText(body.message, 2500);
  const phoneDigits = phone.replace(/\D/g, "");

  if (!UUID_PATTERN.test(submissionId)) return NextResponse.json({ error: "Please refresh the page and submit the enquiry again." }, { status: 400 });
  if (name.length < 2) return NextResponse.json({ error: "Please enter your name." }, { status: 400 });
  if (phoneDigits.length < 7 || phoneDigits.length > 15 || !normalizeCustomerPhone(phone)) return NextResponse.json({ error: "Please enter a valid phone number, including the country code if needed." }, { status: 400 });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Please check the email address." }, { status: 400 });
  if (submittedService && !serviceType) return NextResponse.json({ error: "Please select one of the listed project directions." }, { status: 400 });
  if (budget && !["Below ₹10L", "₹10–20L", "₹20–40L", "₹40L+"].includes(budget)) return NextResponse.json({ error: "Please select a listed budget range." }, { status: 400 });
  if (message.length < 10) return NextResponse.json({ error: "Please add a little more detail about the space so we can respond usefully." }, { status: 400 });

  const record: PublicEnquiryInboxRecord = {
    submissionId, receivedAt: new Date().toISOString(), name, phone, email, serviceType, budget, message,
  };
  try {
    const result = await savePublicEnquiryInbox(record);
    const reference = `LD-WEB-${submissionId.replace(/-/g, "").slice(0, 16).toUpperCase()}`;
    return NextResponse.json({ accepted: true, duplicate: result === "duplicate", reference }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "We could not save your enquiry just now. Your details have not been marked as sent. Please try again in a moment or contact the studio directly." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
