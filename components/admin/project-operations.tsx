"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { AlertCircle, Archive, ArrowRight, BadgeCheck, Banknote, BellRing, BookOpenCheck, CalendarClock, Check, ChevronDown, ClipboardCheck, Download, FileCheck2, FileText, FolderKanban, HardHat, History, LoaderCircle, Mail, MessageCircle, Plus, Printer, RefreshCw, ShieldCheck, Upload, Wallet, X } from "lucide-react";
import {
  DOCUMENT_KINDS, OPERATIONS_PHASES, emptyOperationsData, normalizeOperationsData, projectGateBlockers, quotePreflight, quoteTotals,
  type ApprovalDecision, type BusinessPolicy, type ChecklistStatus, type CommunicationsItem, type DocumentStatus,
  type OperationsChecklist, type OperationsData, type OperationsPhase, type OperationsTask, type ProjectApproval,
  type ProjectDocument, type ProjectMilestone, type ProjectRecord, type ProjectDocumentKind, type QuoteLine, type QuoteVersion,
  type WarrantyClaim, type WarrantyRecord, type PaymentTransaction, type TaskStatus,
} from "@/lib/project-operations";

type ClientChoice = { id: string; name: string; email: string; phone: string };
type LeadChoice = { id: string; clientId?: string; name: string; email: string; phone: string; project: string; serviceType?: string; location?: string; budget?: string; status: string; date: string };
type InvoiceChoice = { id: string; clientId?: string; leadId?: string; client: string; project: string; date: string; total: number; paid: number; type: string; status: string };
type CrmChoice = { clients: ClientChoice[]; leads: LeadChoice[]; invoices: InvoiceChoice[] };
type OperationsEnvelope = { data: OperationsData; crm: CrmChoice };

const PHASE_LABEL: Record<OperationsPhase, string> = {
  initial_quote: "Initial quotation", booking: "Booking", design: "Design", final_approval: "Final sign-off",
  production: "Production", execution: "Project execution", handover: "Handover", warranty: "Warranty", closed: "Closed",
};
const DOC_LABEL: Record<ProjectDocumentKind, string> = {
  initial_quote: "Initial quotation", booking_form: "Booking form", booking_receipt: "Booking payment receipt",
  design_approval: "Design sign-off", final_quote: "Final quotation", works_contract: "Works contract",
  change_order: "Change order", payment_receipt: "Payment receipt", tax_invoice: "Tax invoice",
  handover_pack: "Handover pack", warranty_certificate: "Warranty certificate",
};
const PHASE_ORDER = [...OPERATIONS_PHASES];
const newId = () => window.crypto.randomUUID();
const isoNow = () => new Date().toISOString();
const today = () => new Date().toISOString().slice(0, 10);
const dateAfter = (days: number) => { const d = new Date(); d.setDate(d.getDate() + days); return d.toISOString().slice(0, 10); };
const money = (n: number | null | undefined) => typeof n === "number" && Number.isFinite(n) ? new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(n) : "Pending";
const textOf = (value: unknown) => typeof value === "string" ? value : "";
const esc = (value: unknown) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
const serviceOptions = ["Residential turnkey", "Commercial / corporate", "Renovation", "Design-only", "Modular", "Furniture"];
const taskSeeds: Array<{ phase: OperationsPhase; title: string; description: string; gateKey: string }> = [
  { phase: "initial_quote", title: "Validate requirements and prepare initial quotation", description: "Confirm project direction, measurements available, inclusions and assumptions.", gateKey: "quote-preflight" },
  { phase: "booking", title: "Complete booking form and verify booking payment", description: "Check exact quote version, signed form and independent payment evidence.", gateKey: "booking" },
  { phase: "design", title: "Collect site details and design brief", description: "Measurements, photos, room list, routines, references and dependencies.", gateKey: "design-brief" },
  { phase: "final_approval", title: "Prepare final design, quotation and works contract", description: "All three must describe the same approved scope and version.", gateKey: "commercial-signoff" },
  { phase: "production", title: "Confirm materials, drawings and production release", description: "No manufacture from an unapproved drawing or an unverified due payment.", gateKey: "production_release" },
  { phase: "execution", title: "Coordinate dispatch, site readiness and installation", description: "Track site prerequisites, QC evidence and installation milestones.", gateKey: "execution" },
  { phase: "handover", title: "Resolve snags and prepare customer handover pack", description: "Confirm completion, demonstrate operation and record acknowledgement.", gateKey: "handover" },
  { phase: "warranty", title: "Register warranty and explain aftercare", description: "Use the approved policy and the correct invoice/start date.", gateKey: "warranty" },
];
const checklistSeeds: Array<{ gate: OperationsChecklist["gate"]; title: string }> = [
  { gate: "booking", title: "Accepted quotation version and booking form match" },
  { gate: "booking", title: "Booking amount independently verified" },
  { gate: "design_signoff", title: "Site measurements, photos and room brief recorded" },
  { gate: "design_signoff", title: "Design version and finish/material selections reviewed" },
  { gate: "design_signoff", title: "Client's design decision recorded against exact version" },
  { gate: "production_release", title: "Final quotation and works contract reference the same scope" },
  { gate: "production_release", title: "Shop drawings, cut list and dimensions checked" },
  { gate: "production_release", title: "Material brands, finishes, hardware and substitutions approved" },
  { gate: "dispatch", title: "Manufacturing QC and finish inspection passed" },
  { gate: "dispatch", title: "Units/accessories counted, labelled and protected for transport" },
  { gate: "site_readiness", title: "Site access, lift/loading and working hours confirmed" },
  { gate: "site_readiness", title: "Electrical, plumbing, civil and wall readiness checked" },
  { gate: "installation", title: "Installed dimensions, alignment, finish and hardware checked" },
  { gate: "installation", title: "Functions demonstrated and snag list recorded" },
  { gate: "handover", title: "Snags closed or explicitly acknowledged with owner/date" },
  { gate: "handover", title: "Care instructions, invoice and warranty pack prepared" },
  { gate: "handover", title: "Client handover acknowledgement recorded" },
];

