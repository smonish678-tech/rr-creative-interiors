import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import {
  hasDuplicateVerifiedPaymentReference,
  isApprovedBookingAdvanceReceipt,
  validateFinanceDocumentChanges,
  type FinanceDocument,
  type OperationLead,
} from "@/lib/operations-gates";
import {
  loadOperationsWorkspaceSnapshot,
  saveOperationsWorkspace,
  WorkspaceConflictError,
  type OperationsWorkspace,
  type WorkspaceRecord,
} from "@/lib/workspace-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(message: string, status: number, code?: string) {
  return NextResponse.json({ error: message, ...(code ? { code } : {}) }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function cents(value: unknown): number {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) ? Math.round((numeric + Number.EPSILON) * 100) : Number.NaN;
}

function invoiceTotalCents(invoice: FinanceDocument): number {
  const base = cents(invoice.amount);
  const tax = Number(invoice.tax);
  return Number.isFinite(base) && Number.isFinite(tax) && tax >= 0
    ? Math.round(base * (1 + tax / 100))
    : Number.NaN;
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return errorResponse("Administrator sign-in is required.", 401);

  try {
    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return errorResponse("Payment verification request is invalid.", 400);
    }
    const input = body as Record<string, unknown>;
    const receiptId = typeof input.receiptId === "string" ? input.receiptId.trim() : "";
    const reference = typeof input.verificationReference === "string" ? input.verificationReference.trim() : "";
    const notes = typeof input.notes === "string" ? input.notes.trim() : "";
    const revision = input.revision;

    if (!receiptId || receiptId.length > 160 || !reference || reference.length > 200 || notes.length > 1000 ||
      !(revision === null || (typeof revision === "string" && revision.length > 0 && revision.length <= 256))) {
      return errorResponse("Enter the receipt, bank/gateway reference and current workspace revision.", 400);
    }

    const snapshot = await loadOperationsWorkspaceSnapshot();
    if (revision !== snapshot.revision) {
      return errorResponse("The workspace changed in another session. Refresh before verifying this receipt.", 409, "WORKSPACE_CONFLICT");
    }

    const workspace = snapshot.workspace;
    const documents = workspace.invoices as FinanceDocument[];
    const receipt = documents.find((item) => item.id === receiptId && item.type === "Cash receipt");
    if (!receipt) return errorResponse("The selected receipt does not exist in this workspace.", 404);

    const currentStatus = typeof receipt.paymentVerificationStatus === "string" ? receipt.paymentVerificationStatus : "";
    if (hasDuplicateVerifiedPaymentReference(documents, receipt.id, reference)) {
      return errorResponse("This bank/gateway reference is already attached to another verified receipt. Reconcile the transaction before continuing.", 409, "DUPLICATE_PAYMENT_REFERENCE");
    }
    if (currentStatus === "verified") {
      if (receipt.paymentVerificationReference === reference) {
        return NextResponse.json({
          saved: true,
          idempotent: true,
          revision: snapshot.revision,
          receipt,
          invoice: receipt.appliesToInvoiceId ? documents.find((item) => item.id === receipt.appliesToInvoiceId) ?? null : null,
          lead: null,
          advanceEligible: isApprovedBookingAdvanceReceipt(receipt, workspace.commercialPolicies as never[]),
        }, { headers: { "Cache-Control": "no-store" } });
      }
      return errorResponse("This receipt is already verified against another bank/gateway reference; use the adjustment review workflow rather than rewriting history.", 409, "RECEIPT_ALREADY_VERIFIED");
    }
    if (currentStatus !== "awaiting_verification") {
      return errorResponse("This is a historical receipt without a current verification state. Reconcile its historic invoice allocation before deciding whether it can be verified.", 422, "LEGACY_RECEIPT_REVIEW_REQUIRED");
    }

    const amountCents = cents(receipt.amount);
    if (!Number.isFinite(amountCents) || amountCents <= 0 || cents(receipt.paid) !== amountCents || Number(receipt.tax) !== 0) {
      return errorResponse("The receipt amount is invalid. Do not verify it until the receipt is corrected through an authorised adjustment workflow.", 422, "RECEIPT_AMOUNT_INVALID");
    }

    let allocatedInvoice: FinanceDocument | undefined;
    if (receipt.appliesToInvoiceId) {
      allocatedInvoice = documents.find((item) => item.id === receipt.appliesToInvoiceId && item.type === "Invoice");
      if (!allocatedInvoice) return errorResponse("The invoice linked to this receipt no longer exists.", 422, "INVOICE_LINK_INVALID");
      if (allocatedInvoice.clientId && receipt.clientId && allocatedInvoice.clientId !== receipt.clientId) {
        return errorResponse("The receipt and invoice belong to different customers. This allocation needs owner review.", 422, "CUSTOMER_LINK_CONFLICT");
      }
      if (allocatedInvoice.leadId && receipt.leadId && allocatedInvoice.leadId !== receipt.leadId) {
        return errorResponse("The receipt and invoice refer to different CRM opportunities. This allocation needs owner review.", 422, "PROJECT_LINK_CONFLICT");
      }
      if ((String(allocatedInvoice.project || "").trim().toLocaleLowerCase()) !== (String(receipt.project || "").trim().toLocaleLowerCase())) {
        return errorResponse("The receipt project does not match the linked invoice project.", 422, "PROJECT_LINK_CONFLICT");
      }
      const otherPendingCents = documents.filter((item) =>
        item.type === "Cash receipt" &&
        item.id !== receipt.id &&
        item.appliesToInvoiceId === allocatedInvoice!.id &&
        item.paymentVerificationStatus === "awaiting_verification"
      ).reduce((sum, item) => sum + cents(item.amount), 0);
      const availableCents = invoiceTotalCents(allocatedInvoice) - cents(allocatedInvoice.paid) - otherPendingCents;
      if (amountCents > availableCents) {
        return errorResponse("The invoice balance changed or other pending receipts use this balance. Review the allocations before verifying.", 422, "INVOICE_BALANCE_CONFLICT");
      }
    }

    const now = new Date().toISOString();
    const verifiedReceipt: FinanceDocument = {
      ...receipt,
      status: "Paid",
      paymentVerificationStatus: "verified",
      paymentVerificationReference: reference,
      paymentVerifiedAt: now,
      paymentVerifiedBy: "authenticated-admin",
      paymentVerificationNotes: notes,
    };
    const nextInvoices = documents.map((item) => item.id === receipt.id ? verifiedReceipt : item);
    let updatedInvoice: FinanceDocument | null = null;

    if (allocatedInvoice) {
      const paidCents = cents(allocatedInvoice.paid) + amountCents;
      const totalCents = invoiceTotalCents(allocatedInvoice);
      updatedInvoice = {
        ...allocatedInvoice,
        paid: paidCents / 100,
        status: paidCents >= totalCents ? "Paid" : "Partially paid",
      };
      const index = nextInvoices.findIndex((item) => item.id === allocatedInvoice!.id);
      nextInvoices[index] = updatedInvoice;
    }

    const financeError = validateFinanceDocumentChanges(documents, nextInvoices, { allowVerifiedReceiptTransition: true });
    if (financeError) return errorResponse(financeError, 422, "FINANCE_VALIDATION_FAILED");

    const commercialPolicies = workspace.commercialPolicies as never[];
    const advanceEligible = isApprovedBookingAdvanceReceipt(verifiedReceipt, commercialPolicies);
    let updatedLead: OperationLead | null = null;
    if (advanceEligible && verifiedReceipt.leadId) {
      const lead = workspace.leads.find((item) => item.id === verifiedReceipt.leadId);
      if (lead && (!verifiedReceipt.clientId || lead.clientId === verifiedReceipt.clientId)) {
        updatedLead = {
          ...lead,
          advanceStatus: "received",
          verifiedAdvanceTransactionId: verifiedReceipt.id,
        } as OperationLead;
      }
    }

    const auditEvent: WorkspaceRecord = {
      id: randomUUID(),
      occurredAt: now,
      actor: "authenticated-admin",
      action: "payment.receipt_verified",
      entityType: "receipt",
      entityId: verifiedReceipt.id,
      before: {
        paymentVerificationStatus: currentStatus,
        invoiceId: allocatedInvoice?.id ?? null,
        invoicePaidCentsBefore: allocatedInvoice ? cents(allocatedInvoice.paid) : null,
      },
      after: {
        paymentVerificationStatus: "verified",
        paymentVerificationReference: reference,
        invoiceId: updatedInvoice?.id ?? null,
        invoicePaidCentsAfter: updatedInvoice ? cents(updatedInvoice.paid) : null,
        advanceEligible,
      },
      amountCents,
      reason: "An authenticated administrator recorded a bank/gateway reference after manual reconciliation. This endpoint does not independently query the bank.",
    };

    const nextLeads = updatedLead
      ? workspace.leads.map((item) => item.id === updatedLead!.id ? updatedLead! : item)
      : workspace.leads;
    const nextWorkspace: OperationsWorkspace = {
      ...workspace,
      leads: nextLeads,
      invoices: nextInvoices as unknown as WorkspaceRecord[],
      auditEvents: [...workspace.auditEvents, auditEvent],
    };
    const nextRevision = await saveOperationsWorkspace(nextWorkspace, snapshot.revision);

    return NextResponse.json({
      saved: true,
      idempotent: false,
      revision: nextRevision,
      receipt: verifiedReceipt,
      invoice: updatedInvoice,
      lead: updatedLead,
      advanceEligible,
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof WorkspaceConflictError) {
      return errorResponse(error.message, 409, "WORKSPACE_CONFLICT");
    }
    const message = error instanceof Error ? error.message : "Could not verify the payment receipt.";
    return errorResponse(message, 503, "PAYMENT_VERIFICATION_UNAVAILABLE");
  }
}
