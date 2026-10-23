import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getSql, safeDatabaseError } from "@/lib/operations/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function tokenHash(token: string) { return createHash("sha256").update(token).digest("hex"); }
function validToken(token: string) {
  const expiry = Number(token.split(".")[0]);
  return Number.isSafeInteger(expiry) && expiry > Math.floor(Date.now()/1000) && token.length < 200;
}

export async function GET(_request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  if (!validToken(token)) return new NextResponse("This approval link is invalid or has expired.", { status: 410 });
  try {
    const sql = getSql();
    const rows = await sql`SELECT a.status, a.approver_name, d.title, d.document_number, p.name AS project_name
      FROM rr_approvals a JOIN rr_documents d ON d.id=a.document_id JOIN rr_projects p ON p.id=a.project_id
      WHERE a.token_hash=${tokenHash(token)} LIMIT 1`;
    if (!rows.length) return new NextResponse("This approval link is invalid or has expired.", { status: 404 });
    const a = rows[0];
    const canRespond = a.status === "pending";
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Project approval · RR Creative Interiors</title><style>body{font:16px/1.55 Arial,sans-serif;background:#f6f2eb;color:#2d241c;margin:0;padding:28px}.card{max-width:620px;margin:8vh auto;background:#fff;padding:clamp(24px,5vw,48px);border:1px solid #e8dfd1}small{letter-spacing:2px;color:#8e6b39}.brand{font:700 20px Georgia;margin-bottom:34px}h1{font:32px Georgia;margin:10px 0}p{color:#65594c}.meta{padding:18px;background:#f8f5ef;margin:24px 0}.actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:24px}button{padding:13px 18px;border:0;cursor:pointer;font-weight:700}.approve{background:#2d4b38;color:#fff}.changes{background:#eee7dc;color:#2d241c}textarea{width:100%;min-height:90px;padding:12px;border:1px solid #d9cdbb;box-sizing:border-box}button:disabled{opacity:.5;cursor:not-allowed}#result{margin-top:18px;font-weight:600}</style></head><body><main class="card"><div class="brand">RR CREATIVE INTERIORS</div><small>PROJECT PASSPORT · APPROVAL</small><h1>One clear decision.</h1><p>This page records your response to a specific project document. Please review the document shared with you by RR before choosing an option.</p><div class="meta"><b>${String(a.title).replace(/[&<>"]/g, "")}</b><p>Document: ${String(a.document_number).replace(/[&<>"]/g, "")}<br>Project: ${String(a.project_name).replace(/[&<>"]/g, "")}<br>For: ${String(a.approver_name).replace(/[&<>"]/g, "")}</p></div>${canRespond ? '<label for="decisionNote">Optional note / changes requested</label><textarea id="decisionNote" maxlength="1500" placeholder="Tell the team what needs attention…"></textarea><div class="actions"><button class="approve" onclick="respond(\'approved\')">Approve this version</button><button class="changes" onclick="respond(\'changes_requested\')">Request changes</button></div>' : '<p>This request has already been answered or is no longer pending.</p>'}<div id="result" role="status"></div><p style="font-size:12px;margin-top:32px">This is an approval acknowledgement and audit record. It is not represented as a legally qualified electronic signature on a works contract.</p></main><script>async function respond(status){const buttons=[...document.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);const result=document.getElementById('result');try{const r=await fetch(location.pathname,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({status,note:document.getElementById('decisionNote')?.value||''})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Could not save your response.');result.textContent=d.message||'Your response has been recorded.';document.querySelector('.actions')?.remove();}catch(e){result.textContent=e.message||'Please contact RR to record your response.';buttons.forEach(b=>b.disabled=false);}}</script></body></html>`;
    return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'" } });
  } catch (error) { return new NextResponse(safeDatabaseError(error), { status: 503 }); }
}

export async function POST(request: Request, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  if (!validToken(token)) return NextResponse.json({ error: "This approval link is invalid or has expired." }, { status: 410 });
  let body: { status?: unknown; note?: unknown };
  try { body = await request.json() as { status?: unknown; note?: unknown }; }
  catch { return NextResponse.json({ error: "Choose approve or request changes." }, { status: 400 }); }
  const status = body.status === "approved" || body.status === "changes_requested" ? body.status : null;
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 1500) : "";
  if (!status) return NextResponse.json({ error: "That approval decision is not supported." }, { status: 400 });
  try {
    const sql = getSql();
    const matches = await sql`SELECT id, project_id, document_id, status FROM rr_approvals WHERE token_hash=${tokenHash(token)} LIMIT 1`;
    if (!matches.length) return NextResponse.json({ error: "This approval link is invalid or has expired." }, { status: 404 });
    const approval = matches[0];
    if (approval.status !== "pending") return NextResponse.json({ error: "This approval request has already been answered." }, { status: 409 });
    const eventId = randomUUID();
    const changed = await sql.transaction([
      sql`UPDATE rr_approvals SET status=${status}, decision=${note || (status === "approved" ? "Approved by link holder" : "Changes requested")}, decided_at=now(), token_hash=NULL, updated_at=now(), version=version+1 WHERE id=${approval.id}::uuid AND status='pending' RETURNING id, status, project_id, document_id`,
      sql`INSERT INTO rr_events (id, event_type, aggregate_type, aggregate_id, actor_id, idempotency_key, payload)
        VALUES (${eventId}::uuid, ${`approval.${status}`}, 'approval', ${approval.id}, 'approval_link', ${`approval.response:${approval.id}`}, ${JSON.stringify({ status, note })}::jsonb)`,
      sql`INSERT INTO rr_audit_log (actor_id, action, entity_type, entity_id, after_state, reason)
        VALUES ('approval_link', ${status}, 'approval', ${approval.id}, ${JSON.stringify({ status, note })}::jsonb, ${note || null})`
    ]);
    if (!changed[0].length) return NextResponse.json({ error: "This approval request has already been answered." }, { status: 409 });
    return NextResponse.json({ ok: true, message: status === "approved" ? "Thank you. Your approval has been recorded." : "Thank you. Your change request has been recorded and RR will follow up." });
  } catch (error) { return NextResponse.json({ error: safeDatabaseError(error) }, { status: 503 }); }
}
