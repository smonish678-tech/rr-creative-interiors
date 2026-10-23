import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { getSql, safeDatabaseError } from "@/lib/operations/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Administrator sign-in is required." }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  try {
    const sql = getSql();
    const jobs = projectId
      ? await sql`SELECT m.*, c.display_name AS customer_name, p.project_code FROM rr_message_jobs m JOIN rr_customers c ON c.id=m.customer_id LEFT JOIN rr_projects p ON p.id=m.project_id WHERE m.project_id=${projectId}::uuid ORDER BY m.created_at DESC LIMIT 100`
      : await sql`SELECT m.*, c.display_name AS customer_name, p.project_code FROM rr_message_jobs m JOIN rr_customers c ON c.id=m.customer_id LEFT JOIN rr_projects p ON p.id=m.project_id ORDER BY m.created_at DESC LIMIT 100`;
    return NextResponse.json({ messages: jobs }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return NextResponse.json({ error: safeDatabaseError(error) }, { status: 503 }); }
}

export async function POST(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Administrator sign-in is required." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await request.json() as Record<string, unknown>; }
  catch { return NextResponse.json({ error: "A valid message request is required." }, { status: 400 }); }
  const customerId = typeof body.customerId === "string" ? body.customerId : "";
  const projectId = typeof body.projectId === "string" && /^[0-9a-f-]{36}$/i.test(body.projectId) ? body.projectId : null;
  const channel = body.channel === "email" ? "email" : "whatsapp_manual";
  const templateKey = typeof body.templateKey === "string" ? body.templateKey : "";
  const idempotencyKey = typeof body.idempotencyKey === "string" ? body.idempotencyKey.slice(0, 180) : "";
  const allowedTemplates = new Set(["enquiry_followup","quote_ready","booking_received","design_approval","payment_reminder","production_update","site_readiness","handover_ready","warranty_registered","warranty_claim_update"]);
  if (!/^[0-9a-f-]{36}$/i.test(customerId) || !allowedTemplates.has(templateKey) || !idempotencyKey) {
    return NextResponse.json({ error: "Choose a customer, an approved message template and a unique idempotency key." }, { status: 400 });
  }
  try {
    const sql = getSql();
    const customers = await sql`SELECT id, display_name, primary_email, primary_phone FROM rr_customers WHERE id=${customerId}::uuid AND archived_at IS NULL LIMIT 1`;
    if (!customers.length) return NextResponse.json({ error: "Customer not found." }, { status: 404 });
    const customer = customers[0];
    const recipient = channel === "email" ? String(customer.primary_email || "") : String(customer.primary_phone || "");
    if (!recipient) return NextResponse.json({ error: channel === "email" ? "This customer has no email address." : "This customer has no phone number." }, { status: 409 });
    const projectRows = projectId ? await sql`SELECT project_code, name FROM rr_projects WHERE id=${projectId}::uuid AND customer_id=${customerId}::uuid LIMIT 1` : [];
    if (projectId && !projectRows.length) return NextResponse.json({ error: "The project does not belong to this customer." }, { status: 400 });
    const projectName = projectRows.length ? String(projectRows[0].name) : "your interior project";
    const projectCode = projectRows.length ? String(projectRows[0].project_code) : "";
    const templates: Record<string, { subject: string; body: string }> = {
      enquiry_followup: { subject: "Your enquiry · RR Creative Interiors", body: `Hello ${customer.display_name}, thank you for contacting RR Creative Interiors. We'd be happy to understand your space and next steps. When would be a convenient time to speak?` },
      quote_ready: { subject: `Quotation ready · ${projectCode}`, body: `Hello ${customer.display_name}, your quotation for ${projectName} is ready for review. Please review the attached/current version and let us know if you have questions. This message does not itself constitute acceptance.` },
      booking_received: { subject: `Booking next steps · ${projectCode}`, body: `Hello ${customer.display_name}, we're preparing the booking documents for ${projectName}. The project will be marked booked once the required signed documents and payment verification are complete.` },
      design_approval: { subject: `Design review · ${projectCode}`, body: `Hello ${customer.display_name}, your current design version for ${projectName} is ready for review. Please use the project approval link shared separately and request changes if anything needs attention.` },
      payment_reminder: { subject: `Payment milestone · ${projectCode}`, body: `Hello ${customer.display_name}, this is a reminder about the payment milestone recorded for ${projectName}. Please refer to the current approved quotation/contract for the amount and due condition. Contact us if you believe this reminder is incorrect.` },
      production_update: { subject: `Project update · ${projectCode}`, body: `Hello ${customer.display_name}, here's an update on ${projectName}. We'll share the next confirmed milestone as soon as the relevant production checks are complete.` },
      site_readiness: { subject: `Site readiness · ${projectCode}`, body: `Hello ${customer.display_name}, before installation at ${projectName}, please confirm site access and readiness with our team. We'll confirm timing after the readiness checklist is reviewed.` },
      handover_ready: { subject: `Handover coordination · ${projectCode}`, body: `Hello ${customer.display_name}, we're coordinating the handover for ${projectName}. We'll confirm the checklist, outstanding snags (if any) and document pack before the handover is marked complete.` },
      warranty_registered: { subject: `Warranty documents · ${projectCode}`, body: `Hello ${customer.display_name}, the warranty record for ${projectName} has been prepared. Please retain the issued certificate and refer to its specific coverage and exclusions.` },
      warranty_claim_update: { subject: `Warranty service update · ${projectCode}`, body: `Hello ${customer.display_name}, we've updated the service record for ${projectName}. Our team will follow up on the next action recorded for your claim.` }
    };
    const template = templates[templateKey];
    const id = randomUUID();
    const rows = await sql`INSERT INTO rr_message_jobs (id, project_id, customer_id, channel, template_key, recipient, rendered_subject, rendered_body, status, idempotency_key, created_by)
      VALUES (${id}::uuid, ${projectId}::uuid, ${customerId}::uuid, ${channel}, ${templateKey}, ${recipient}, ${template.subject}, ${template.body}, 'draft', ${idempotencyKey}, 'admin')
      ON CONFLICT (idempotency_key) DO UPDATE SET updated_at=rr_message_jobs.updated_at RETURNING *`;
    const row = rows[0];
    const waUrl = channel === "whatsapp_manual" ? `https://wa.me/${recipient.replace(/\D/g, "")}?text=${encodeURIComponent(template.body)}` : null;
    const emailUrl = channel === "email" ? `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(recipient)}&su=${encodeURIComponent(template.subject)}&body=${encodeURIComponent(template.body)}` : null;
    return NextResponse.json({ message: row, whatsappUrl: waUrl, emailUrl, note: "This is a draft. Opening WhatsApp/Gmail does not mean the message was sent; mark it sent only after confirming the real outcome." }, { status: 201 });
  } catch (error) { return NextResponse.json({ error: safeDatabaseError(error) }, { status: 503 }); }
}
