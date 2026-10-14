import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { isSalesPipelineStageList, normalizeSalesPipeline } from "@/lib/sales-pipeline";
import { loadOperationsWorkspace, saveOperationsWorkspace, type OperationsWorkspace } from "@/lib/workspace-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ error: "Administrator sign-in is required." }, { status: 401 });
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();
  try {
    const workspace = await loadOperationsWorkspace();
    return NextResponse.json({ workspace }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not load the operations workspace.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();
  try {
    const body: unknown = await request.json();
    if (!isRecord(body)) {
      return NextResponse.json({ error: "Workspace data is invalid." }, { status: 400 });
    }

    const { leads, invoices, studioName, studioEmail, pipelineStages } = body;
    if (
      !Array.isArray(leads) ||
      !Array.isArray(invoices) ||
      leads.length > 5000 ||
      invoices.length > 5000 ||
      !leads.every(isRecord) ||
      !invoices.every(isRecord) ||
      typeof studioName !== "string" ||
      typeof studioEmail !== "string" ||
      !studioName.trim() ||
      studioName.length > 140 ||
      studioEmail.length > 254 ||
      (pipelineStages !== undefined && !isSalesPipelineStageList(pipelineStages))
    ) {
      return NextResponse.json({ error: "Workspace data failed validation." }, { status: 400 });
    }

    const existingWorkspace = await loadOperationsWorkspace();
    const workspace: OperationsWorkspace = {
      leads,
      invoices,
      studioName: studioName.trim(),
      studioEmail: studioEmail.trim(),
      pipelineStages: pipelineStages === undefined ? existingWorkspace.pipelineStages : normalizeSalesPipeline(pipelineStages),
    };
    await saveOperationsWorkspace(workspace);
    return NextResponse.json({ saved: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not save the operations workspace.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
