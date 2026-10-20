import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-auth";
import { getSql, safeDatabaseError } from "@/lib/operations/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character] || character);
}

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!isAdminRequest(request)) return NextResponse.json({ error: "Administrator sign-in is required." }, { status: 401 });
  const { id } = await context.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Document ID is invalid." }, { status: 400 });
  try {
    const sql = getSql();
    const rows = await sql`SELECT d.*, p.project_code, p.name AS project_name, c.display_name AS customer_name, c.primary_email, c.primary_phone
      FROM rr_documents d JOIN rr_projects p ON p.id=d.project_id JOIN rr_customers c ON c.id=d.customer_id WHERE d.id=${id}::uuid LIMIT 1`;
    if (!rows.length) return NextResponse.json({ error: "Document not found." }, { status: 404 });
    const d = rows[0];
    const snapshot = (d.source_snapshot || {}) as Record<string, unknown>;
    const details = Object.entries(snapshot).filter(([key]) => !["generatedAt","templateVersion","project","customer"].includes(key));
    const fields = details.map(([key, value]) => {
      const rendered = typeof value === "string" ? value : JSON.stringify(value, null, 2);
      return `<div class="field"><span>${escapeHtml(key.replace(/([A-Z])/g, " $1").replaceAll("_", " "))}</span><p>${escapeHtml(rendered)}</p></div>`;
    }).join("");
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(d.document_number)} · RR Creative Interiors</title><style>
      @page{size:A4;margin:18mm}*{box-sizing:border-box}body{font:14px/1.6 Arial,sans-serif;color:#29231e;margin:0;background:#fff}.actions{position:sticky;top:0;padding:12px 5%;background:#29231e;color:#fff;display:flex;justify-content:space-between;align-items:center}.actions button{border:0;background:#d6b476;padding:10px 18px;font-weight:700;cursor:pointer}.sheet{max-width:820px;margin:38px auto;padding:0 38px}.brand{font:700 21px Georgia,serif;letter-spacing:1px}.sub{font-size:10px;letter-spacing:2px;color:#8a6a38}.rule{height:3px;background:#b39156;margin:18px 0 28px}.kind{font:26px Georgia,serif;color:#9c7b45;margin:0 0 4px}.number{color:#796d60;font-size:12px}.meta{display:grid;grid-template-columns:1fr 1fr;gap:16px;background:#f8f5ef;padding:18px;margin:24px 0}.meta span,.field span{display:block;font-size:10px;letter-spacing:1.4px;text-transform:uppercase;color:#8b7a64}.meta strong{display:block;margin-top:4px}.field{border-bottom:1px solid #e9e2d8;padding:13px 0;white-space:pre-wrap;overflow-wrap:anywhere}.field p{margin:6px 0 0}.notice{margin-top:28px;background:#f8f5ef;padding:14px;font-size:12px;color:#665849}.footer{margin-top:54px;border-top:1px solid #ded4c7;padding-top:14px;color:#8b7a64;font-size:11px}@media print{.actions{display:none}.sheet{margin:0 auto;padding:0}.field{break-inside:avoid}}
      </style></head><body><div class="actions"><span>RR CREATIVE INTERIORS · Draft preview</span><button onclick="window.print()">Print / Save PDF</button></div><main class="sheet"><div class="brand">RR CREATIVE INTERIORS</div><div class="sub">BEYOND THE ORDINARY</div><div class="rule"></div><h1 class="kind">${escapeHtml(String(d.title))}</h1><div class="number">${escapeHtml(d.document_number)} · Version ${escapeHtml(d.version)} · Status: ${escapeHtml(d.status)}</div><section class="meta"><div><span>Customer</span><strong>${escapeHtml(d.customer_name)}</strong><div>${escapeHtml(d.primary_email || "")}</div><div>${escapeHtml(d.primary_phone || "")}</div></div><div><span>Project</span><strong>${escapeHtml(d.project_name)}</strong><div>${escapeHtml(d.project_code)}</div><div>Generated: ${escapeHtml(new Date(String(d.created_at)).toLocaleDateString("en-IN"))}</div></div></section>${fields}<div class="notice">This is a generated draft. Verify scope, commercial terms, tax treatment and required signatures before issuing to a customer. A printed or emailed draft is not recorded as signed merely because it was opened.</div><div class="footer">RR Creative Interiors · Bengaluru, Karnataka · www.rrcreativeinteriors.in<br>Template ${escapeHtml(snapshot.templateVersion || "rr-ops-v1")} · Keep the issued version with the project record.</div></main></body></html>`;
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'" } });
  } catch (error) {
    return NextResponse.json({ error: safeDatabaseError(error) }, { status: 503 });
  }
}
