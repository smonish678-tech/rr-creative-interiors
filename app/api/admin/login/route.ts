import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  adminConfigurationReady,
  adminCookieOptions,
  adminCredentialsMatch,
  createAdminSessionToken,
} from "@/lib/admin-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!adminConfigurationReady()) {
    return NextResponse.json(
      { error: "Admin access is not configured. Set ADMIN_EMAIL, ADMIN_PASSWORD and ADMIN_SESSION_SECRET in Vercel server-side environment variables." },
      { status: 503 }
    );
  }

  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Enter your admin email and password." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!adminCredentialsMatch(email, password)) {
    return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
  }

  const response = NextResponse.json({ authenticated: true });
  response.cookies.set(ADMIN_COOKIE, createAdminSessionToken(), adminCookieOptions());
  return response;
}
