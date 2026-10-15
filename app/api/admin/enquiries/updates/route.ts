import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { loadOperationsWorkspace } from "@/lib/workspace-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Administrator sign-in is required." }, { status: 401 });
  try {
    const saved = await loadOperationsWorkspace();
    const projected = await loadOperationsWorkspace({ includePublicEnquiries: true });
    const knownSubmissionIds = new Set(saved.leads.map((lead) => typeof lead.publicSubmissionId === "string" ? lead.publicSubmissionId : "").filter(Boolean));
    const additions = projected.leads.filter((lead) => typeof lead.publicSubmissionId === "string" && !knownSubmissionIds.has(lead.publicSubmissionId));
    const knownClients = new Set(saved.clients.map((client) => typeof client.id === "string" ? client.id : "").filter(Boolean));
    const neededClientIds = new Set(additions.map((lead) => typeof lead.clientId === "string" ? lead.clientId : "").filter((id) => id && !knownClients.has(id)));
    const clients = projected.clients.filter((client) => typeof client.id === "string" && neededClientIds.has(client.id));
    return NextResponse.json({ leads: additions, clients }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not check for new website enquiries." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