async function readApi(): Promise<OperationsEnvelope> {
  const response = await fetch("/api/admin/operations", { cache: "no-store" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || "Project Operations could not be loaded.");
  return { data: normalizeOperationsData(body.data), crm: body.crm || { clients: [], leads: [], invoices: [] } };
}

function buildDocHtml(doc: ProjectDocument, project?: ProjectRecord, client?: ClientChoice) {
  const snap = doc.snapshot as Record<string, unknown>;
  const quote = snap.quote && typeof snap.quote === "object" ? snap.quote as Record<string, unknown> : null;
  const lines = quote && Array.isArray(quote.lines) ? quote.lines as Array<Record<string, unknown>> : [];
  const amountRows = lines.map(line => "<tr><td>" + esc(line.description) + "</td><td>" + esc(line.qty) + " " + esc(line.unit || "unit") + "</td><td>" + esc(money(Number(line.unitPrice || 0))) + "</td><td>" + esc(money(Number(line.qty || 0) * Number(line.unitPrice || 0))) + "</td></tr>").join("");
  const p = project || (snap.project as ProjectRecord | undefined);
  const c = client || (snap.customer as ClientChoice | undefined);
  const disclaimer = textOf(snap.commercialDisclaimer) || "Prepared from the Project Passport. Review the approved policy, scope and terms before issue.";
  return "<!doctype html><html><head><meta charset='utf-8'><title>" + esc(doc.number || doc.title) + "</title><style>body{font:13px/1.6 Arial,sans-serif;color:#28221c;margin:30px auto;max-width:800px;padding:0 20px}header{display:flex;justify-content:space-between;border-bottom:2px solid #a13b2e;padding-bottom:18px;margin-bottom:24px}h1{font:28px Georgia,serif;margin:0 0 4px}h2{font:18px Georgia,serif;margin:26px 0 8px}small,.muted{color:#766657}.badge{font-size:10px;letter-spacing:1px;border:1px solid #b48749;padding:5px 8px;display:inline-block}table{width:100%;border-collapse:collapse;margin:16px 0}th,td{text-align:left;padding:8px;border-bottom:1px solid #e8e0d4}th{background:#f6f0e7} .total{background:#f4eadb;font-weight:bold;padding:14px;display:flex;justify-content:space-between}.warning{border:1px solid #d8b36f;background:#fcf7ed;padding:12px;margin:20px 0}footer{margin-top:40px;border-top:1px solid #ddd2c4;padding-top:12px;color:#766657;font-size:11px}@media print{body{margin:0 auto;padding:12mm}.no-print{display:none}}</style></head><body><header><div><div class='muted'>RR CREATIVE INTERIORS</div><h1>" + esc(DOC_LABEL[doc.kind]) + "</h1><small>" + esc(doc.number) + " · Version " + esc(doc.version) + "</small></div><span class='badge'>" + esc(doc.status.toUpperCase().replaceAll("_", " ")) + "</span></header><section><h2>Customer & property</h2><b>" + esc(c?.name) + "</b><br>" + esc(c?.email) + " · " + esc(c?.phone) + "<br><br><b>" + esc(p?.title) + "</b><br>" + esc(p?.propertyName) + " " + esc(p?.apartment) + " " + esc(p?.floor) + "<br>" + esc(p?.propertyAddress) + "<br>Project reference: " + esc(p?.code) + "</section><section><h2>Scope and commercial record</h2><p>" + esc(p?.scopeSummary || "See the approved scope attached to this project.") + "</p>" + (amountRows ? "<table><thead><tr><th>Description</th><th>Quantity</th><th>Unit price</th><th>Amount</th></tr></thead><tbody>" + amountRows + "</tbody></table>" : "") + (quote ? "<div class='total'><span>Subtotal</span><span>" + esc(money(Number(quote.subtotal || 0))) + "</span></div><p>Tax: " + esc(money(typeof quote.taxAmount === "number" ? quote.taxAmount : null)) + "<br>Total: " + esc(money(typeof quote.total === "number" ? quote.total : null)) + "</p><p>Valid until: " + esc(quote.validUntil) + "</p>" : "") + "</section><div class='warning'>" + esc(disclaimer) + "</div><section><h2>Notes / approvals</h2><p>" + esc(textOf(snap.notes) || "Refer to the signed scope, approvals and project record. No verbal variation changes an approved scope.") + "</p></section><footer>RR Creative Interiors · This print view is generated from a saved Project Passport snapshot. Keep signed/issued versions with the project reference. Verify GST, legal wording and all amounts before external issue.</footer><script>window.onload=()=>setTimeout(()=>window.print(),250)</script></body></html>";
}

export default function ProjectOperations() {
  const [data, setData] = useState<OperationsData | null>(null);
  const [crm, setCrm] = useState<CrmChoice>({ clients: [], leads: [], invoices: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [tab, setTab] = useState<"projects" | "documents" | "delivery" | "aftercare" | "rules">("projects");
  const [projectId, setProjectId] = useState("");
  const [leadId, setLeadId] = useState("");
  const [draftLineDescription, setDraftLineDescription] = useState("");
  const [draftLineQty, setDraftLineQty] = useState("1");
  const [draftLinePrice, setDraftLinePrice] = useState("");
  const [quoteKind, setQuoteKind] = useState<"initial" | "final" | "change">("initial");
  const [quoteValidUntil, setQuoteValidUntil] = useState(dateAfter(15));
  const [quoteExclusions, setQuoteExclusions] = useState("");
  const [quoteAssumptions, setQuoteAssumptions] = useState("");
  const [docKind, setDocKind] = useState<ProjectDocumentKind>("booking_form");
  const [docQuoteId, setDocQuoteId] = useState("");
  const [docNotes, setDocNotes] = useState("");
  const [signerName, setSignerName] = useState("Owner");
  const [transactionAmount, setTransactionAmount] = useState("");
  const [transactionMilestoneId, setTransactionMilestoneId] = useState("");
  const [transactionRef, setTransactionRef] = useState("");
  const [transactionMethod, setTransactionMethod] = useState<PaymentTransaction["method"]>("upi");
  const [transactionNote, setTransactionNote] = useState("");
  const [approvalKind, setApprovalKind] = useState<ProjectApproval["kind"]>("design");
  const [approvalTargetId, setApprovalTargetId] = useState("");
  const [approvalDecision, setApprovalDecision] = useState<ApprovalDecision>("approved");
  const [approvalComments, setApprovalComments] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState(dateAfter(2));
  const [taskOwner, setTaskOwner] = useState("Owner");
  const [taskPhase, setTaskPhase] = useState<OperationsPhase>("design");
  const [taskDescription, setTaskDescription] = useState("");
  const [messageTemplate, setMessageTemplate] = useState("booking_confirmation");
  const [warrantyInvoiceId, setWarrantyInvoiceId] = useState("");
  const [claimIssue, setClaimIssue] = useState("");
  const [claimArea, setClaimArea] = useState("");
  const [claimProjectId, setClaimProjectId] = useState("");
  const [restoreFile, setRestoreFile] = useState<File | null>(null);

  useEffect(() => {
    let active = true;
    readApi().then((loaded) => {
      if (!active) return;
      setData(loaded.data);
      setCrm(loaded.crm);
      setProjectId(loaded.data.projects[0]?.id || "");
      setLoading(false);
    }).catch((cause: unknown) => {
      if (active) setError(cause instanceof Error ? cause.message : "Project Operations could not be loaded.");
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const loaded = await readApi();
      setData(loaded.data); setCrm(loaded.crm);
      if (!loaded.data.projects.some((item) => item.id === projectId)) setProjectId(loaded.data.projects[0]?.id || "");
      setNotice("Project Passport refreshed from the saved operations record.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Refresh failed."); }
    finally { setLoading(false); }
  }

  async function commit(nextInput: OperationsData, summary: string): Promise<boolean> {
    if (!data || busy) return false;
    setBusy(true); setError(""); setNotice("");
    try {
      const next = { ...nextInput, revision: data.revision };
      const response = await fetch("/api/admin/operations", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expectedRevision: data.revision, data: next, actor: signerName || "Owner", summary }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || "The operation could not be saved.");
      setData(normalizeOperationsData(body.data));
      setNotice(summary);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The operation could not be saved.");
      return false;
    } finally { setBusy(false); }
  }

  const project = useMemo(() => data?.projects.find((item) => item.id === projectId), [data, projectId]);
  const customer = useMemo(() => crm.clients.find((item) => item.id === project?.clientId), [crm.clients, project?.clientId]);
  const projectQuotes = data?.quotes.filter((item) => item.projectId === projectId).sort((a,b) => b.revision-a.revision) || [];
  const projectDocs = data?.documents.filter((item) => item.projectId === projectId).sort((a,b) => b.createdAt.localeCompare(a.createdAt)) || [];
  const projectMilestones = data?.milestones.filter((item) => item.projectId === projectId) || [];
  const projectTransactions = data?.transactions.filter((item) => item.projectId === projectId).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)) || [];
  const projectTasks = data?.tasks.filter((item) => item.projectId === projectId).sort((a,b)=>a.dueDate.localeCompare(b.dueDate)) || [];
  const projectChecks = data?.checklists.filter((item) => item.projectId === projectId) || [];
  const projectApprovals = data?.approvals.filter((item) => item.projectId === projectId) || [];
  const projectComms = data?.communications.filter((item) => item.projectId === projectId).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)) || [];
  const projectWarranty = data?.warranties.filter((item) => item.projectId === projectId) || [];
  const projectClaims = data?.warrantyClaims.filter((item) => item.projectId === projectId) || [];
  const activeProjectQuotes = projectQuotes.filter((item) => item.status !== "superseded" && item.status !== "rejected");
  const selectedQuote = projectQuotes.find((item) => item.id === docQuoteId);
  const nextIndex = project ? PHASE_ORDER.indexOf(project.phase) + 1 : -1;
  const nextPhase = nextIndex >= 0 && nextIndex < PHASE_ORDER.length ? PHASE_ORDER[nextIndex] : null;
  const blockers = data && project && nextPhase ? projectGateBlockers(project, data, nextPhase) : [];
  const overdue = data?.tasks.filter((task) => !["done","cancelled"].includes(task.status) && task.dueDate && task.dueDate < today()).length || 0;
  const docsAwaiting = data?.documents.filter((doc) => ["ready_to_send","sent","awaiting_signature"].includes(doc.status)).length || 0;
  const activeWarrantyCount = data?.warranties.filter((item) => item.status === "active").length || 0;
  const openClaims = data?.warrantyClaims.filter((item) => !["resolved","rejected"].includes(item.status)).length || 0;

  function createProject(e: FormEvent) {
    e.preventDefault();
    if (!data) return;
    const lead = crm.leads.find((item) => item.id === leadId);
    if (!lead || !lead.clientId) { setError("Choose a CRM lead with a canonical customer record first."); return; }
    if (data.projects.some((item) => item.linkedLeadId === lead.id)) { setError("This CRM lead already has a Project Passport. Open the existing project instead of making a duplicate."); return; }
    const now = isoNow();
    const id = newId();
    const code = "RR-P-" + new Date().getFullYear() + "-" + String(data.projects.length + 1).padStart(4, "0");
    const newProject: ProjectRecord = {
      id, code, clientId: lead.clientId, linkedLeadId: lead.id, title: lead.project || lead.name + " project",
      serviceType: lead.serviceType || "Residential turnkey", propertyAddress: lead.location || "", propertyName: "", apartment: "", floor: "",
      areaSqFt: null, possessionDate: "", scopeSummary: lead.project || "", phase: "initial_quote", priority: "normal", owner: "Owner",
      targetStartDate: "", committedDeliveryDate: "", siteReady: false, createdAt: now, updatedAt: now, blockedReason: "", notes: "",
    };
    const tasks = taskSeeds.map((item) => ({
      id: newId(), projectId: id, phase: item.phase, title: item.title, description: item.description, owner: "Owner",
      dueDate: dateAfter(2), status: "open" as TaskStatus, blockedReason: "", gateKey: item.gateKey, sourceEventId: "", reminderCount: 0,
      lastReminderAt: "", completedAt: "", createdAt: now, updatedAt: now,
    }));
    const checklists = checklistSeeds.map((item) => ({
      id: newId(), projectId: id, gate: item.gate, title: item.title, required: true,
      status: "pending" as ChecklistStatus, resultNote: "", evidenceDocumentId: "", checkedBy: "", checkedAt: "", notApplicableReason: "",
    }));
    const event = { id: newId(), projectId: id, type: "project_created", title: "Project Passport created", detail: "Linked from CRM lead " + lead.id, actor: signerName || "Owner", occurredAt: now, idempotencyKey: "project-created:" + id };
    void commit({ ...data, projects: [newProject, ...data.projects], tasks: [...tasks, ...data.tasks], checklists: [...checklists, ...data.checklists], events: [...data.events, event] }, "Project Passport " + code + " created and linked to CRM.");
    setProjectId(id); setTab("projects");
  }

  function updateProjectField<K extends keyof ProjectRecord>(field: K, value: ProjectRecord[K]) {
    if (!data || !project) return;
    const updated = { ...project, [field]: value, updatedAt: isoNow() };
    setData({ ...data, projects: data.projects.map((item) => item.id === project.id ? updated : item) });
  }

  function saveProject(e: FormEvent) {
    e.preventDefault();
    if (!data || !project) return;
    void commit(data, "Project details saved for " + project.code + ".");
  }

  function advanceProject() {
    if (!data || !project || !nextPhase) return;
    if (blockers.length) { setError("Cannot advance yet. Complete these items:\n" + blockers.join("\n")); return; }
    const now = isoNow();
    const next = { ...data, projects: data.projects.map((item) => item.id === project.id ? { ...item, phase: nextPhase, updatedAt: now, blockedReason: "" } : item) };
    void commit(next, project.code + " advanced to " + PHASE_LABEL[nextPhase] + ".");
  }

  function addQuoteLine() {
    if (!data || !project || !draftLineDescription.trim() || Number(draftLineQty) <= 0 || Number(draftLinePrice) < 0 || draftLinePrice === "") {
      setError("Enter a line description, positive quantity and a non-negative unit price."); return;
    }
    const lines: QuoteLine[] = [{ id: newId(), description: draftLineDescription.trim(), qty: Number(draftLineQty), unit: "unit", unitPrice: Number(draftLinePrice), taxCode: data.policy.gst.defaultTaxCode }, ...(projectQuotes.find((item)=>item.kind===quoteKind&&item.status==="draft")?.lines || [])];
    const oldDraft = projectQuotes.find((item)=>item.kind===quoteKind&&item.status==="draft");
    const totals = quoteTotals(lines, data.policy.gst.approved ? data.policy.gst.rate : null);
    const preflight = quotePreflight({ kind: quoteKind, lines } as QuoteVersion, data.policy);
    let quotes: QuoteVersion[];
    if (oldDraft) {
      quotes = data.quotes.map((item)=>item.id===oldDraft.id?{...oldDraft,lines,...totals,taxRate:data.policy.gst.approved?data.policy.gst.rate:null,preflightPassed:preflight.passed,preflightErrors:preflight.errors}:item);
    } else {
      const revision = Math.max(0,...projectQuotes.filter((item)=>item.kind===quoteKind).map((item)=>item.revision))+1;
      const quote: QuoteVersion = { id:newId(),projectId:project.id,kind:quoteKind,revision,status:"draft",issueDate:today(),validUntil:quoteValidUntil,lines,
        exclusions:quoteExclusions,assumptions:quoteAssumptions,scopeVersion:"v1",...totals,taxRate:data.policy.gst.approved?data.policy.gst.rate:null,
        createdAt:isoNow(),createdBy:signerName||"Owner",supersedesId:"",acceptedAt:"",customerComments:"",preflightPassed:preflight.passed,preflightErrors:preflight.errors };
      quotes = [quote,...data.quotes];
    }
    setData({...data,quotes});
    setDraftLineDescription(""); setDraftLineQty("1"); setDraftLinePrice("");
  }

  function saveQuotes() {
    if (!data || !project) return;
    void commit(data, "Quote draft saved. The quote is not issued until its preflight has passed and you issue it.");
  }

  function createDocument(e: FormEvent) {
    e.preventDefault();
    if (!data || !project) return;
    const client = customer || crm.clients.find((item)=>item.id===project.clientId);
    const quote = docQuoteId ? data.quotes.find((item)=>item.id===docQuoteId) : undefined;
    if (["initial_quote","final_quote"].includes(docKind) && !quote) { setError("Select the exact quote version before creating the document."); return; }
    const numberPrefix = docKind.toUpperCase().replaceAll("_","-");
    const number = "RR-" + numberPrefix + "-" + new Date().getFullYear() + "-" + String(data.documents.filter((item)=>item.kind===docKind).length+1).padStart(4,"0");
    const version = Math.max(0,...projectDocs.filter((item)=>item.kind===docKind).map((item)=>item.version))+1;
    const now = isoNow();
    const snapshot = {
      project: { ...project }, customer: client ? { ...client } : null, quote: quote ? { ...quote } : null,
      policy: { ...data.policy }, documentKind: docKind, preparedAt: now, notes: docNotes,
      commercialDisclaimer: data.policy.approved ? "Prepared under RR's currently approved policy. The signed scope and attached specifications govern." : "DRAFT — NOT FOR SIGNING OR ISSUE. RR's Phase 0 payment, delivery, warranty, GST and contract policies are not yet approved.",
    };
    const document: ProjectDocument = { id:newId(),projectId:project.id,kind:docKind,title:DOC_LABEL[docKind],number,status:"draft",version,sourceQuoteId:quote?.id||"",
      sourceApprovalId:"",snapshot,privateFilePath:"",sha256:"",sentAt:"",signedAt:"",signedBy:"",externalEnvelopeId:"",
      supersedesId:"",issuedAt:"",createdAt:now,createdBy:signerName||"Owner" };
    void commit({...data,documents:[document,...data.documents]}, DOC_LABEL[docKind]+" draft generated from the Project Passport.");
    setDocNotes(""); setTab("documents");
  }

  function updateDocument(docId: string, patch: Partial<ProjectDocument>, summary: string) {
    if (!data) return;
    void commit({...data,documents:data.documents.map((doc)=>doc.id===docId?{...doc,...patch}:doc)},summary);
  }

  function printDocument(doc: ProjectDocument) {
    const client = crm.clients.find((item)=>item.id===project?.clientId);
    const popup = window.open("", "_blank");
    if (!popup) { setError("Your browser blocked the document window. Allow pop-ups for rrcreativeinteriors.in and try again."); return; }
    popup.document.open();
    popup.document.write(buildDocHtml(doc,project,client));
    popup.document.close();
  }

  async function uploadSignedPdf(doc: ProjectDocument, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !data) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const form = new FormData(); form.append("file",file);
      const response = await fetch("/api/admin/operations/files",{method:"POST",body:form});
      const body = await response.json().catch(()=>({}));
      if (!response.ok) throw new Error(body.error || "Private signed-document upload failed.");
      const next = {...data,documents:data.documents.map((item)=>item.id===doc.id?{...item,privateFilePath:body.path}:item)};
      const ok = await commit(next,"Signed PDF stored privately for "+doc.number+". The document remains in draft until you confirm signer details.");
      if (ok) setNotice("Signed PDF saved privately. Confirm signer details and mark it signed only after checking the exact document version.");
    } catch (cause) { setError(cause instanceof Error?cause.message:"Signed PDF upload failed."); }
    finally { setBusy(false); event.target.value = ""; }
  }

  function signDocument(doc: ProjectDocument) {
    if (!data) return;
    if (!doc.privateFilePath && !doc.externalEnvelopeId) { setError("Attach the signed PDF privately or enter a signature-provider envelope reference before marking a document signed."); return; }
    const now = isoNow();
    updateDocument(doc.id,{status:"signed",signedAt:now,signedBy:signerName||"Owner",issuedAt:doc.issuedAt||now},"Document "+doc.number+" marked signed with signature evidence.");
  }

  function initializeMilestones() {
    if (!data || !project) return;
    if (!data.policy.approved || !data.policy.paymentMilestones.length) { setError("Approve Phase 0 and configure payment milestones before calculating project payment obligations."); return; }
    if (projectMilestones.length) { setError("This project already has a milestone schedule. Use a change order and a documented schedule revision rather than duplicating it."); return; }
    const finalQuote = projectQuotes.find((item)=>item.kind==="final"&&item.status==="accepted") || projectQuotes.find((item)=>item.kind==="initial"&&item.status==="accepted");
    if (!finalQuote) { setError("Accept an initial/final quotation before creating payment milestones."); return; }
    const totals = quoteTotals(finalQuote.lines,data.policy.gst.rate);
    if (totals.total===null) { setError("The approved tax treatment is missing; no payable amount can be calculated."); return; }
    const now = isoNow();
    const milestones: ProjectMilestone[] = data.policy.paymentMilestones.map((m,index)=>({
      id:newId(),projectId:project.id,policyMilestoneId:m.id,name:m.name,percent:m.percent,amount:Math.round(totals.total!*m.percent)/100,
      trigger:m.trigger,dueDate:"",status:index===0?"due":"not_due",waiverReason:"",paidAmount:0,createdAt:now,
    }));
    void commit({...data,milestones:[...milestones,...data.milestones]},"Project payment milestones created from accepted quote "+finalQuote.id+".");
  }

  function addTransaction(e: FormEvent) {
    e.preventDefault();
    if (!data || !project || !transactionMilestoneId || !transactionRef.trim() || Number(transactionAmount)<=0 || !transactionNote.trim()) {
      setError("Choose a milestone, enter a positive amount, reference and note for independent payment verification."); return;
    }
    const milestone=projectMilestones.find((item)=>item.id===transactionMilestoneId);
    if (!milestone) { setError("Select a valid milestone."); return; }
    const tx:PaymentTransaction={id:newId(),projectId:project.id,milestoneId:milestone.id,kind:/booking|advance/i.test(milestone.name+" "+milestone.trigger)?"advance":"milestone",
      amount:Number(transactionAmount),currency:"INR",status:"pending_verification",method:transactionMethod,transactionReference:transactionRef.trim(),
      receivedAt:isoNow(),verifiedAt:"",verifiedBy:"",evidenceNote:transactionNote.trim(),reversalOfId:"",createdAt:isoNow()};
    void commit({...data,transactions:[tx,...data.transactions]},"Payment recorded as awaiting verification. Nothing has been marked paid yet.");
    setTransactionAmount("");setTransactionRef("");setTransactionNote("");
  }

  function setTransactionVerified(tx: PaymentTransaction) {
    if (!data) return;
    if (!tx.transactionReference.trim() || !tx.evidenceNote.trim()) {setError("Payment needs a transaction reference and an evidence note.");return;}
    const now=isoNow();
    const transactions=data.transactions.map((item)=>item.id===tx.id?{...item,status:"verified" as const,verifiedAt:now,verifiedBy:signerName||"Owner"}:item);
    const milestones=data.milestones.map((item)=>{
      const paid=transactions.filter((entry)=>entry.projectId===item.projectId&&entry.milestoneId===item.id&&entry.status==="verified"&&entry.kind!=="refund").reduce((sum,entry)=>sum+entry.amount,0)
        -transactions.filter((entry)=>entry.projectId===item.projectId&&entry.milestoneId===item.id&&entry.status==="verified"&&entry.kind==="refund").reduce((sum,entry)=>sum+entry.amount,0);
      const paidAmount=Math.max(0,Math.round(paid*100)/100);
      return {...item,paidAmount,status:paidAmount+0.009>=(item.amount||Infinity)?"paid":paidAmount>0?"partially_paid":item.status};
    });
    const autoDoc:ProjectDocument={id:newId(),projectId:tx.projectId,kind:/booking|advance/i.test(tx.kind)?"booking_receipt":"payment_receipt",
      title:"Payment receipt draft",number:"RR-REC-"+new Date().getFullYear()+"-"+String(data.documents.filter((doc)=>["booking_receipt","payment_receipt"].includes(doc.kind)).length+1).padStart(4,"0"),
      status:"draft",version:1,sourceQuoteId:"",sourceApprovalId:"",snapshot:{project,customer,transaction:{...tx,status:"verified",verifiedAt:now,verifiedBy:signerName||"Owner"},milestone:projectMilestones.find((item)=>item.id===tx.milestoneId),policy:data.policy,commercialDisclaimer:data.policy.approved?"Draft receipt; verify applicable GST receipt-voucher fields before issue.":"DRAFT — NOT FOR EXTERNAL ISSUE until CA policy is approved."},
      privateFilePath:"",sha256:"",sentAt:"",signedAt:"",signedBy:"",externalEnvelopeId:"",supersedesId:"",issuedAt:"",createdAt:now,createdBy:signerName||"Owner"};
    void commit({...data,transactions,milestones,documents:[autoDoc,...data.documents]},"Payment verified against evidence. A receipt draft was created; review the CA-approved format before issue.");
  }

  function saveApproval(e: FormEvent) {
    e.preventDefault();
    if (!data || !project || !approvalTargetId) { setError("Select the exact quote or document version."); return; }
    const doc=data.documents.find((item)=>item.id===approvalTargetId);
    const quote=data.quotes.find((item)=>item.id===approvalTargetId);
    const targetVersion=doc?.version||quote?.revision||0;
    if (approvalKind==="design" && (!doc || doc.kind!=="design_approval" || !["signed","accepted"].includes(doc.status))) {
      setError("Design approval must refer to a signed/accepted Design sign-off document version."); return;
    }
    if (approvalKind==="contract" && (!doc || doc.kind!=="works_contract" || doc.status!=="signed")) { setError("Contract approval must refer to a signed works contract."); return; }
    if (approvalKind==="quotation" && (!quote || quote.status!=="accepted")) { setError("Quotation approval must refer to an accepted quote version."); return; }
    const approval:ProjectApproval={id:newId(),projectId:project.id,kind:approvalKind,targetId:approvalTargetId,targetVersion,decision:approvalDecision,
      requestedAt:isoNow(),decidedAt:approvalDecision==="pending"?"":isoNow(),decidedBy:signerName||"Owner",comments:approvalComments,evidenceDocumentId:doc?.id||""};
    void commit({...data,approvals:[approval,...data.approvals]},approvalKind+" approval decision recorded against version "+targetVersion+".");
    setApprovalComments("");
  }

  function updateChecklist(check: OperationsChecklist, status: ChecklistStatus, note: string) {
    if (!data) return;
    const updated={...check,status,resultNote:note,checkedBy:signerName||"Owner",checkedAt:isoNow(),notApplicableReason:status==="not_applicable"?note:""};
    setData({...data,checklists:data.checklists.map((item)=>item.id===check.id?updated:item)});
  }
  function saveChecklist() {
    if (!data || !project) return;
    const missing=projectChecks.filter((item)=>item.required&&item.status==="not_applicable"&&!item.notApplicableReason.trim());
    if (missing.length) {setError("Every not-applicable checklist item needs a reason.");return;}
    void commit(data,"Delivery checklist updates saved. Each decision retains who checked it and when.");
  }

  function addTask(e: FormEvent) {
    e.preventDefault();
    if(!data||!project||!taskTitle.trim()){setError("Task title is required.");return;}
    const task:OperationsTask={id:newId(),projectId:project.id,phase:taskPhase,title:taskTitle.trim(),description:taskDescription.trim(),owner:taskOwner||"Owner",
      dueDate:taskDue,status:"open",blockedReason:"",gateKey:"",sourceEventId:"",reminderCount:0,lastReminderAt:"",completedAt:"",createdAt:isoNow(),updatedAt:isoNow()};
    void commit({...data,tasks:[task,...data.tasks]},"Task added to the Project Passport.");
    setTaskTitle("");setTaskDescription("");
  }
  function updateTask(task: OperationsTask, status: TaskStatus) {
    if(!data)return;
    const now=isoNow();
    void commit({...data,tasks:data.tasks.map((item)=>item.id===task.id?{...item,status,completedAt:status==="done"?now:"",updatedAt:now}:item)},
      "Task ""+task.title+"" changed to "+status+".");
  }

  function createMessage() {
    if(!data||!project||!customer)return;
    const templates: Record<string,{title:string;body:(c:ClientChoice,p:ProjectRecord)=>string;kind:"whatsapp"|"email"}>={
      booking_confirmation:{title:"Booking confirmation",kind:"whatsapp",body:(c,p)=>"Hello "+c.name+", thank you for choosing RR Creative Interiors. Your project "+p.code+" is now in the booking stage. We will keep the next action and required approvals in your Project Passport. Please use the project link shared by RR for documents and approvals."},
      design_review:{title:"Design review ready",kind:"whatsapp",body:(c,p)=>"Hello "+c.name+", the next design review for "+p.title+" is ready. Please review the exact version linked in your RR Project Passport and either approve that version or request changes. We will not release production based on an unapproved revision."},
      payment_due:{title:"Payment milestone reminder",kind:"whatsapp",body:(c,p)=>"Hello "+c.name+", a payment milestone is coming up for "+p.code+". Please refer to the invoice/document in your RR Project Passport. If you have already paid, please share the reference so we can reconcile it against the bank credit."},
      site_readiness:{title:"Site readiness checklist",kind:"whatsapp",body:(c,p)=>"Hello "+c.name+", before installation at "+p.title+", please confirm access/loading arrangements, working hours and readiness of the relevant civil, electrical and plumbing work. We will confirm the installation schedule once the site-readiness check is complete."},
      handover:{title:"Handover coordination",kind:"whatsapp",body:(c,p)=>"Hello "+c.name+", RR is preparing the handover review for "+p.title+". We will walk through the installed work, record any snags, and share the final documents and applicable warranty details."},
      email_project_update:{title:"Project status update",kind:"email",body:(c,p)=>"Hello "+c.name+",\n\nHere is the current update for "+p.title+" ("+p.code+").\n\nCurrent phase: "+PHASE_LABEL[p.phase]+".\nNext action: "+(p.blockedReason||"Please check the Project Passport for the latest approved documents and actions.")+"\n\nRegards,\nRR Creative Interiors"}
    };
    const selected=templates[messageTemplate]||templates.booking_confirmation;
    const key=project.id+":"+messageTemplate+":"+today();
    const existing=data.communications.find((item)=>item.idempotencyKey===key && !["failed","cancelled"].includes(item.status));
    if(existing){setError("This message template already has an entry for today. Open the existing message instead of creating a duplicate.");return;}
    const recipient=selected.kind==="email"?customer.email:customer.phone;
    if(!recipient){setError("The customer has no "+selected.kind+" contact recorded.");return;}
    const body=selected.body(customer,project);
    const msg:CommunicationsItem={id:newId(),projectId:project.id,kind:selected.kind,trigger:"manual",templateKey:messageTemplate,recipient,
      subject:selected.title+" · "+project.code,body,status:"draft",idempotencyKey:key,createdAt:isoNow(),sentAt:"",failureReason:"",attemptCount:0};
    void commit({...data,communications:[msg,...data.communications]},"A "+selected.kind+" draft was created for "+customer.name+". No message has been sent automatically.");
  }

  async function openMessage(msg: CommunicationsItem) {
    if(!data)return;
    const url=msg.kind==="whatsapp"?"https://wa.me/"+(msg.recipient||"").replace(/\D/g,"")+"?text="+encodeURIComponent(msg.body):
      "mailto:"+encodeURIComponent(msg.recipient)+"?subject="+encodeURIComponent(msg.subject)+"&body="+encodeURIComponent(msg.body);
    window.open(url,"_blank","noopener,noreferrer");
    void commit({...data,communications:data.communications.map((item)=>item.id===msg.id?{...item,status:"opened" as const,attemptCount:item.attemptCount+1}:item)},
      "Message draft opened. Confirm it was actually sent before marking it sent.");
  }
  function markMessageSent(msg: CommunicationsItem) {
    if(!data)return;
    void commit({...data,communications:data.communications.map((item)=>item.id===msg.id?{...item,status:"sent" as const,sentAt:isoNow(),failureReason:""}:item)},
      "Message marked sent by the owner. Delivery is not independently verified by the app.");
  }

  function addWarranty() {
    if(!data||!project){return;}
    const invoice=data.documents.find((doc)=>doc.id===warrantyInvoiceId&&doc.kind==="tax_invoice"&&doc.status==="issued");
    if(!invoice){setError("Select an issued project tax invoice; warranty start date must follow the approved policy.");return;}
    if(!data.policy.warranty.approved||data.policy.warranty.joineryMonths===null){setError("The warranty policy is not approved in Phase 0. Do not issue a certificate yet.");return;}
    const invoiceDate=textOf((invoice.snapshot as Record<string,unknown>).invoiceDate)||today();
    const startDate=data.policy.warranty.startRule==="invoice_date"?invoiceDate:today();
    const start=new Date(startDate+"T12:00:00Z"); start.setUTCMonth(start.getUTCMonth()+data.policy.warranty.joineryMonths);
    const warranty:WarrantyRecord={id:newId(),projectId:project.id,documentId:"",invoiceDocumentId:invoice.id,joineryMonths:data.policy.warranty.joineryMonths,startDate,endDate:start.toISOString().slice(0,10),status:"active",thirdPartyNotes:data.policy.warranty.thirdPartyRule,createdAt:isoNow()};
    const now=isoNow();
    const doc:ProjectDocument={id:newId(),projectId:project.id,kind:"warranty_certificate",title:"Warranty certificate",number:"RR-WAR-"+new Date().getFullYear()+"-"+String(data.warranties.length+1).padStart(4,"0"),status:"draft",version:1,sourceQuoteId:"",sourceApprovalId:"",
      snapshot:{project,customer,invoiceDate,startDate,endDate:warranty.endDate,joineryMonths:warranty.joineryMonths,policy:data.policy.warranty,commercialDisclaimer:"DRAFT — verify the project scope, invoice date and approved exclusions before issue."},
      privateFilePath:"",sha256:"",sentAt:"",signedAt:"",signedBy:"",externalEnvelopeId:"",supersedesId:"",issuedAt:"",createdAt:now,createdBy:signerName||"Owner"};
    warranty.documentId=doc.id;
    void commit({...data,warranties:[warranty,...data.warranties],documents:[doc,...data.documents]},"Warranty record created from the issued invoice and approved warranty policy. The certificate remains a draft until checked and issued.");
  }

  function addWarrantyClaim(e: FormEvent) {
    e.preventDefault();
    if(!data||!project||!claimIssue.trim()){setError("Describe the reported issue.");return;}
    const warranty=projectWarranty.find((item)=>item.status==="active");
    const claim:WarrantyClaim={id:newId(),projectId:project.id,warrantyId:warranty?.id||"",claimNumber:"RR-CLM-"+new Date().getFullYear()+"-"+String(data.warrantyClaims.length+1).padStart(4,"0"),
      receivedAt:isoNow(),customerName:customer?.name||"",issue:claimIssue.trim(),productArea:claimArea.trim(),status:"new",priority:"normal",eligibilityNotes:warranty?"Check the approved warranty scope and exclusions before confirming coverage.":"No active warranty record linked. Manual triage is required.",
      nextAction:"Review claim and request photos/evidence",nextActionDate:dateAfter(1),resolution:"",closedAt:"",createdAt:isoNow(),updatedAt:isoNow()};
    void commit({...data,warrantyClaims:[claim,...data.warrantyClaims]},"Warranty claim logged as "+claim.claimNumber+". Eligibility remains to be reviewed.");
    setClaimIssue("");setClaimArea("");
  }

  function changeClaim(claim: WarrantyClaim,status: WarrantyClaim["status"]) {
    if(!data)return;
    void commit({...data,warrantyClaims:data.warrantyClaims.map((item)=>item.id===claim.id?{...item,status,updatedAt:isoNow(),closedAt:["resolved","rejected"].includes(status)?isoNow():item.closedAt}:item)},
      "Warranty claim "+claim.claimNumber+" updated to "+status+".");
  }

  async function downloadBackup() {
    const response=await fetch("/api/admin/operations/backup",{cache:"no-store"});
    if(!response.ok){const body=await response.json().catch(()=>({}));setError(body.error||"Backup download failed.");return;}
    const blob=await response.blob();
    const url=URL.createObjectURL(blob);
    const link=document.createElement("a");link.href=url;link.download="rr-operations-backup-"+today()+".json";link.click();URL.revokeObjectURL(url);
    setNotice("Backup downloaded. Store this confidential file somewhere separate from the RR website.");
  }
  async function restoreBackup() {
    if(!restoreFile)return;
    if(!window.confirm("Restore will replace the current CRM leads, customers, invoices and Project Passport records with the selected backup. Export the current state first. Continue?"))return;
    setBusy(true);setError("");setNotice("");
    try {
      const raw=await restoreFile.text();
      const response=await fetch("/api/admin/operations/backup",{method:"POST",headers:{"Content-Type":"application/json"},body:raw});
      const body=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(body.error||"Restore failed.");
      const loaded=await readApi();
      setData(loaded.data);setCrm(loaded.crm);setNotice(body.message||"Restore complete.");
    } catch(cause){setError(cause instanceof Error?cause.message:"Restore failed.");}
    finally{setBusy(false);setRestoreFile(null);}
  }

  if (loading) return <div className="rr-operations-loading"><LoaderCircle className="rr-ops-spin" size={24}/> Opening Project Operations…</div>;
  if (!data) return <div className="rr-panel"><h2>Project Operations unavailable</h2><p>{error || "The operations record could not be loaded."}</p><button className="rr-secondary" onClick={()=>void refresh()}><RefreshCw size={14}/> Try again</button></div>;

  const tabs=[{id:"projects",label:"Projects",icon:FolderKanban},{id:"documents",label:"Documents & approvals",icon:FileCheck2},{id:"delivery",label:"Production & handover",icon:HardHat},{id:"aftercare",label:"Warranty & recovery",icon:ShieldCheck},{id:"rules",label:"Phase 0 rules",icon:BookOpenCheck}] as const;

  return <div className="rr-project-operations">
    <div className="rr-page-heading rr-ops-heading">
      <div><span className="rr-eyebrow">ONE PROJECT · ONE RECORD · EVERY GATE</span><h1>Project Operations</h1><p>Project Passport, verified money, versioned documents, delivery checklists and aftercare—all linked to the CRM customer.</p></div>
      <div className="rr-page-actions"><button className="rr-secondary" type="button" onClick={()=>void refresh()} disabled={busy}><RefreshCw size={15}/> Refresh</button><button className="rr-primary" type="button" onClick={()=>void downloadBackup()}><Download size={15}/> Backup</button></div>
    </div>
    <div className="rr-ops-stats">
      <article><span>Project Passports</span><b>{data.projects.length}</b><small>Unique linked projects</small></article>
      <article><span>Awaiting client / sign-off</span><b>{docsAwaiting}</b><small>Documents needing attention</small></article>
      <article><span>Overdue tasks</span><b>{overdue}</b><small>Across active projects</small></article>
      <article><span>Open aftercare claims</span><b>{openClaims}</b><small>{activeWarrantyCount} active warranty records</small></article>
    </div>
    <div className="rr-ops-tabs">{tabs.map((item)=>{const Icon=item.icon;return <button key={item.id} type="button" className={tab===item.id?"is-active":""} onClick={()=>setTab(item.id)}><Icon size={16}/>{item.label}</button>;})}</div>
    {error&&<div className="rr-ops-alert is-error" role="alert"><AlertCircle size={17}/><pre>{error}</pre><button type="button" onClick={()=>setError("")} aria-label="Dismiss"><X size={14}/></button></div>}
    {notice&&<div className="rr-ops-alert is-success" role="status"><Check size={17}/><span>{notice}</span><button type="button" onClick={()=>setNotice("")} aria-label="Dismiss"><X size={14}/></button></div>}

    {tab==="projects"&&<div className="rr-ops-project-layout">
      <section className="rr-panel rr-ops-project-list">
        <div className="rr-panel-heading"><div><h2>Project Passports</h2><p>A lead can have one passport. A customer can have multiple projects.</p></div><span className="rr-ops-count">{data.projects.length}</span></div>
        <form className="rr-ops-create" onSubmit={createProject}>
          <label>Convert a CRM lead into a Project Passport<select value={leadId} onChange={event=>setLeadId(event.target.value)}><option value="">Select a lead…</option>{crm.leads.filter((lead)=>lead.clientId&&!data.projects.some((item)=>item.linkedLeadId===lead.id)).map((lead)=><option key={lead.id} value={lead.id}>{lead.name} · {lead.project} · {lead.status}</option>)}</select></label>
          <button className="rr-primary" type="submit" disabled={busy||!leadId}><Plus size={15}/> Create project</button>
        </form>
        {data.projects.length===0?<div className="rr-ops-empty"><FolderKanban size={26}/><b>No Project Passports yet</b><p>Choose a qualified CRM lead above. RR will create one linked project record, seed the tasks/checklists and keep the enquiry record intact.</p></div>:<div className="rr-ops-project-list-inner">{data.projects.map((item)=><button type="button" key={item.id} className={projectId===item.id?"rr-ops-project-row is-active":"rr-ops-project-row"} onClick={()=>setProjectId(item.id)}><span className="rr-ops-project-code">{item.code}</span><b>{item.title}</b><small>{crm.clients.find((c)=>c.id===item.clientId)?.name||"Customer"} · {PHASE_LABEL[item.phase]}</small><span className="rr-ops-progress"><i style={{width:((PHASE_ORDER.indexOf(item.phase)+1)/PHASE_ORDER.length*100)+"%"}}/></span></button>)}</div>}
      </section>
      <div className="rr-ops-project-detail">
        {!project?<section className="rr-panel rr-ops-empty"><FolderKanban size={30}/><h2>Choose a project</h2><p>Create a passport from a CRM lead to begin the project workflow.</p></section>:<>
          <section className="rr-panel rr-ops-project-summary">
            <div className="rr-ops-project-summary-top"><div><span className="rr-eyebrow">{project.code} · PROJECT PASSPORT</span><h2>{project.title}</h2><p>{customer?.name||"Customer"} · {project.serviceType}</p></div><span className="rr-ops-phase-badge">{PHASE_LABEL[project.phase]}</span></div>
            <div className="rr-ops-phase-track">{PHASE_ORDER.map((phase,i)=><span key={phase} className={i<=PHASE_ORDER.indexOf(project.phase)?"is-done":""} title={PHASE_LABEL[phase]}/>)}</div>
            <div className="rr-ops-gate"><div className="rr-ops-gate-head"><b>{nextPhase?"Next gate · "+PHASE_LABEL[nextPhase]:"Project lifecycle complete"}</b>{nextPhase&&<span>{blockers.length===0?"Ready to advance":blockers.length+" blockers"}</span>}</div>
              {nextPhase&&blockers.length? <ul>{blockers.slice(0,5).map((item)=><li key={item}>{item}</li>)}</ul>:<p>{nextPhase?"Required evidence is present. You can move this project to the next phase.":"Warranty claims can continue in aftercare even after project closure, subject to policy."}</p>}
              {nextPhase&&<button className="rr-primary" type="button" disabled={busy||blockers.length>0} onClick={advanceProject}><ArrowRight size={15}/> Advance to {PHASE_LABEL[nextPhase]}</button>}
            </div>
          </section>
          <section className="rr-panel">
            <div className="rr-panel-heading"><div><h2>Project details</h2><p>Shared details used to populate every generated document.</p></div><span className="rr-ops-id-tag">{project.linkedLeadId}</span></div>
            <form className="rr-ops-form-grid" onSubmit={saveProject}>
              <label>Project / property title<input value={project.title} onChange={e=>updateProjectField("title",e.target.value)} required/></label>
              <label>Service type<select value={project.serviceType} onChange={e=>updateProjectField("serviceType",e.target.value)}>{serviceOptions.map(item=><option key={item}>{item}</option>)}</select></label>
              <label>Property / apartment name<input value={project.propertyName} onChange={e=>updateProjectField("propertyName",e.target.value)}/></label>
              <label>Apartment / unit<input value={project.apartment} onChange={e=>updateProjectField("apartment",e.target.value)}/></label>
              <label>Floor<input value={project.floor} onChange={e=>updateProjectField("floor",e.target.value)}/></label>
              <label>Area (sq ft)<input type="number" min="0" value={project.areaSqFt??""} onChange={e=>updateProjectField("areaSqFt",e.target.value===""?null:Number(e.target.value))}/></label>
              <label className="rr-ops-wide">Full project address<textarea rows={2} value={project.propertyAddress} onChange={e=>updateProjectField("propertyAddress",e.target.value)}/></label>
              <label>Possession date<input type="date" value={project.possessionDate} onChange={e=>updateProjectField("possessionDate",e.target.value)}/></label>
              <label>Target start date<input type="date" value={project.targetStartDate} onChange={e=>updateProjectField("targetStartDate",e.target.value)}/></label>
              <label>Committed delivery date<input type="date" value={project.committedDeliveryDate} onChange={e=>updateProjectField("committedDeliveryDate",e.target.value)}/></label>
              <label>Priority<select value={project.priority} onChange={e=>updateProjectField("priority",e.target.value as ProjectRecord["priority"])}><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label>
              <label className="rr-ops-wide">Agreed scope summary<textarea rows={3} value={project.scopeSummary} onChange={e=>updateProjectField("scopeSummary",e.target.value)} placeholder="Rooms, products, inclusions and exclusions."/></label>
              <label className="rr-ops-wide">Internal project notes<textarea rows={2} value={project.notes} onChange={e=>updateProjectField("notes",e.target.value)}/></label>
              <div className="rr-ops-form-footer"><span>Edits are local until saved. Signed document snapshots remain unchanged.</span><button className="rr-primary" type="submit" disabled={busy}><Check size={15}/> Save project details</button></div>
            </form>
          </section>
          <section className="rr-panel">
            <div className="rr-panel-heading"><div><h2>Quotation versions</h2><p>Draft an initial estimate first; final/change quotes need approved Phase 0 rules.</p></div><span>{projectQuotes.length} versions</span></div>
            <div className="rr-ops-inline-form">
              <label>Quote type<select value={quoteKind} onChange={e=>setQuoteKind(e.target.value as typeof quoteKind)}><option value="initial">Initial quotation</option><option value="final">Final quotation</option><option value="change">Change order quote</option></select></label>
              <label>Valid until<input type="date" value={quoteValidUntil} onChange={e=>setQuoteValidUntil(e.target.value)}/></label>
            </div>
            <div className="rr-ops-quote-add">
              <label>Line item<input value={draftLineDescription} onChange={e=>setDraftLineDescription(e.target.value)} placeholder="e.g. Kitchen base cabinets"/></label>
              <label>Qty<input type="number" min="0.01" step="0.01" value={draftLineQty} onChange={e=>setDraftLineQty(e.target.value)}/></label>
              <label>Unit price (₹)<input type="number" min="0" step="0.01" value={draftLinePrice} onChange={e=>setDraftLinePrice(e.target.value)}/></label>
              <button className="rr-secondary" type="button" disabled={busy} onClick={addQuoteLine}><Plus size={14}/> Add to draft</button>
            </div>
            <div className="rr-ops-two-field"><label>Exclusions<textarea rows={2} value={quoteExclusions} onChange={e=>setQuoteExclusions(e.target.value)}/></label><label>Assumptions<textarea rows={2} value={quoteAssumptions} onChange={e=>setQuoteAssumptions(e.target.value)}/></label></div>
            <button className="rr-primary" type="button" disabled={busy} onClick={saveQuotes}><Check size={15}/> Save quote draft</button>
            {projectQuotes.length===0?<p className="rr-ops-muted">No quote versions created.</p>:<div className="rr-ops-quote-list">{projectQuotes.map((quote)=><article key={quote.id}><div><b>{quote.kind==="initial"?"Initial quotation":quote.kind==="final"?"Final quotation":"Change quotation"} · v{quote.revision}</b><small>{quote.id} · {quote.status} · Valid until {quote.validUntil||"not set"}</small><small>{quote.preflightErrors.length?quote.preflightErrors.join(" "):"Preflight passed."}</small></div><div className="rr-ops-quote-amount"><b>{money(quote.total??quote.subtotal)}</b><small>{quote.total===null?"Indicative subtotal; tax/total not confirmed": "Including configured tax"}</small>{quote.status==="draft"&&<div className="rr-ops-button-row"><button type="button" disabled={busy||!quote.preflightPassed} onClick={()=>void commit({...data,quotes:data.quotes.map((item)=>item.id===quote.id?{...item,status:"issued" as const,issueDate:today()}:item)},"Quote v"+quote.revision+" issued. Send/record the customer communication separately.")}>Issue</button></div>}{quote.status==="issued"&&<button type="button" disabled={busy||!quote.preflightPassed} onClick={()=>void commit({...data,quotes:data.quotes.map((item)=>item.id===quote.id?{...item,status:"accepted" as const,acceptedAt:isoNow()}:item)},"Quote v"+quote.revision+" recorded as accepted. Record the customer acceptance evidence in notes/documents.")}>Mark accepted</button>}</div></article>)}</div>}
          </section>
          <section className="rr-panel">
            <div className="rr-panel-heading"><div><h2>Payment plan & transaction ledger</h2><p>Payments are not counted as received until independently verified.</p></div><button type="button" className="rr-secondary" onClick={initializeMilestones} disabled={busy||Boolean(projectMilestones.length)}><Plus size={14}/> Build milestones</button></div>
            {projectMilestones.length===0?<div className="rr-ops-muted">Approve payment rules, accept a quote and create the milestone schedule. No default payment percentages have been assumed.</div>:<div className="rr-ops-table-wrap"><table className="rr-ops-table"><thead><tr><th>Milestone</th><th>Trigger</th><th>Due</th><th>Expected</th><th>Verified</th><th>Balance</th><th>Status</th></tr></thead><tbody>{projectMilestones.map((m)=><tr key={m.id}><td>{m.name}<small>{m.percent}%</small></td><td>{m.trigger}</td><td>{m.dueDate||"When trigger occurs"}</td><td>{money(m.amount)}</td><td>{money(m.paidAmount)}</td><td>{money(Math.max(0,(m.amount||0)-m.paidAmount))}</td><td><span className={"rr-ops-status "+m.status}>{m.status.replaceAll("_"," ")}</span></td></tr>)}</tbody></table></div>}
            {projectMilestones.length>0&&<form className="rr-ops-payment-form" onSubmit={addTransaction}><h3>Record a payment</h3><div className="rr-ops-form-grid"><label>Milestone<select required value={transactionMilestoneId} onChange={e=>setTransactionMilestoneId(e.target.value)}><option value="">Choose milestone</option>{projectMilestones.filter((m)=>m.status!=="paid"&&m.status!=="waived").map((m)=><option key={m.id} value={m.id}>{m.name} · balance {money(Math.max(0,(m.amount||0)-m.paidAmount))}</option>)}</select></label><label>Amount received (₹)<input required type="number" min="0.01" step="0.01" value={transactionAmount} onChange={e=>setTransactionAmount(e.target.value)}/></label><label>Method<select value={transactionMethod} onChange={e=>setTransactionMethod(e.target.value as PaymentTransaction["method"])}><option value="upi">UPI</option><option value="bank_transfer">Bank transfer</option><option value="cheque">Cheque</option><option value="cash">Cash</option><option value="gateway">Payment gateway</option><option value="other">Other</option></select></label><label>Transaction/reference number<input required value={transactionRef} onChange={e=>setTransactionRef(e.target.value)}/></label><label className="rr-ops-wide">Where/how was the credit checked?<textarea required rows={2} value={transactionNote} onChange={e=>setTransactionNote(e.target.value)} placeholder="Bank statement date, UTR, verified UPI credit, or other evidence note."/></label><div className="rr-ops-form-footer"><span>New entries remain pending. Verify below after checking the actual bank/UPI credit.</span><button className="rr-primary" disabled={busy}><Wallet size={15}/> Record pending payment</button></div></div></form>}
            {projectTransactions.length>0&&<div className="rr-ops-table-wrap"><table className="rr-ops-table"><thead><tr><th>Transaction</th><th>Amount</th><th>Reference</th><th>Recorded</th><th>Status</th><th>Action</th></tr></thead><tbody>{projectTransactions.map((tx)=><tr key={tx.id}><td>{tx.method.replaceAll("_"," ")}<small>{tx.kind}</small></td><td>{money(tx.amount)}</td><td>{tx.transactionReference}<small>{tx.evidenceNote}</small></td><td>{tx.receivedAt.slice(0,10)}</td><td><span className={"rr-ops-status "+tx.status}>{tx.status.replaceAll("_"," ")}</span></td><td>{tx.status==="pending_verification"?<button className="rr-ops-text-button" type="button" disabled={busy} onClick={()=>setTransactionVerified(tx)}>Verify credit</button>:tx.status==="verified"?<span>Verified by {tx.verifiedBy}</span>:null}</td></tr>)}</tbody></table></div>}
          </section>
          <section className="rr-panel">
            <div className="rr-panel-heading"><div><h2>Project tasks</h2><p>One next action for each active workstream.</p></div><span>{projectTasks.filter((item)=>item.status!=="done").length} open</span></div>
            <form className="rr-ops-task-form" onSubmit={addTask}><label>Task<input required value={taskTitle} onChange={e=>setTaskTitle(e.target.value)} placeholder="What needs to happen?"/></label><label>Phase<select value={taskPhase} onChange={e=>setTaskPhase(e.target.value as OperationsPhase)}>{PHASE_ORDER.map((phase)=><option value={phase} key={phase}>{PHASE_LABEL[phase]}</option>)}</select></label><label>Owner<input value={taskOwner} onChange={e=>setTaskOwner(e.target.value)}/></label><label>Due<input type="date" value={taskDue} onChange={e=>setTaskDue(e.target.value)}/></label><button className="rr-secondary" disabled={busy}><Plus size={14}/> Add task</button></form>
            {projectTasks.map((task)=><div className="rr-ops-task-row" key={task.id}><div><b>{task.title}</b><small>{PHASE_LABEL[task.phase]} · {task.owner} · due {task.dueDate||"not set"}</small>{task.description&&<p>{task.description}</p>}</div><select value={task.status} onChange={e=>updateTask(task,e.target.value as TaskStatus)} disabled={busy}><option value="open">Open</option><option value="in_progress">In progress</option><option value="waiting_client">Waiting on client</option><option value="blocked">Blocked</option><option value="done">Done</option><option value="cancelled">Cancelled</option></select></div>)}
          </section>
        </>}
      </div>
    </div>}

    {tab==="documents"&&<div className="rr-ops-stack">
      {!project?<section className="rr-panel"><h2>Select a project first</h2><p>Create a Project Passport in the Projects tab.</p></section>:<>
        <section className="rr-panel"><div className="rr-panel-heading"><div><h2>Generate a project document</h2><p>Creates a versioned snapshot. Print to save a PDF; upload the signed PDF to the private archive.</p></div><FileText size={21}/></div>
          <form className="rr-ops-form-grid" onSubmit={createDocument}>
            <label>Document type<select value={docKind} onChange={e=>setDocKind(e.target.value as ProjectDocumentKind)}>{DOCUMENT_KINDS.map((kind)=><option key={kind} value={kind}>{DOC_LABEL[kind]}</option>)}</select></label>
            <label>Source quotation version<select value={docQuoteId} onChange={e=>setDocQuoteId(e.target.value)}><option value="">No quotation selected</option>{projectQuotes.map((q)=><option key={q.id} value={q.id}>{q.kind} v{q.revision} · {q.status} · {money(q.total??q.subtotal)}</option>)}</select></label>
            <label className="rr-ops-wide">Document-specific notes / scope version<textarea rows={3} value={docNotes} onChange={e=>setDocNotes(e.target.value)} placeholder="Specific scope details, design version, exclusions or acceptance notes."/></label>
            <div className="rr-ops-form-footer"><span>{data.policy.approved?"Commercial policy approved. Still review each draft before issue.":"Phase 0 is unapproved; generated documents carry a NOT FOR SIGNING disclaimer."}</span><button className="rr-primary" disabled={busy}><FileText size={15}/> Generate draft</button></div>
          </form>
        </section>
        <section className="rr-panel"><div className="rr-panel-heading"><div><h2>Document register</h2><p>Every version remains attached to this Project Passport.</p></div><span>{projectDocs.length}</span></div>
          {projectDocs.length===0?<div className="rr-ops-empty"><FileText size={24}/><p>No documents have been generated.</p></div>:projectDocs.map((doc)=><article className="rr-ops-document-row" key={doc.id}><div className="rr-ops-document-icon"><FileText size={19}/></div><div className="rr-ops-document-main"><b>{doc.title}</b><small>{doc.number} · v{doc.version} · {doc.createdAt.slice(0,10)}</small><span className={"rr-ops-status "+doc.status}>{doc.status.replaceAll("_"," ")}</span>{doc.privateFilePath&&<a target="_blank" rel="noopener noreferrer" href={"/api/admin/operations/files/content?path="+encodeURIComponent(doc.privateFilePath)}>Open private signed PDF</a>}</div><div className="rr-ops-document-actions"><button className="rr-secondary" type="button" onClick={()=>printDocument(doc)}><Printer size={14}/> Print / PDF</button>{doc.status==="draft"&&<button className="rr-secondary" type="button" disabled={busy||!data.policy.approved&&["final_quote","works_contract","tax_invoice","payment_receipt","booking_receipt","warranty_certificate"].includes(doc.kind)} onClick={()=>updateDocument(doc.id,{status:"ready_to_send"},"Document "+doc.number+" marked ready to send.")}>Ready to send</button>}{["ready_to_send","sent","awaiting_signature"].includes(doc.status)&&<select aria-label="Document status" value={doc.status} disabled={busy} onChange={e=>updateDocument(doc.id,{status:e.target.value as DocumentStatus,sentAt:e.target.value==="sent"?isoNow():doc.sentAt},"Document "+doc.number+" status updated.")}><option value="ready_to_send">Ready to send</option><option value="sent">Sent</option><option value="awaiting_signature">Awaiting signature</option></select>}{doc.status!=="signed"&&<label className="rr-ops-upload-signed"><Upload size={14}/> Attach signed PDF<input type="file" accept="application/pdf,.pdf" disabled={busy} onChange={event=>void uploadSignedPdf(doc,event)}/></label>}{doc.privateFilePath&&doc.status!=="signed"&&<button type="button" className="rr-ops-text-button" disabled={busy} onClick={()=>signDocument(doc)}>Confirm signed by {signerName||"Owner"}</button>}</div></article>)}
        </section>
        <section className="rr-panel"><div className="rr-panel-heading"><div><h2>Version-specific approvals</h2><p>Record a decision against an exact document or quote revision.</p></div><BadgeCheck size={20}/></div>
          <form className="rr-ops-form-grid" onSubmit={saveApproval}>
            <label>Approval type<select value={approvalKind} onChange={e=>setApprovalKind(e.target.value as ProjectApproval["kind"])}><option value="design">Design sign-off</option><option value="quotation">Quotation acceptance</option><option value="contract">Works contract</option><option value="change_order">Change order</option><option value="handover">Handover</option><option value="waiver">Policy/gate waiver</option></select></label>
            <label>Exact quote/document version<select required value={approvalTargetId} onChange={e=>setApprovalTargetId(e.target.value)}><option value="">Choose version…</option><optgroup label="Documents">{projectDocs.map((doc)=><option key={doc.id} value={doc.id}>{doc.title} · v{doc.version} · {doc.status}</option>)}</optgroup><optgroup label="Quotations">{projectQuotes.map((quote)=><option key={quote.id} value={quote.id}>{quote.kind} quote · v{quote.revision} · {quote.status}</option>)}</optgroup></select></label>
            <label>Decision<select value={approvalDecision} onChange={e=>setApprovalDecision(e.target.value as ApprovalDecision)}><option value="approved">Approved</option><option value="changes_requested">Changes requested</option><option value="rejected">Rejected</option><option value="pending">Pending</option></select></label>
            <label className="rr-ops-wide">Decision comments / evidence note<textarea rows={2} value={approvalComments} onChange={e=>setApprovalComments(e.target.value)}/></label>
            <div className="rr-ops-form-footer"><span>Design approval is accepted only when it references a signed/accepted Design sign-off document.</span><button className="rr-primary" disabled={busy}><Check size={15}/> Record approval</button></div>
          </form>
          {projectApprovals.map((approval)=><div className="rr-ops-task-row" key={approval.id}><div><b>{approval.kind} · {approval.decision.replaceAll("_"," ")}</b><small>Target {approval.targetId} · v{approval.targetVersion} · {approval.decidedAt||"Pending"}</small>{approval.comments&&<p>{approval.comments}</p>}</div></div>)}
        </section>
      </>}
    </div>}

    {tab==="delivery"&&<div className="rr-ops-stack">
      {!project?<section className="rr-panel"><h2>Select a project first</h2><p>Choose a Project Passport in the Projects tab.</p></section>:<>
        <section className="rr-panel"><div className="rr-panel-heading"><div><h2>Production, dispatch and handover checklist</h2><p>Each required item needs evidence or an explicit not-applicable reason. Status changes are saved as one audited checklist update.</p></div><ClipboardCheck size={20}/></div>
          {(["booking","design_signoff","production_release","dispatch","site_readiness","installation","handover"] as const).map((gate)=>{const items=projectChecks.filter((item)=>item.gate===gate);if(!items.length)return null;return <div className="rr-ops-check-group" key={gate}><h3>{gate.replaceAll("_"," ")} <small>{items.filter((item)=>item.status==="passed"||item.status==="not_applicable"&&item.notApplicableReason.trim()).length}/{items.length} checked</small></h3>{items.map((check)=> <div className="rr-ops-check-row" key={check.id}><div className="rr-ops-check-icon">{check.status==="passed"?<Check size={17}/>:<ClipboardCheck size={17}/>}</div><div className="rr-ops-check-text"><b>{check.title}{check.required?" *":""}</b><textarea aria-label={"Evidence for "+check.title} rows={1} placeholder={check.status==="not_applicable"?"Reason why this does not apply":"Evidence, measurement, test result or snag reference"} value={check.status==="not_applicable"?check.notApplicableReason:check.resultNote} onChange={e=>updateChecklist(check,check.status,e.target.value)}/></div><select aria-label={"Status "+check.title} value={check.status} disabled={busy} onChange={e=>updateChecklist(check,e.target.value as ChecklistStatus,check.resultNote)}><option value="pending">Pending</option><option value="passed">Passed</option><option value="failed">Failed</option><option value="not_applicable">N/A with reason</option></select></div>)}</div>})}
          <div className="rr-ops-form-footer"><span>Failed items must be resolved or explicitly not applicable with a reason; do not bypass them by changing the phase manually.</span><button className="rr-primary" onClick={saveChecklist} disabled={busy}><Check size={15}/> Save checklist</button></div>
        </section>
        <section className="rr-panel"><div className="rr-panel-heading"><div><h2>Site & delivery readiness</h2><p>Use one place to record the plan and avoid promising dates before dependencies are clear.</p></div><CalendarClock size={20}/></div>
          <form className="rr-ops-form-grid" onSubmit={saveProject}>
            <label>Target project start<input type="date" value={project.targetStartDate} onChange={e=>updateProjectField("targetStartDate",e.target.value)}/></label>
            <label>Committed delivery date<input type="date" value={project.committedDeliveryDate} onChange={e=>updateProjectField("committedDeliveryDate",e.target.value)}/></label>
            <label>Site ready?<select value={project.siteReady?"yes":"no"} onChange={e=>updateProjectField("siteReady",e.target.value==="yes")}><option value="no">Not confirmed</option><option value="yes">Confirmed ready</option></select></label>
            <label className="rr-ops-wide">Blocker / client dependency<textarea rows={2} value={project.blockedReason} onChange={e=>updateProjectField("blockedReason",e.target.value)}/></label>
            <div className="rr-ops-form-footer"><span>Committed dates should follow the approved clock-start and pause rules.</span><button className="rr-primary" disabled={busy}><Check size={15}/> Save readiness</button></div>
          </form>
        </section>
        <section className="rr-panel"><div className="rr-panel-heading"><div><h2>Communication queue</h2><p>Prepare reminders and client updates. No message is claimed sent until you mark it after sending.</p></div><MessageCircle size={20}/></div>
          <div className="rr-ops-communication-build"><label>Template<select value={messageTemplate} onChange={e=>setMessageTemplate(e.target.value)}><option value="booking_confirmation">Booking confirmation</option><option value="design_review">Design review ready</option><option value="payment_due">Payment milestone reminder</option><option value="site_readiness">Site readiness</option><option value="handover">Handover coordination</option><option value="email_project_update">Email project update</option></select></label><button className="rr-primary" onClick={createMessage} disabled={busy}><Plus size={14}/> Create message draft</button></div>
          {projectComms.map((msg)=><article className="rr-ops-message" key={msg.id}><div><b>{msg.subject}</b><small>{msg.kind} · {msg.recipient} · {msg.createdAt.slice(0,16).replace("T"," ")}</small><p>{msg.body}</p><span className={"rr-ops-status "+msg.status}>{msg.status}</span>{msg.failureReason&&<small>Last failure: {msg.failureReason}</small>}</div><div className="rr-ops-button-row"><button className="rr-secondary" type="button" disabled={busy} onClick={()=>void openMessage(msg)}>{msg.kind==="whatsapp"?<MessageCircle size={14}/>:<Mail size={14}/>} Open {msg.kind==="whatsapp"?"WhatsApp":"email"}</button>{msg.status!=="sent"&&<button className="rr-ops-text-button" type="button" disabled={busy} onClick={()=>markMessageSent(msg)}>Mark sent</button>}</div></article>)}
        </section>
      </>}
    </div>}

    {tab==="aftercare"&&<div className="rr-ops-stack">
      {!project?<section className="rr-panel"><h2>Select a project first</h2><p>Choose a Project Passport in the Projects tab.</p></section>:<>
        <section className="rr-panel"><div className="rr-panel-heading"><div><h2>Warranty register</h2><p>A certificate is created only from an issued project tax invoice and approved terms.</p></div><ShieldCheck size={20}/></div>
          <div className="rr-ops-inline-form"><label>Issued project tax invoice<select value={warrantyInvoiceId} onChange={e=>setWarrantyInvoiceId(e.target.value)}><option value="">Select invoice document…</option>{projectDocs.filter((doc)=>doc.kind==="tax_invoice"&&doc.status==="issued").map((doc)=><option key={doc.id} value={doc.id}>{doc.number} · {textOf((doc.snapshot as Record<string,unknown>).invoiceDate)||doc.issuedAt.slice(0,10)}</option>)}</select></label><button className="rr-primary" disabled={busy} onClick={addWarranty}><Plus size={14}/> Register warranty</button></div>
          {projectWarranty.length===0?<p className="rr-ops-muted">No warranty registered yet. Phase 0 warranty rules are deliberately unapproved until RR confirms the policy.</p>:projectWarranty.map((warranty)=><article className="rr-ops-document-row" key={warranty.id}><div className="rr-ops-document-icon"><ShieldCheck size={19}/></div><div className="rr-ops-document-main"><b>{warranty.status.replaceAll("_"," ")} · {warranty.joineryMonths===null?"Duration pending":warranty.joineryMonths/12+" years"}</b><small>Start {warranty.startDate} · ends {warranty.endDate} · invoice {warranty.invoiceDocumentId}</small><small>{warranty.thirdPartyNotes}</small></div><span className={"rr-ops-status "+warranty.status}>{warranty.status}</span></article>)}
        </section>
        <section className="rr-panel"><div className="rr-panel-heading"><div><h2>Warranty claims</h2><p>Log the issue first. Coverage determination is a deliberate review, not an automatic promise.</p></div><History size={20}/></div>
          <form className="rr-ops-form-grid" onSubmit={addWarrantyClaim}><label>Product / area<input value={claimArea} onChange={e=>setClaimArea(e.target.value)} placeholder="Kitchen drawer, wardrobe shutter…"/></label><label className="rr-ops-wide">Customer's reported issue<textarea required rows={3} value={claimIssue} onChange={e=>setClaimIssue(e.target.value)}/></label><div className="rr-ops-form-footer"><span>New claims start in triage and need an owner/next action.</span><button className="rr-primary" disabled={busy}><Plus size={14}/> Log claim</button></div></form>
          {projectClaims.map((claim)=><article className="rr-ops-message" key={claim.id}><div><b>{claim.claimNumber} · {claim.productArea||"Product area not specified"}</b><small>Received {claim.receivedAt.slice(0,10)} · {claim.customerName} · {claim.priority}</small><p>{claim.issue}</p><small>{claim.eligibilityNotes}</small><div className="rr-ops-next-action">Next: {claim.nextAction} · {claim.nextActionDate}</div></div><div className="rr-ops-claim-actions"><select value={claim.status} disabled={busy} onChange={e=>changeClaim(claim,e.target.value as WarrantyClaim["status"])}>{["new","triage","under_warranty","chargeable","scheduled","in_progress","resolved","rejected"].map((status)=><option value={status} key={status}>{status.replaceAll("_"," ")}</option>)}</select><textarea rows={2} aria-label="Resolution" placeholder="Resolution / service notes" value={claim.resolution} onChange={e=>{if(data)setData({...data,warrantyClaims:data.warrantyClaims.map((item)=>item.id===claim.id?{...item,resolution:e.target.value}:item)});}}/><button className="rr-ops-text-button" type="button" disabled={busy} onClick={()=>data&&void commit(data,"Warranty claim "+claim.claimNumber+" resolution saved.")}>Save resolution</button></div></article>)}
        </section>
      </>}
      <section className="rr-panel"><div className="rr-panel-heading"><div><h2>Backup & recovery</h2><p>Nightly encrypted snapshot is configured for Vercel Cron. Keep a separate downloadable export before risky changes.</p></div><Archive size={20}/></div><div className="rr-ops-backup-actions"><button className="rr-primary" onClick={()=>void downloadBackup()}><Download size={15}/> Download full backup</button><label className="rr-ops-restore-picker"><Upload size={15}/> Select backup JSON<input type="file" accept="application/json,.json" onChange={e=>setRestoreFile(e.target.files?.[0]||null)}/></label><button className="rr-secondary" disabled={!restoreFile||busy} onClick={()=>void restoreBackup()}>Restore selected backup</button></div><p className="rr-ops-muted">Restore replaces CRM and Project Passport data. Export first. Signed private PDFs are kept separately and are not deleted by restore.</p><p className="rr-ops-muted">The daily backup endpoint needs the Vercel environment variable <code>CRON_SECRET</code>; add a unique random value in Vercel settings. If it is absent, the cron will report failure rather than run unauthenticated.</p></section>
    </div>}

    {tab==="rules"&&<div className="rr-ops-stack">
      <section className="rr-panel rr-ops-rule-intro"><span className="rr-eyebrow">PHASE 0 · MASTER TERMS</span><h2>Agree on the rules once. Let every project inherit them.</h2><p>Current template conflicts mean this policy starts locked. Save drafts while you review, but do not mark the policy approved until the payment, tax, delivery, warranty, contract and communications rules are signed off by the right people.</p><div className="rr-ops-policy-state"><span className={data.policy.approved?"is-approved":""}>{data.policy.approved?"Policy approved":"Policy locked"}</span><small>Revision {data.policy.revision} · {data.policy.approvedAt||"Not approved"}</small></div></section>
      <section className="rr-panel"><div className="rr-panel-heading"><div><h2>Payment milestones</h2><p>Percentages must total 100%. Names/triggers determine which payment unlocks a phase.</p></div><button className="rr-secondary" type="button" onClick={()=>setData({...data,policy:{...data.policy,paymentMilestones:[...data.policy.paymentMilestones,{id:newId(),name:"New milestone",percent:0,trigger:"Needs definition"}]}})}><Plus size={14}/> Add milestone</button></div>
        {data.policy.paymentMilestones.length===0?<div className="rr-ops-empty"><Wallet size={22}/><b>No payment schedule approved</b><p>Your quote workbook says 10/60/20/10, while the booking form says 10/40/50 and the contract says 50/50. No schedule has been assumed.</p></div>:data.policy.paymentMilestones.map((milestone,index)=><div className="rr-ops-milestone-editor" key={milestone.id}><label>Milestone<input value={milestone.name} onChange={e=>setData({...data,policy:{...data.policy,paymentMilestones:data.policy.paymentMilestones.map((item,i)=>i===index?{...item,name:e.target.value}:item)}})}/></label><label>Percent<input type="number" min="0" max="100" step="0.1" value={milestone.percent} onChange={e=>setData({...data,policy:{...data.policy,paymentMilestones:data.policy.paymentMilestones.map((item,i)=>i===index?{...item,percent:Number(e.target.value)}:item)}})}/></label><label>Trigger / unlock point<input value={milestone.trigger} onChange={e=>setData({...data,policy:{...data.policy,paymentMilestones:data.policy.paymentMilestones.map((item,i)=>i===index?{...item,trigger:e.target.value}:item)}})}/></label><button type="button" className="rr-ops-remove" aria-label="Remove payment milestone" onClick={()=>setData({...data,policy:{...data.policy,paymentMilestones:data.policy.paymentMilestones.filter((item)=>item.id!==milestone.id)}})}><X size={14}/></button></div>)}
        <div className="rr-ops-milestone-total"><span>Total allocation</span><b>{data.policy.paymentMilestones.reduce((sum,item)=>sum+item.percent,0).toFixed(1)}%</b><span>{Math.abs(data.policy.paymentMilestones.reduce((sum,item)=>sum+item.percent,0)-100)<0.01?"Allocation balances":"Must equal 100%"}</span></div>
      </section>
      <section className="rr-panel"><div className="rr-panel-heading"><div><h2>Tax & invoices (CA sign-off)</h2><p>Do not issue tax invoices or payment receipts until these fields are confirmed.</p></div><FileText size={20}/></div>
        <div className="rr-ops-form-grid"><label>GST rate (%)<input type="number" min="0" max="100" step="0.01" value={data.policy.gst.rate??""} onChange={e=>setData({...data,policy:{...data.policy,gst:{...data.policy.gst,rate:e.target.value===""?null:Number(e.target.value)}}})}/></label><label>Default HSN/SAC or tax code<input value={data.policy.gst.defaultTaxCode} onChange={e=>setData({...data,policy:{...data.policy,gst:{...data.policy.gst,defaultTaxCode:e.target.value}}})}/></label><label className="rr-ops-wide">CA notes on advance receipt vouchers, invoice timing, rounding and tax split<textarea rows={3} value={data.policy.gst.notes} onChange={e=>setData({...data,policy:{...data.policy,gst:{...data.policy.gst,notes:e.target.value}}})}/></label><label className="rr-ops-check-toggle"><input type="checkbox" checked={data.policy.gst.approved} onChange={e=>setData({...data,policy:{...data.policy,gst:{...data.policy.gst,approved:e.target.checked}}})}/> CA-approved tax treatment</label><label className="rr-ops-check-toggle"><input type="checkbox" checked={data.policy.reviewedByCA} onChange={e=>setData({...data,policy:{...data.policy,reviewedByCA:e.target.checked}})}/> CA review completed</label></div>
      </section>
      <section className="rr-panel"><div className="rr-panel-heading"><div><h2>Delivery commitment</h2><p>Start date, day type, grace and pause rules flow into every proposal and client update.</p></div><CalendarClock size={20}/></div>
        <div className="rr-ops-form-grid"><label>Duration (number)<input type="number" min="1" value={data.policy.delivery.duration??""} onChange={e=>setData({...data,policy:{...data.policy,delivery:{...data.policy.delivery,duration:e.target.value===""?null:Number(e.target.value)}}})}/></label><label>Unit<select value={data.policy.delivery.unit} onChange={e=>setData({...data,policy:{...data.policy,delivery:{...data.policy.delivery,unit:e.target.value as BusinessPolicy["delivery"]["unit"]}}})}><option value="working_days">Working days</option><option value="calendar_days">Calendar days</option></select></label><label>Grace period (days)<input type="number" min="0" value={data.policy.delivery.graceDays??""} onChange={e=>setData({...data,policy:{...data.policy,delivery:{...data.policy.delivery,graceDays:e.target.value===""?null:Number(e.target.value)}}})}/></label><label>Clock starts when<input value={data.policy.delivery.clockStartsAt} onChange={e=>setData({...data,policy:{...data.policy,delivery:{...data.policy.delivery,clockStartsAt:e.target.value}}})} placeholder="e.g. all approvals + required payment"/></label><label className="rr-ops-wide">Pause / extension conditions<textarea rows={3} value={data.policy.delivery.pauseConditions.join("\n")} onChange={e=>setData({...data,policy:{...data.policy,delivery:{...data.policy.delivery,pauseConditions:e.target.value.split("\n").map(x=>x.trim()).filter(Boolean)}}})}/></label><label className="rr-ops-wide">Delivery policy notes<textarea rows={2} value={data.policy.delivery.notes} onChange={e=>setData({...data,policy:{...data.policy,delivery:{...data.policy.delivery,notes:e.target.value}}})}/></label><label className="rr-ops-check-toggle"><input type="checkbox" checked={data.policy.delivery.approved} onChange={e=>setData({...data,policy:{...data.policy,delivery:{...data.policy.delivery,approved:e.target.checked}}})}/> Delivery terms approved</label></div>
      </section>
      <section className="rr-panel"><div className="rr-panel-heading"><div><h2>Warranty policy</h2><p>Joinery, third-party accessories, start dates, exclusions and service fees must match the approved policy.</p></div><ShieldCheck size={20}/></div>
        <div className="rr-ops-form-grid"><label>Joinery cover (months)<input type="number" min="0" value={data.policy.warranty.joineryMonths??""} onChange={e=>setData({...data,policy:{...data.policy,warranty:{...data.policy.warranty,joineryMonths:e.target.value===""?null:Number(e.target.value)}}})}/></label><label>Warranty starts on<select value={data.policy.warranty.startRule} onChange={e=>setData({...data,policy:{...data.policy,warranty:{...data.policy.warranty,startRule:e.target.value as BusinessPolicy["warranty"]["startRule"]}}})}><option value="invoice_date">Invoice date</option><option value="handover_date">Handover date</option><option value="other">Other (define in notes)</option></select></label><label className="rr-ops-wide">Third-party appliance/fitting warranty<textarea rows={2} value={data.policy.warranty.thirdPartyRule} onChange={e=>setData({...data,policy:{...data.policy,warranty:{...data.policy.warranty,thirdPartyRule:e.target.value}}})}/></label><label className="rr-ops-wide">Exclusions<textarea rows={3} value={data.policy.warranty.exclusions} onChange={e=>setData({...data,policy:{...data.policy,warranty:{...data.policy.warranty,exclusions:e.target.value}}})}/></label><label className="rr-ops-wide">Service/handling fee rule<textarea rows={2} value={data.policy.warranty.serviceFeeRule} onChange={e=>setData({...data,policy:{...data.policy,warranty:{...data.policy.warranty,serviceFeeRule:e.target.value}}})}/></label><label className="rr-ops-check-toggle"><input type="checkbox" checked={data.policy.warranty.approved} onChange={e=>setData({...data,policy:{...data.policy,warranty:{...data.policy.warranty,approved:e.target.checked}}})}/> Warranty terms approved</label></div>
      </section>
      <section className="rr-panel"><div className="rr-panel-heading"><div><h2>Contract, cancellation & signature policy</h2><p>Legal review is required for the contract wording and stamp-duty process.</p></div><FileCheck2 size={20}/></div>
        <div className="rr-ops-form-grid"><label>Master contract version<input value={data.policy.contract.version} onChange={e=>setData({...data,policy:{...data.policy,contract:{...data.policy.contract,version:e.target.value}}})}/></label><label>Signature method<select value={data.policy.contract.signatureMethod} onChange={e=>setData({...data,policy:{...data.policy,contract:{...data.policy.contract,signatureMethod:e.target.value}}})}><option value="manual_upload">Manual signature + secure PDF upload</option><option value="esign_vendor">External e-sign service</option><option value="digital_signature">Digital signature certificate</option></select></label><label className="rr-ops-wide">Approved cancellation/change-order policy<textarea rows={3} value={data.policy.contract.cancellationPolicy} onChange={e=>setData({...data,policy:{...data.policy,contract:{...data.policy.contract,cancellationPolicy:e.target.value}}})}/></label><label className="rr-ops-wide">Contract review notes<textarea rows={2} value={data.policy.contract.notes} onChange={e=>setData({...data,policy:{...data.policy,contract:{...data.policy.contract,notes:e.target.value}}})}/></label><label className="rr-ops-check-toggle"><input type="checkbox" checked={data.policy.contract.approved} onChange={e=>setData({...data,policy:{...data.policy,contract:{...data.policy.contract,approved:e.target.checked}}})}/> Contract wording approved</label><label className="rr-ops-check-toggle"><input type="checkbox" checked={data.policy.reviewedByLegal} onChange={e=>setData({...data,policy:{...data.policy,reviewedByLegal:e.target.checked}})}/> Legal review completed</label><label className="rr-ops-check-toggle"><input type="checkbox" checked={data.policy.contract.stampDutyReviewed} onChange={e=>setData({...data,policy:{...data.policy,contract:{...data.policy.contract,stampDutyReviewed:e.target.checked}})}/> Stamp-duty method reviewed</label></div>
      </section>
      <section className="rr-panel"><div className="rr-panel-heading"><div><h2>Communications defaults</h2><p>The system prepares messages and tracks state; it will not claim WhatsApp/email delivery without proof.</p></div><BellRing size={20}/></div>
        <div className="rr-ops-form-grid"><label>Email provider<input value={data.policy.communications.ownerEmailProvider} onChange={e=>setData({...data,policy:{...data.policy,communications:{...data.policy.communications,ownerEmailProvider:e.target.value}}})} placeholder="Gmail / Google Workspace / Microsoft 365…"/></label><label>WhatsApp mode<select value={data.policy.communications.whatsappMode} onChange={e=>setData({...data,policy:{...data.policy,communications:{...data.policy.communications,whatsappMode:e.target.value as BusinessPolicy["communications"]["whatsappMode"]}}})}><option value="manual">Manual send in WhatsApp Business (no API cost)</option><option value="api">Official WhatsApp Business Platform API</option></select></label><label>Business hours/timezone<input value={data.policy.communications.businessHours} onChange={e=>setData({...data,policy:{...data.policy,communications:{...data.policy.communications,businessHours:e.target.value}}})}/></label><label className="rr-ops-check-toggle"><input type="checkbox" checked={data.policy.communications.approvedTemplates} onChange={e=>setData({...data,policy:{...data.policy,communications:{...data.policy.communications,approvedTemplates:e.target.checked}})}/> Message templates approved</label><label className="rr-ops-check-toggle"><input type="checkbox" checked={data.policy.communications.remindersEnabled} onChange={e=>setData({...data,policy:{...data.policy,communications:{...data.policy.communications,remindersEnabled:e.target.checked}})}/> Enable reminder tasks</label></div>
        <label className="rr-ops-check-toggle rr-ops-global-approve"><input type="checkbox" checked={data.policy.approved} onChange={e=>setData({...data,policy:{...data.policy,approved:e.target.checked,approvedAt:e.target.checked?isoNow():"",approvedBy:e.target.checked?(signerName||"Owner"):""}})}/> I confirm all Phase 0 policies above have been checked and are approved for new projects.</label>
        <div className="rr-ops-form-footer"><span>CA review, legal/stamp-duty review and all sub-policy approvals are enforced by the server.</span><button className="rr-primary" disabled={busy} onClick={()=>void commit(data,"Phase 0 rules saved. Policy stays locked unless all approval gates pass.")}><Check size={15}/> Save Phase 0 rules</button></div>
      </section>
    </div>}

    <footer className="rr-ops-footer"><span>RR Project Passport · schema v{data.schemaVersion} · revision {data.revision} · saved {data.lastSavedAt?new Date(data.lastSavedAt).toLocaleString("en-IN"):"not saved yet"}</span><span>{busy?<><LoaderCircle className="rr-ops-spin" size={13}/> Saving</>:<><Check size={13}/> Changes saved to encrypted operations storage</>}</span></footer>
  </div>;
}
