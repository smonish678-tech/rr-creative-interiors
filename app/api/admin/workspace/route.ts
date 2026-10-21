import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { isSalesPipelineStageList, normalizeSalesPipeline } from "@/lib/sales-pipeline";
import {
  deriveOperationsAuditEvents,
  materializeAcceptedProjects,
  validateFinanceDocumentChanges,
  validateLeadStageTransitions,
  type FinanceDocument,
  type OperationCustomer,
  type OperationDocument,
  type OperationLead,
  type OperationProject,
  type OperationProperty,
} from "@/lib/operations-gates";
import {
  loadOperationsWorkspaceSnapshot,
  saveOperationsWorkspace,
  WorkspaceConflictError,
  type OperationsWorkspace,
} from "@/lib/workspace-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json({ error: "Administrator sign-in is required." }, {
    status: 401,
    headers: { "Cache-Control": "no-store" },
  });
}

function unavailable(error: unknown) {
  const message = error instanceof Error ? error.message : "The operations workspace is unavailable.";
  return NextResponse.json({ error: message }, {
    status: 503,
    headers: { "Cache-Control": "no-store" },
  });
}

function conflict(message: string) {
  return NextResponse.json({ error: message, code: "WORKSPACE_CONFLICT" }, {
    status: 409,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();
  try {
    const snapshot = await loadOperationsWorkspaceSnapshot({ includePublicEnquiries: true });
    return NextResponse.json({
      workspace: snapshot.workspace,
      revision: snapshot.revision,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return unavailable(error);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function publicSubmissionId(record: Record<string, unknown>): string {
  return typeof record.publicSubmissionId === "string" ? record.publicSubmissionId : "";
}

function mergeUnpersistedWebsiteEnquiries(
  persisted: OperationsWorkspace,
  enriched: OperationsWorkspace,
  submittedLeads: Record<string, unknown>[],
  submittedClients: Record<string, unknown>[],
) {
  const submittedLeadIds = new Set(submittedLeads.map((lead) => typeof lead.id === "string" ? lead.id : ""));
  const persistedLeadIds = new Set(persisted.leads.map((lead) => typeof lead.id === "string" ? lead.id : ""));
  const unseenEnquiries = enriched.leads.filter((lead) =>
    publicSubmissionId(lead) &&
    !persistedLeadIds.has(typeof lead.id === "string" ? lead.id : "") &&
    !submittedLeadIds.has(typeof lead.id === "string" ? lead.id : ""),
  );
  if (!unseenEnquiries.length) return { leads: submittedLeads, clients: submittedClients };

  const leads = [...submittedLeads, ...unseenEnquiries];
  const submittedCustomerIds = new Set(submittedClients.map((customer) => typeof customer.id === "string" ? customer.id : ""));
  const referencedCustomerIds = new Set(unseenEnquiries.map((lead) => typeof lead.clientId === "string" ? lead.clientId : "").filter(Boolean));
  const customersToCarry = enriched.clients.filter((customer) =>
    typeof customer.id === "string" &&
    referencedCustomerIds.has(customer.id) &&
    !submittedCustomerIds.has(customer.id),
  );
  return { leads, clients: [...submittedClients, ...customersToCarry] };
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return unauthorized();

  try {
    const body: unknown = await request.json().catch(() => null);
    if (!isRecord(body)) {
      return NextResponse.json({ error: "Workspace data is invalid." }, { status: 400 });
    }

    const { leads, invoices, clients, studioName, studioEmail, pipelineStages, revision } = body;
    if (
      !Array.isArray(leads) ||
      !Array.isArray(invoices) ||
      leads.length > 5000 ||
      invoices.length > 5000 ||
      !leads.every(isRecord) ||
      !invoices.every(isRecord) ||
      (clients !== undefined && (!Array.isArray(clients) || clients.length > 5000 || !clients.every(isRecord))) ||
      typeof studioName !== "string" ||
      typeof studioEmail !== "string" ||
      !studioName.trim() ||
      studioName.length > 140 ||
      studioEmail.length > 254 ||
      (pipelineStages !== undefined && !isSalesPipelineStageList(pipelineStages)) ||
      !(revision === null || (typeof revision === "string" && revision.length > 0 && revision.length <= 256))
    ) {
      return NextResponse.json({ error: "Workspace data failed validation. Reload the admin workspace before saving." }, { status: 400 });
    }

    // Read the authoritative persisted state and a second view that includes
    // the append-only public enquiry inbox. Refuse to proceed if a save races
    // these reads; a new public enquiry itself does not mutate the workspace.
    const persistedSnapshot = await loadOperationsWorkspaceSnapshot();
    const enrichedSnapshot = await loadOperationsWorkspaceSnapshot({ includePublicEnquiries: true });
    if (persistedSnapshot.revision !== enrichedSnapshot.revision) {
      throw new WorkspaceConflictError();
    }
    if (revision !== persistedSnapshot.revision) {
      return conflict("The workspace changed in another admin session. Refresh the page to load the latest records, then review your changes before saving again.");
    }

    const existingWorkspace = persistedSnapshot.workspace;
    const enrichedWorkspace = enrichedSnapshot.workspace;
    const suppliedClients = (clients === undefined ? existingWorkspace.clients : clients) as Record<string, unknown>[];
    const merged = mergeUnpersistedWebsiteEnquiries(
      existingWorkspace,
      enrichedWorkspace,
      leads as Record<string, unknown>[],
      suppliedClients,
    );

    const nextLeads = merged.leads as OperationLead[];
    const nextInvoices = invoices as FinanceDocument[];
    const nextClients = merged.clients as OperationCustomer[];
    const nextPipeline = pipelineStages === undefined
      ? existingWorkspace.pipelineStages
      : normalizeSalesPipeline(pipelineStages);

    const leadError = validateLeadStageTransitions({
      previousLeads: existingWorkspace.leads as OperationLead[],
      nextLeads,
      stages: nextPipeline,
      customers: nextClients,
      documents: existingWorkspace.documents as OperationDocument[],
      financeDocuments: nextInvoices,
    });
    if (leadError) {
      return NextResponse.json({ error: leadError, code: "STAGE_GATE_BLOCKED" }, {
        status: 422,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const financeError = validateFinanceDocumentChanges(
      existingWorkspace.invoices as FinanceDocument[],
      nextInvoices,
    );
    if (financeError) {
      return NextResponse.json({ error: financeError, code: "FINANCE_VALIDATION_FAILED" }, {
        status: 422,
        headers: { "Cache-Control": "no-store" },
      });
    }

    // Receipt creation records a claim of payment only. It starts awaiting
    // bank/gateway verification; no client request can set it to verified.
    const persistedInvoiceIds = new Set(existingWorkspace.invoices.map((document) =>
      typeof document.id === "string" ? document.id : "",
    ));
    const markedInvoices = nextInvoices.map((document) => {
      if (document.type !== "Cash receipt" || persistedInvoiceIds.has(document.id)) return document;
      return { ...document, paymentVerificationStatus: "awaiting_verification" };
    });

    const generated = materializeAcceptedProjects({
      previousLeads: existingWorkspace.leads as OperationLead[],
      nextLeads,
      stages: nextPipeline,
      customers: nextClients,
      existingProjects: existingWorkspace.projects as unknown as OperationProject[],
      existingProperties: existingWorkspace.properties as unknown as OperationProperty[],
      now: new Date().toISOString(),
    });
    if (!generated.ok) {
      return NextResponse.json({ error: generated.message, code: "PROJECT_LINK_CONFLICT" }, {
        status: 422,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const now = new Date().toISOString();
    const auditEvents = deriveOperationsAuditEvents({
      previousCustomers: existingWorkspace.clients as OperationCustomer[],
      nextCustomers: nextClients,
      previousLeads: existingWorkspace.leads as OperationLead[],
      nextLeads,
      previousFinanceDocuments: existingWorkspace.invoices as FinanceDocument[],
      nextFinanceDocuments: markedInvoices as FinanceDocument[],
      createdProjects: generated.createdProjects,
      now,
      newId: randomUUID,
    });

    const workspace: OperationsWorkspace = {
      leads: nextLeads,
      invoices: markedInvoices,
      clients: nextClients as unknown as Record<string, unknown>[],
      properties: generated.properties as unknown as Record<string, unknown>[],
      projects: generated.projects as unknown as Record<string, unknown>[],
      documents: existingWorkspace.documents,
      auditEvents: [...existingWorkspace.auditEvents, ...auditEvents as unknown as Record<string, unknown>[]],
      studioName: studioName.trim(),
      studioEmail: studioEmail.trim(),
      pipelineStages: nextPipeline,
    };
    const nextRevision = await saveOperationsWorkspace(workspace, persistedSnapshot.revision);
    return NextResponse.json({ saved: true, revision: nextRevision }, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof WorkspaceConflictError) {
      return conflict(error.message);
    }
    return unavailable(error);
  }
}
