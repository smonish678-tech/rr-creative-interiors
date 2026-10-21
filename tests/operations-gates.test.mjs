import test from "node:test";
import assert from "node:assert/strict";
import {
  deriveOperationsAuditEvents,
  materializeAcceptedProjects,
  validateFinanceDocumentChanges,
  validateLeadStageTransitions,
} from "../lib/operations-gates.ts";
import { resolveCustomerIdentity } from "../lib/customer-matching.ts";

const stages = [
  { id: "new", name: "New enquiry", kind: "open", active: true, requiredFields: ["name", "contact", "project"] },
  { id: "won", name: "Won / onboarding", kind: "won", active: true, requiredFields: [] },
  { id: "lost", name: "Lost", kind: "lost", active: true, requiredFields: ["lostReason"] },
];

const customer = { id: "CUS-1", name: "Aarav Sharma", email: "aarav@example.com", phone: "9876543210" };
const oldLead = {
  id: "LD-1",
  clientId: customer.id,
  name: customer.name,
  email: customer.email,
  phone: customer.phone,
  project: "Apartment interiors",
  location: "Bengaluru",
  status: "New enquiry",
  stageId: "new",
  agreementStatus: "not-started",
  advanceStatus: "not-requested",
};

const signedContract = {
  id: "DOC-1",
  documentType: "works-contract",
  status: "signed",
  customerId: customer.id,
  leadId: oldLead.id,
  version: 1,
  signedAt: "2026-10-20T10:00:00.000Z",
  signatureEvidenceRef: "audit://signature/1",
};
const approvedPaymentPolicy = {
  id: "POLICY-1",
  version: 1,
  status: "approved",
  paymentMilestones: [
    { id: "BOOKING-ADVANCE", purpose: "booking_advance", percentage: 10, active: true },
  ],
};
const verifiedReceipt = {
  id: "REC-1",
  type: "Cash receipt",
  paymentPurpose: "booking_advance",
  paymentPolicyId: approvedPaymentPolicy.id,
  paymentPolicyVersion: approvedPaymentPolicy.version,
  paymentMilestoneId: "BOOKING-ADVANCE",
  clientId: customer.id,
  leadId: oldLead.id,
  appliesToInvoiceId: "INV-1",
  amount: 10000,
  tax: 0,
  paid: 10000,
  status: "Paid",
  paymentVerificationStatus: "verified",
  paymentVerificationReference: "BANK-UTR-12345",
  paymentVerifiedAt: "2026-10-20T11:00:00.000Z",
};
const validWonLead = {
  ...oldLead,
  status: "Won / onboarding",
  stageId: "won",
  agreementStatus: "signed",
  advanceStatus: "received",
  signedContractDocumentId: signedContract.id,
  verifiedAdvanceTransactionId: verifiedReceipt.id,
};

test("same-name people are not merged by name alone", () => {
  const twoPeople = [
    { ...customer, id: "CUS-A", email: "one@example.com", phone: "9876543210" },
    { ...customer, id: "CUS-B", email: "two@example.com", phone: "9123456780" },
  ];
  const result = resolveCustomerIdentity(twoPeople, "new@example.com", "9000000000");
  assert.equal(result.status, "none");
});

test("contradictory email and phone matches require human review", () => {
  const twoPeople = [
    { ...customer, id: "CUS-A", email: "one@example.com", phone: "9876543210" },
    { ...customer, id: "CUS-B", email: "two@example.com", phone: "9123456780" },
  ];
  const result = resolveCustomerIdentity(twoPeople, "one@example.com", "9123456780");
  assert.equal(result.status, "conflict");
});

test("moving a lead to Won is blocked without signed-version and bank-verification evidence", () => {
  const candidate = {
    ...oldLead,
    status: "Won / onboarding",
    stageId: "won",
    agreementStatus: "signed",
    advanceStatus: "received",
    signedContractDocumentId: "missing-doc",
    verifiedAdvanceTransactionId: "missing-receipt",
  };
  const error = validateLeadStageTransitions({
    previousLeads: [oldLead],
    nextLeads: [candidate],
    stages,
    customers: [customer],
    documents: [],
    financeDocuments: [],
    commercialPolicies: [],
  });
  assert.match(error ?? "", /signed contract|verified advance/i);
});

test("valid Won transition requires matching signed contract and verified receipt evidence", () => {
  const error = validateLeadStageTransitions({
    previousLeads: [oldLead],
    nextLeads: [validWonLead],
    stages,
    customers: [customer],
    documents: [signedContract],
    financeDocuments: [verifiedReceipt],
    commercialPolicies: [approvedPaymentPolicy],
  });
  assert.equal(error, null);
});

test("a new stage transition with a dangling customer ID is rejected", () => {
  const error = validateLeadStageTransitions({
    previousLeads: [oldLead],
    nextLeads: [{ ...oldLead, clientId: "MISSING", status: "Lost", stageId: "lost", lostReason: "Scope not suitable" }],
    stages,
    customers: [customer],
    documents: [],
    financeDocuments: [],
    commercialPolicies: [],
  });
  assert.match(error ?? "", /customer record that does not exist/i);
});

