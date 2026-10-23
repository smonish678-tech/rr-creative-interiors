import { NextResponse } from "next/server";
import { createDailyOperationsBackup } from "@/lib/operations-backup";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Forbidden." }, { status: 401 });
  try {
    const result = await createDailyOperationsBackup();
    return NextResponse.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Daily backup failed.";
    return NextResponse.json({ ok: false, error: message }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
