import { randomUUID } from "node:crypto";
import { del, put } from "@vercel/blob";
import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import {
  loadOperationsWorkspaceSnapshot,
  saveOperationsWorkspace,
  WorkspaceConflictError,
  type OperationsWorkspace,
  type WorkspaceRecord,
} from "@/lib/workspace-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PDF_BYTES = 15 * 1024 * 1024;
const SIGNED_TYPES = new Set([
  "works_contract",
  "final_contract",
  "signed_design_approval",
  "installation_signoff",
  "handover_acceptance",
]);
const ALLOWED_TYPES = new Set([
  "works_contract",
  "final_contract",
  "approved_quotation",
  "signed_design_approval",
  "production_specification",
  "production_qc",
  "production_completion",
  "installation_signoff",
  "handover_acceptance",
  "warranty_certificate",
  "project_closure",
]);

function errorResponse(message: string, status: number, code?: string) {
  return NextResponse.json({ error: message, ...(code ? { code } : {}) }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function str(value: FormDataEntryValue | null, max = 500): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function cleanFilename(value: string): string {
  const cleaned = value.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^[-.]+|[-.]+$/g, "").slice(-100);
  return cleaned.toLowerCase().endsWith(".pdf") ? cleaned : `${cleaned || "document"}.pdf`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return errorResponse("Administrator sign-in is required.", 401);

  const privateToken = process.env.OPERATIONS_PRIVATE_BLOB_READ_WRITE_TOKEN;
  if (!privateToken) {
    return errorResponse("Private document storage is not configured. Create a separate private Vercel Blob store and set OPERATIONS_PRIVATE_BLOB_READ_WRITE_TOKEN before uploading customer documents.", 503, "PRIVATE_DOCUMENT_STORAGE_NOT_CONFIGURED");
  }

  let uploadedPath: string | null = null;
  try {
    const form = await request.formData();
    const file = form.get("file");
    const revisionField = str(form.get("revision"), 256);
    const expectedRevision = revisionField || null;
    const documentType = str(form.get("documentType"), 80);
    const leadId = str(form.get("leadId"), 160);
    const projectId = str(form.get("projectId"), 160);
    const signedAtInput = str(form.get("signedAt"), 80);
    const signatureEvidenceRef = str(form.get("signatureEvidenceRef"), 1000);
    const approvalEvidenceRef = str(form.get("approvalEvidenceRef"), 1000);

    if (!(file instanceof File)) return errorResponse("Choose a PDF document to upload.", 400);
    if (!ALLOWED_TYPES.has(documentType)) return errorResponse("Choose a supported operations document type.", 400);
    if (file.size <= 0 || file.size > MAX_PDF_BYTES) return errorResponse("PDFs must be between 1 byte and 15 MB.", 413);
    if (file.type && file.type !== "application/pdf") return errorResponse("Only PDF uploads are accepted for contracts and project evidence.", 415);
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (new TextDecoder().decode(bytes.slice(0, 5)) !== "%PDF-") return errorResponse("The uploaded file does not have a valid PDF signature.", 415);

    if (SIGNED_TYPES.has(documentType) && (!signedAtInput || !signatureEvidenceRef)) {
      return errorResponse("For signed evidence, record the signed date and signature/audit-trail reference. Upload only a document already executed outside this workspace.", 422, "SIGNATURE_EVIDENCE_REQUIRED");
    }
    const parsedSignedAt = signedAtInput ? new Date(signedAtInput) : null;
    if (signedAtInput && (!parsedSignedAt || Number.isNaN(parsedSignedAt.getTime()))) {
      return errorResponse("The signed date is invalid.", 400);
    }
    if (documentType === "approved_quotation" && !approvalEvidenceRef) {
      return errorResponse("Add the external RR approval reference for this quotation. Uploading alone does not approve a quotation.", 422, "APPROVAL_EVIDENCE_REQUIRED");
    }

    const snapshot = await loadOperationsWorkspaceSnapshot();
    if (snapshot.revision !== expectedRevision) return errorResponse("The workspace changed in another session. Refresh and try again.", 409, "WORKSPACE_CONFLICT");
    const workspace = snapshot.workspace;
    const lead = leadId ? workspace.leads.find((item) => item.id === leadId) : undefined;
    const project = projectId ? workspace.projects.find((item) => item.id === projectId) as WorkspaceRecord | undefined : undefined;
    if (leadId && !lead) return errorResponse("The linked CRM opportunity was not found.", 404);
    if (projectId && !project) return errorResponse("The linked project was not found.", 404);
    if ((documentType === "works_contract" || documentType === "final_contract" || documentType === "approved_quotation" || documentType === "signed_design_approval") && !lead) {
      return errorResponse("Link contracts, quotations and design approval to a CRM opportunity.", 422);
    }
    if (project && lead && project.sourceOpportunityId !== lead.id) return errorResponse("The selected project belongs to a different CRM opportunity.", 422);
    if (project && !leadId && typeof project.sourceOpportunityId === "string" && !workspace.leads.some((item) => item.id === project.sourceOpportunityId)) {
      return errorResponse("This project has no valid source opportunity. Reconcile its link before adding records.", 422);
    }

    const customerId = str(lead?.clientId as string || (project?.customerId as string) || "", 160);
    const previousVersions = workspace.documents
      .filter((document) => document.documentType === documentType &&
        ((leadId && document.leadId === leadId) || (projectId && document.projectId === projectId)))
      .reduce((max, document) => Math.max(max, Number(document.version) || 0), 0);
    const version = previousVersions + 1;
    const id = randomUUID();
    const pathname = `rr-creative-interiors/operations-documents/${id}/v${version}-${cleanFilename(file.name)}`;
    const blob = await put(pathname, bytes, {
      access: "private",
      token: privateToken,
      contentType: "application/pdf",
      addRandomSuffix: false,
    });
    uploadedPath = blob.pathname;

    const isSigned = SIGNED_TYPES.has(documentType);
    const metadata: WorkspaceRecord = {
      id,
      documentType,
      name: cleanFilename(file.name),
      contentType: "application/pdf",
      sizeBytes: file.size,
      storagePath: blob.pathname,
      leadId: lead?.id || (typeof project?.sourceOpportunityId === "string" ? project.sourceOpportunityId : ""),
      projectId: project?.id || "",
      customerId,
      version,
      status: documentType === "approved_quotation" ? "approved" : isSigned ? "signed" : "uploaded",
      ...(isSigned ? { signedAt: parsedSignedAt!.toISOString(), signatureEvidenceRef } : {}),
      ...(approvalEvidenceRef ? { approvalEvidenceRef } : {}),
      uploadedAt: new Date().toISOString(),
      uploadedBy: "authenticated-admin",
      signatureValidationNote: isSigned
        ? "The authenticated administrator attested that an already-executed PDF was uploaded and supplied a signature/audit reference; no external e-signature provider was queried by the application."
        : undefined,
      approvalValidationNote: approvalEvidenceRef
        ? "An external approval reference was supplied by the administrator; the application does not independently authenticate the approver."
        : undefined,
    };
    const documents = [...workspace.documents, metadata];
    const leads = workspace.leads.map((item) => {
      if (!lead || item.id !== lead.id || !SIGNED_TYPES.has(documentType) || !["works_contract", "final_contract"].includes(documentType)) return item;
      return {
        ...item,
        agreementStatus: "signed",
        signedContractDocumentId: id,
      };
    });
    const auditEvent: WorkspaceRecord = {
      id: randomUUID(),
      occurredAt: new Date().toISOString(),
      actor: "admin-session",
      action: "document.private_pdf_uploaded",
      entityType: "workspace",
      entityId: id,
      after: {
        documentType,
        version,
        leadId: metadata.leadId,
        projectId: metadata.projectId,
        customerId,
        status: metadata.status,
        signatureEvidenceRecorded: Boolean(signatureEvidenceRef),
        approvalEvidenceRecorded: Boolean(approvalEvidenceRef),
      },
      reason: "PDF stored in private Vercel Blob; metadata and status reflect administrator-supplied evidence only. Upload does not by itself confirm the legal validity of the document.",
    };
    const nextWorkspace: OperationsWorkspace = {
      ...workspace,
      leads,
      documents,
      auditEvents: [...workspace.auditEvents, auditEvent],
    };
    try {
      const nextRevision = await saveOperationsWorkspace(nextWorkspace, snapshot.revision);
      return NextResponse.json({ saved: true, revision: nextRevision, document: { ...metadata, storagePath: undefined } }, {
        headers: { "Cache-Control": "no-store" },
      });
    } catch (error) {
      await del(blob.pathname, { access: "private", token: privateToken }).catch(() => null);
      uploadedPath = null;
      throw error;
    }
  } catch (error) {
    if (error instanceof WorkspaceConflictError) return errorResponse(error.message, 409, "WORKSPACE_CONFLICT");
    return errorResponse(error instanceof Error ? error.message : "Document upload failed.", 503);
  } finally {
    void uploadedPath;
  }
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return errorResponse("Administrator sign-in is required.", 401);
  const privateToken = process.env.OPERATIONS_PRIVATE_BLOB_READ_WRITE_TOKEN;
  if (!privateToken) return errorResponse("Private document storage is not configured.", 503, "PRIVATE_DOCUMENT_STORAGE_NOT_CONFIGURED");
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id")?.trim() || "";
    if (!id || id.length > 160) return errorResponse("Provide a valid document ID.", 400);
    const snapshot = await loadOperationsWorkspaceSnapshot();
    const metadata = snapshot.workspace.documents.find((document) => document.id === id);
    if (!metadata || typeof metadata.storagePath !== "string" || !metadata.storagePath.startsWith("rr-creative-interiors/operations-documents/")) {
      return errorResponse("Private document was not found.", 404);
    }
    const stored = await (await import("@vercel/blob")).get(metadata.storagePath, {
      access: "private",
      token: privateToken,
      useCache: false,
    });
    if (!stored || stored.statusCode !== 200) return errorResponse("Could not read the private document.", 502);
    const filename = cleanFilename(typeof metadata.name === "string" ? metadata.name : "operations-document.pdf");
    return new Response(stored.stream, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Could not download the document.", 503);
  }
}
