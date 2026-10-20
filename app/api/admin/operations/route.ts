import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { loadOperationsWorkspace } from "@/lib/workspace-store";
import { loadOpsBundle } from "@/lib/operations-store";
import { phase0Checklist, runOperationsCommand } from "@/lib/operations-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function unauthorized() {
  return NextResponse.json({ error: "Administrator sign-in is required." }, { status: 401, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();
  try {
    const [bundle, legacy] = await Promise.all([
      loadOpsBundle(),
      loadOperationsWorkspace({ includePublicEnquiries: true }),
    ]);
    const today = new Date().toISOString().slice(0, 10);
    const openTasks = bundle.tasks.filter((task) => !["done", "cancelled"].includes(task.status));
    const overdueTasks = openTasks.filter((task) => task.dueDate && task.dueDate < today);
    const dueTasks = openTasks.filter((task) => task.dueDate && task.dueDate <= today);
    const pendingPayments = bundle.transactions.filter((transaction) => transaction.type === "customer-payment" && transaction.verificationStatus === "pending");
    const blockedProjects = bundle.projects.filter((project) => project.stage === "on-hold");
    return NextResponse.json({
      bundle,
      legacy: { leads: legacy.leads, clients: legacy.clients, invoices: legacy.invoices },
      phase0Checklist: phase0Checklist(bundle.settings),
      dashboard: {
        projects: bundle.projects.length,
        activeProjects: bundle.projects.filter((project) => project.stage !== "complete").length,
        overdueTasks: overdueTasks.length,
        dueTasks: dueTasks.length,
        pendingPaymentVerifications: pendingPayments.length,
        projectsOnHold: blockedProjects.length,
        unapprovedPhase0Items: phase0Checklist(bundle.settings).filter((item) => !item.complete).length,
        openWarrantyClaims: bundle.warrantyClaims.filter((claim) => !["resolved", "rejected"].includes(claim.status)).length,
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load Project Operations.";
    return NextResponse.json({ error: message }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();
  const contentLength = Number(request.headers.get("content-length") || "0");
  if (contentLength > 150_000) return NextResponse.json({ error: "This operations request is too large." }, { status: 413 });
  let body: Record<string, unknown>;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 150_000) return NextResponse.json({ error: "This operations request is too large." }, { status: 413 });
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid");
    body = parsed as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "The operations request could not be read." }, { status: 400 });
  }

  const result = await runOperationsCommand(body);
  if (!result.ok) return NextResponse.json({ error: result.error, blockers: result.blockers || [] }, { status: 400, headers: { "Cache-Control": "no-store" } });
  if (result.result.blocked === true) {
    return NextResponse.json({ ...result.result }, { status: 409, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json(result.result, { headers: { "Cache-Control": "no-store" } });
}
