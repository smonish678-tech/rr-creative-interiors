export type CustomerRecord = {
  id: string;
  name: string;
  email: string;
  phone: string;
  createdAt: string;
  updatedAt: string;
};

export type CustomerMatchResult =
  | { status: "matched"; customer: CustomerRecord; matchedBy: "email" | "phone" | "both" }
  | { status: "none" }
  | { status: "conflict"; reason: string; candidates: CustomerRecord[] };

export function normalizeCustomerEmail(value: string | null | undefined): string {
  return (value || "").trim().toLocaleLowerCase();
}

export function normalizeCustomerPhone(value: string | null | undefined): string {
  let digits = (value || "").replace(/\D/g, "");
  // Treat common Indian dialling formats as equivalent while preserving other country prefixes.
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return digits.length >= 7 ? digits : "";
}

/**
 * Resolve identity from contact signals only. Names deliberately do not participate:
 * the same name can belong to different people, and a display name can change.
 * Contradictory or duplicated signals return a conflict for explicit review.
 */
export function resolveCustomerIdentity(
  customers: CustomerRecord[],
  emailInput: string | null | undefined,
  phoneInput: string | null | undefined,
): CustomerMatchResult {
  const email = normalizeCustomerEmail(emailInput);
  const phone = normalizeCustomerPhone(phoneInput);
  if (!email && !phone) return { status: "none" };

  const emailMatches = email
    ? customers.filter((customer) => normalizeCustomerEmail(customer.email) === email)
    : [];
  const phoneMatches = phone
    ? customers.filter((customer) => normalizeCustomerPhone(customer.phone) === phone)
    : [];

  if (emailMatches.length > 1 || phoneMatches.length > 1) {
    const candidates = [...new Map([...emailMatches, ...phoneMatches].map((customer) => [customer.id, customer])).values()];
    return {
      status: "conflict",
      reason: "This email or phone is assigned to more than one customer record. Resolve the duplicate customer records before linking.",
      candidates,
    };
  }

  const emailCustomer = emailMatches[0];
  const phoneCustomer = phoneMatches[0];
  if (emailCustomer && phoneCustomer && emailCustomer.id !== phoneCustomer.id) {
    return {
      status: "conflict",
      reason: "The email matches one customer and the phone matches another. Select the correct CRM lead or correct the contact details; RR did not merge the records.",
      candidates: [emailCustomer, phoneCustomer],
    };
  }

  const customer = emailCustomer || phoneCustomer;
  if (!customer) return { status: "none" };

  // Do not silently overwrite a stored identifier when the other supplied identifier
  // contradicts it. An explicit link to a lead is the operator's confirmation route.
  if (email && customer.email && normalizeCustomerEmail(customer.email) !== email) {
    return {
      status: "conflict",
      reason: "The phone matches an existing customer, but the supplied email differs from the email on that record. Select the intended CRM lead to confirm the link.",
      candidates: [customer],
    };
  }
  if (phone && customer.phone && normalizeCustomerPhone(customer.phone) !== phone) {
    return {
      status: "conflict",
      reason: "The email matches an existing customer, but the supplied phone differs from the phone on that record. Select the intended CRM lead to confirm the link.",
      candidates: [customer],
    };
  }

  return {
    status: "matched",
    customer,
    matchedBy: emailCustomer && phoneCustomer ? "both" : emailCustomer ? "email" : "phone",
  };
}
