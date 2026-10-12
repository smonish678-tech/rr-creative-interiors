import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_COOKIE = "rr_admin_session";
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 8;

function safeStringEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function adminConfigurationReady(): boolean {
  return Boolean(
    process.env.ADMIN_EMAIL &&
      process.env.ADMIN_PASSWORD &&
      process.env.ADMIN_SESSION_SECRET
  );
}

export function adminCredentialsMatch(email: string, password: string): boolean {
  const expectedEmail = process.env.ADMIN_EMAIL;
  const expectedPassword = process.env.ADMIN_PASSWORD;
  if (!expectedEmail || !expectedPassword) return false;

  return (
    safeStringEqual(email.trim().toLowerCase(), expectedEmail.trim().toLowerCase()) &&
    safeStringEqual(password, expectedPassword)
  );
}

function signatureFor(expiry: string): string {
  const secret = process.env.ADMIN_SESSION_SECRET;
  const email = process.env.ADMIN_EMAIL;
  if (!secret || !email) throw new Error("Admin session configuration is missing.");
  return createHmac("sha256", secret).update(`rr-admin:${email.toLowerCase()}:${expiry}`).digest("base64url");
}

export function createAdminSessionToken(): string {
  const expiry = String(Math.floor(Date.now() / 1000) + ADMIN_SESSION_TTL_SECONDS);
  return `${expiry}.${signatureFor(expiry)}`;
}

export function isAdminRequest(request: Request): boolean {
  if (!adminConfigurationReady()) return false;
  const cookieHeader = request.headers.get("cookie") || "";
  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${ADMIN_COOKIE}=`));
  if (!cookie) return false;

  const token = decodeURIComponent(cookie.slice(ADMIN_COOKIE.length + 1));
  const [expiry, signature, extra] = token.split(".");
  if (!expiry || !signature || extra || !/^\d+$/.test(expiry)) return false;
  if (Number(expiry) <= Math.floor(Date.now() / 1000)) return false;

  try {
    return safeStringEqual(signature, signatureFor(expiry));
  } catch {
    return false;
  }
}

export function adminCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: ADMIN_SESSION_TTL_SECONDS,
  };
}
