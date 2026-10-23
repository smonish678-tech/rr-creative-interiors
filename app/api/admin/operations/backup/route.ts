import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { loadOperationsWorkspace, saveOperationsWorkspace, type OperationsWorkspace } from "@/lib/workspace-store";
import { loadProjectOperations, saveProjectOperations } from "@/lib/operations-store";
import { normalizeOperationsData, validateOperationsData } from "@/lib/project-operations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
function isWorkspace(value: unknown): value is OperationsWorkspace {
  if (!isObject(value)) return false;
  return Array.isArray(value.leads) && Array.isArray(value.invoices) && Array.isArray(value.clients) &&
    typeof value.studioName === "string" && typeof value.studioEmail === "string" && Array.isArray(value.pipelineStages) &&
    value.leads.every(isObject) && value.invoices.every(isObject) && value.clients.every(isObject);
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Administrator sign-in is required." }, { status: 401 });
  try {
    const [crmWorkspace, operations] = await Promise.all([loadOperationsWorkspace(), loadProjectOperations()]);
    const backup = {
      format: "rr-creative-interiors-full-backup",
      schemaVersion: 1,
      createdAt: new Date().toISOString(),
      warning: "This file contains confidential customer and project data. Store it privately.",
      crmWorkspace,
      operations,
    };
    return new Response(JSON.stringify(backup, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="rr-operations-backup-${new Date().toISOString().slice(0,10)}.json"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create the backup.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Administrator sign-in is required." }, { status: 401 });
  let backup: unknown;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > 12 * 1024 * 1024) return NextResponse.json({ error: "Backup exceeds the 12 MB restore limit." }, { status: 413 });
    backup = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "The backup file could not be read as JSON." }, { status: 400 });
  }
  if (!isObject(backup) || backup.format !== "rr-creative-interiors-full-backup" || backup.schemaVersion !== 1 ||
      !isWorkspace(backup.crmWorkspace) || !isObject(backup.operations)) {
    return NextResponse.json({ error: "This is not a supported RR full backup file." }, { status: 400 });
  }

  const operations = normalizeOperationsData(backup.operations);
  const errors = validateOperationsData(operations);
  if (errors.length) return NextResponse.json({ error: errors.slice(0, 10).join("\n") }, { status: 422 });

  try {
    const [currentCrm, currentOperations] = await Promise.all([loadOperationsWorkspace(), loadProjectOperations()]);
    let operationsAfterWrite: { revision: number } | null = null;
    try {
      operationsAfterWrite = await saveProjectOperations({ ...operations, revision: currentOperations.revision }, currentOperations.revision);
      await saveOperationsWorkspace(backup.crmWorkspace);
    } catch (error) {
      // Best-effort rollback so a cross-store restore failure does not intentionally leave the two stores at different points.
      try {
        await saveOperationsWorkspace(currentCrm);
        if (operationsAfterWrite) await saveProjectOperations(currentOperations, operationsAfterWrite.revision);
      } catch {
        return NextResponse.json({ error: "Restore partially failed and automatic rollback could not be confirmed. Stop editing; use the exported pre-restore backup and contact the project owner." }, { status: 503 });
      }
      throw error;
    }
    return NextResponse.json({
      restored: true,
      projects: operations.projects.length,
      leads: backup.crmWorkspace.leads.length,
      message: "RR CRM and Project Passport data restored. Private signed files are retained in the current private Blob store and are not deleted by restore.",
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not restore this backup.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