test("receipt allocation must exactly support an increase in invoice paid amount", () => {
  const invoice = { id: "INV-1", type: "Invoice", clientId: customer.id, leadId: oldLead.id, project: oldLead.project, amount: 10000, tax: 0, paid: 0, status: "Draft" };
  const changedInvoice = { ...invoice, paid: 1000, status: "Partially paid" };
  const error = validateFinanceDocumentChanges([invoice], [changedInvoice]);
  assert.match(error ?? "", /newly verified receipts/i/i);
});

test("receipt cannot be allocated beyond the invoice total", () => {
  const invoice = { id: "INV-1", type: "Invoice", clientId: customer.id, leadId: oldLead.id, project: oldLead.project, amount: 10000, tax: 0, paid: 0, status: "Draft" };
  const changedInvoice = { ...invoice, paid: 11000, status: "Paid" };
  const receipt = { id: "REC-1", type: "Cash receipt", clientId: customer.id, leadId: oldLead.id, appliesToInvoiceId: invoice.id, project: oldLead.project, amount: 11000, tax: 0, paid: 11000, status: "Paid" };
  const error = validateFinanceDocumentChanges([invoice], [changedInvoice, receipt]);
  assert.match(error ?? "", /beyond its total/i);
});

test("a receipt starts awaiting verification and cannot self-assert that it is verified", () => {
  const receipt = { id: "REC-2", type: "Cash receipt", clientId: customer.id, leadId: oldLead.id, project: oldLead.project, amount: 500, tax: 0, paid: 500, status: "Paid", paymentVerificationStatus: "verified" };
  const error = validateFinanceDocumentChanges([], [receipt]);
  assert.match(error ?? "", /must begin in Awaiting verification/i);
});

test("duplicate finance document IDs are rejected instead of double-counted", () => {
  const first = { id: "REC-1", type: "Cash receipt", clientId: customer.id, project: oldLead.project, amount: 500, tax: 0, paid: 500, status: "Paid" };
  const error = validateFinanceDocumentChanges([], [first, { ...first }]);
  assert.match(error ?? "", /Duplicate financial document ID/i);
});

test("verified receipt transition atomically releases only the amount reconciled to it", () => {
  const invoice = { id: "INV-VERIFY", type: "Invoice", clientId: customer.id, leadId: oldLead.id, project: oldLead.project, amount: 10000, tax: 0, paid: 0, status: "Draft" };
  const invoicePaid = { ...invoice, paid: 1000, status: "Partially paid" };
  const pending = { id: "REC-VERIFY", type: "Cash receipt", clientId: customer.id, leadId: oldLead.id, appliesToInvoiceId: invoice.id, project: oldLead.project, amount: 1000, tax: 0, paid: 1000, status: "Awaiting verification", paymentVerificationStatus: "awaiting_verification" };
  const verified = { ...pending, status: "Paid", paymentVerificationStatus: "verified", paymentVerificationReference: "BANK-UTR-55", paymentVerifiedAt: "2026-10-21T10:00:00.000Z", paymentVerifiedBy: "admin-session" };
  const withoutExplicitWorkflow = validateFinanceDocumentChanges([invoice, pending], [invoicePaid, verified]);
  assert.match(withoutExplicitWorkflow ?? "", /audited verification workflow/i);
  const accepted = validateFinanceDocumentChanges([invoice, pending], [invoicePaid, verified], { allowVerifiedReceiptTransition: true });
  assert.equal(accepted, null);
});

test("accepted sale creates one blocked project exactly once", () => {
  const first = materializeAcceptedProjects({
    previousLeads: [oldLead],
    nextLeads: [validWonLead],
    stages,
    customers: [customer],
    existingProjects: [],
    existingProperties: [],
    now: "2026-10-21T00:00:00.000Z",
  });
  assert.equal(first.ok, true);
  if (!first.ok) return;
  assert.equal(first.createdProjects.length, 1);
  assert.equal(first.projects[0].operationalStatus, "blocked");
  assert.ok(first.projects[0].blockers.length > 0);
  assert.equal(first.properties[0].addressVerificationStatus, "needs_confirmation");

  const retry = materializeAcceptedProjects({
    previousLeads: [validWonLead],
    nextLeads: [validWonLead],
    stages,
    customers: [customer],
    existingProjects: first.projects,
    existingProperties: first.properties,
    now: "2026-10-21T00:05:00.000Z",
  });
  assert.equal(retry.ok, true);
  if (!retry.ok) return;
  assert.equal(retry.projects.length, 1);
  assert.equal(retry.createdProjects.length, 0);
});

test("audit records that a receipt was entered but not treated as bank settlement", () => {
  const receipt = { ...verifiedReceipt, paymentVerificationStatus: "awaiting_verification" };
  const events = deriveOperationsAuditEvents({
    previousCustomers: [],
    nextCustomers: [customer],
    previousLeads: [],
    nextLeads: [oldLead],
    previousFinanceDocuments: [],
    nextFinanceDocuments: [receipt],
    createdProjects: [],
    now: "2026-10-21T00:00:00.000Z",
    newId: (() => { let i = 0; return () => `EVT-${++i}`; })(),
  });
  const receiptEvent = events.find((event) => event.action === "receipt.recorded_awaiting_verification");
  assert.ok(receiptEvent);
  assert.equal(receiptEvent?.after?.verificationStatus, "awaiting_verification");
  assert.match(receiptEvent?.reason ?? "", /not proof of bank settlement/i);
});
