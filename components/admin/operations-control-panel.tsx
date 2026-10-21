"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { AlertCircle, Check, ClipboardCheck, FileText, LoaderCircle, RefreshCw, Upload, Wallet } from "lucide-react";

type RecordItem = Record<string, unknown>;
type Snapshot = {
  workspace: {
    leads: RecordItem[];
    invoices: RecordItem[];
    clients: RecordItem[];
    properties: RecordItem[];
    projects: RecordItem[];
    documents: RecordItem[];
    auditEvents: RecordItem[];
    commercialPolicies: RecordItem[];
  };
  revision: string | null;
};
type MilestoneDraft = { name: string; purpose: "booking_advance" | "milestone" | "final"; percentage: string };
type DocumentType =
  | "works_contract" | "final_contract" | "approved_quotation" | "signed_design_approval"
  | "production_specification" | "production_qc" | "production_completion" | "installation_signoff"
  | "handover_acceptance" | "warranty_certificate" | "project_closure" | "policy_approval";

const DOCUMENT_OPTIONS: Array<{ value: DocumentType; label: string; signed: boolean; approved: boolean }> = [
  { value: "works_contract", label: "Signed works contract", signed: true, approved: false },
  { value: "final_contract", label: "Signed final contract", signed: true, approved: false },
  { value: "approved_quotation", label: "Approved quotation", signed: false, approved: true },
  { value: "signed_design_approval", label: "Signed design approval", signed: true, approved: false },
  { value: "production_specification", label: "Approved production specification", signed: false, approved: true },
  { value: "production_qc", label: "Approved production QC requirements", signed: false, approved: true },
  { value: "production_completion", label: "Production completion evidence", signed: false, approved: false },
  { value: "installation_signoff", label: "Signed installation sign-off", signed: true, approved: false },
  { value: "handover_acceptance", label: "Signed customer handover acceptance", signed: true, approved: false },
  { value: "warranty_certificate", label: "Signed warranty certificate", signed: true, approved: true },
  { value: "project_closure", label: "Project closure record", signed: false, approved: false },
  { value: "policy_approval", label: "Signed policy approval evidence", signed: true, approved: false },
];

const NEXT_MILESTONE: Record<string, string> = {
  production_preflight: "production",
  production: "execution",
  execution: "handover",
  handover: "warranty",
};

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}
function moneyPercent(value: number): string {
  return `${Number.isFinite(value) ? value.toFixed(2).replace(/\.00$/, "") : "0"}%`;
}
function docLabel(doc: RecordItem): string {
  const option = DOCUMENT_OPTIONS.find((item) => item.value === doc.documentType);
  return `${option?.label || asText(doc.documentType) || "Document"} · v${String(doc.version || 1)}`;
}

export default function OperationsControlPanel() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [policyName, setPolicyName] = useState("Interior project payment schedule");
  const [policyNotes, setPolicyNotes] = useState("");
  const [milestones, setMilestones] = useState<MilestoneDraft[]>([
    { name: "Booking advance", purpose: "booking_advance", percentage: "10" },
    { name: "Design approval", purpose: "milestone", percentage: "40" },
    { name: "Manufacturing / dispatch readiness", purpose: "milestone", percentage: "50" },
  ]);
  const [documentType, setDocumentType] = useState<DocumentType>("works_contract");
  const [leadId, setLeadId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [policyId, setPolicyId] = useState("");
  const [approvalRole, setApprovalRole] = useState<"RR" | "CA" | "Legal">("RR");
  const [approverName, setApproverName] = useState("");
  const [approverEmail, setApproverEmail] = useState("");
  const [signedAt, setSignedAt] = useState(new Date().toISOString().slice(0, 10));
  const [signatureEvidenceRef, setSignatureEvidenceRef] = useState("");
  const [approvalEvidenceRef, setApprovalEvidenceRef] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [addressDrafts, setAddressDrafts] = useState<Record<string, string>>({});

  const reload = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/workspace", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not load the admin workspace.");
      if (!data.workspace || !(data.revision === null || typeof data.revision === "string")) {
        throw new Error("The workspace response is missing its current revision.");
      }
      setLoadError("");
      setSnapshot(data as Snapshot);
    setAddressDrafts((previous) => {
      const next = { ...previous };
      for (const property of data.workspace.properties as RecordItem[]) {
        const id = asText(property.id);
        if (id && next[id] === undefined) next[id] = asText(property.addressText);
      }
      return next;
      });
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load operations.");
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/workspace", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Could not load the admin workspace.");
        if (!data.workspace || !(data.revision === null || typeof data.revision === "string")) {
          throw new Error("The workspace response is missing its current revision.");
        }
        return data as Snapshot;
      })
      .then((data) => {
        if (!active) return;
        setSnapshot(data);
        setLoadError("");
        setAddressDrafts((previous) => {
          const next = { ...previous };
          for (const property of data.workspace.properties) {
            const id = asText(property.id);
            if (id && next[id] === undefined) next[id] = asText(property.addressText);
          }
          return next;
        });
      })
      .catch((error: unknown) => {
        if (active) setLoadError(error instanceof Error ? error.message : "Could not load operations.");
      });
    return () => { active = false; };
  }, []);

  const workspace = snapshot?.workspace;
  const percentTotal = useMemo(
    () => Math.round(milestones.reduce((sum, item) => sum + (Number(item.percentage) || 0), 0) * 100) / 100,
    [milestones],
  );
  const linkedProjects = useMemo(() => (workspace?.projects || []).map((project) => {
    const property = (workspace?.properties || []).find((item) => item.id === project.propertyId);
    const lead = (workspace?.leads || []).find((item) => item.id === project.sourceOpportunityId);
    return { project, property, lead };
  }), [workspace]);

  async function postAction(payload: Record<string, unknown>) {
    if (!snapshot) throw new Error("The workspace has not loaded yet.");
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/admin/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, revision: snapshot.revision }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "The operations change could not be saved.");
      setNotice("Saved. Refreshing the workspace to synchronise all admin views.");
      window.location.reload();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "The operations change could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function recordSiteAddress(event: FormEvent<HTMLFormElement>, propertyIdValue: string) {
    event.preventDefault();
    await postAction({ action: "confirm-site-address", propertyId: propertyIdValue, addressText: addressDrafts[propertyIdValue] || "" });
  }

  async function advanceProject(project: RecordItem) {
    const next = NEXT_MILESTONE[asText(project.currentMilestone)];
    if (!next) return;
    const ok = window.confirm(`Advance ${asText(project.reference) || asText(project.id)} to ${next.replaceAll("_", " ")}? The server will re-check the evidence requirements.`);
    if (!ok) return;
    await postAction({ action: "advance-project", projectId: project.id, targetMilestone: next });
  }

  async function createPolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await postAction({
      action: "create-policy-draft",
      name: policyName,
      notes: policyNotes,
      paymentMilestones: milestones.map((item, index) => ({
        id: `MILESTONE-${index + 1}`,
        name: item.name,
        purpose: item.purpose,
        percentage: Number(item.percentage),
      })),
    });
  }

  async function submitPolicy(policy: RecordItem) {
    await postAction({ action: "submit-policy-for-review", policyId: policy.id });
  }

  async function uploadDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!snapshot || !file) {
      setLoadError("Select a PDF before uploading.");
      return;
    }
    setBusy(true);
    setLoadError("");
    setNotice("");
    try {
      const data = new FormData();
      data.set("file", file);
      data.set("revision", snapshot.revision || "");
      data.set("documentType", documentType);
      data.set("leadId", leadId);
      data.set("projectId", projectId);
      data.set("policyId", documentType === "policy_approval" ? policyId : "");
      data.set("approvalRole", documentType === "policy_approval" ? approvalRole : "");
      data.set("approverName", documentType === "policy_approval" ? approverName : "");
      data.set("approverEmail", documentType === "policy_approval" ? approverEmail : "");
      data.set("signedAt", DOCUMENT_OPTIONS.find((item) => item.value === documentType)?.signed ? signedAt : "");
      data.set("signatureEvidenceRef", DOCUMENT_OPTIONS.find((item) => item.value === documentType)?.signed ? signatureEvidenceRef : "");
      data.set("approvalEvidenceRef", DOCUMENT_OPTIONS.find((item) => item.value === documentType)?.approved ? approvalEvidenceRef : "");
      const response = await fetch("/api/admin/operations/documents", { method: "POST", body: data });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Document upload failed.");
      setNotice("Private document uploaded and versioned. Refreshing workspace.");
      window.location.reload();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Document upload failed.");
    } finally {
      setBusy(false);
    }
  }

  async function recordApproval(policy: RecordItem) {
    const roleStage: Record<string, string> = {
      awaiting_rr_approval: "RR",
      awaiting_ca_approval: "CA",
      awaiting_legal_approval: "Legal",
    };
    const expected = roleStage[asText(policy.status)];
    const signedEvidence = (workspace?.documents || []).filter((doc) =>
      doc.documentType === "policy_approval" && doc.policyId === policy.id &&
      doc.approvalRole === expected && doc.status === "signed",
    );
    if (signedEvidence.length === 0) {
      setLoadError(`Upload the signed ${expected} approval PDF first, linked to this policy.`);
      return;
    }
    await postAction({ action: "approve-policy", policyId: policy.id, approvalDocumentId: signedEvidence[signedEvidence.length - 1].id });
  }

  if (!workspace) {
    return <section className="rr-panel rr-settings-panel">
      <h2><ClipboardCheck size={20} /> Operations & documents</h2>
      <p>{loadError || "Loading secure operations workspace…"}</p>
      {loadError && <button className="rr-secondary" type="button" onClick={() => void reload().catch((error) => setLoadError(String(error)))}><RefreshCw size={16} /> Retry</button>}
    </section>;
  }

  return <div className="rr-operations-panel">
    <section className="rr-panel rr-settings-panel">
      <div className="rr-settings-head">
        <div className="rr-setting-symbol"><ClipboardCheck size={22} /></div>
        <div><h2>Operations & documents</h2><p>Versioned private evidence, sequential project gates, and explicit commercial review states.</p></div>
        <button type="button" className="rr-secondary" disabled={busy} onClick={() => void reload().catch((error) => setLoadError(String(error)))}><RefreshCw size={15} /> Refresh</button>
      </div>
      <div className="rr-settings-note"><AlertCircle size={18}/><p><b>Evidence is not automatic legal validation.</b><br/>Uploads and references are administrator-recorded evidence. The app does not query banks, verify e-signatures, or authenticate external RR / CA / Legal signers. Keep documents in Draft / review until the real approvals have been obtained. Private PDF upload requires a separate private Blob store token.</p></div>
      {loadError && <div className="rr-login-error" role="alert">{loadError}</div>}
      {notice && <div className="rr-settings-note"><Check size={18}/><p>{notice}</p></div>}
      <div className="rr-crm-metrics rr-billing-metrics">
        <div><span>Projects</span><b>{workspace.projects.length}</b></div>
        <div><span>Blocked</span><b>{workspace.projects.filter((p) => p.operationalStatus === "blocked").length}</b></div>
        <div><span>Policy drafts / review</span><b>{workspace.commercialPolicies.filter((p) => p.status !== "approved" && p.status !== "superseded").length}</b></div>
        <div><span>Evidence records</span><b>{workspace.documents.length}</b></div>
      </div>
    </section>

    <section className="rr-panel rr-settings-panel">
      <div className="rr-settings-head"><div className="rr-setting-symbol"><Wallet size={22}/></div><div><h2>Commercial policy review</h2><p>Create a versioned draft, total milestone percentages, then attach signed RR, CA and Legal approval records in sequence.</p></div></div>
      <form className="rr-modal-form" onSubmit={(event) => void createPolicy(event)}>
        <label>Policy name</label>
        <input required maxLength={120} value={policyName} onChange={(event) => setPolicyName(event.target.value)} />
        <label>Payment milestones</label>
        {milestones.map((item, index) => <div className="rr-two-field" key={index}>
          <div><label>Milestone name</label><input required value={item.name} onChange={(event) => setMilestones((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, name: event.target.value } : row))}/></div>
          <div><label>Purpose / percent</label><div className="rr-two-field"><select value={item.purpose} onChange={(event) => setMilestones((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, purpose: event.target.value as MilestoneDraft["purpose"] } : row))}><option value="booking_advance">Booking advance</option><option value="milestone">Milestone</option><option value="final">Final payment</option></select><input required type="number" min="0.01" max="100" step="0.01" value={item.percentage} onChange={(event) => setMilestones((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, percentage: event.target.value } : row))}/></div></div>
          <button className="rr-secondary" type="button" disabled={milestones.length <= 1} onClick={() => setMilestones((current) => current.filter((_, rowIndex) => rowIndex !== index))}>Remove</button>
        </div>)}
        <button type="button" className="rr-secondary" disabled={milestones.length >= 20} onClick={() => setMilestones((current) => [...current, { name: "", purpose: "milestone", percentage: "" }])}>Add milestone</button>
        <div className="rr-total-preview"><span>Milestone total <small>Must equal 100% before review submission</small></span><b>{moneyPercent(percentTotal)}</b></div>
        <label>Notes / decision history</label><textarea rows={3} maxLength={2000} value={policyNotes} onChange={(event) => setPolicyNotes(event.target.value)} placeholder="Reason for this policy version; link the RR decision in the approval record."/>
        <button className="rr-primary" type="submit" disabled={busy || percentTotal <= 0}>Save policy draft <Check size={16}/></button>
      </form>
      <div className="rr-table-wrap"><table className="rr-table"><thead><tr><th>POLICY / VERSION</th><th>STAGE</th><th>TOTAL</th><th>APPROVALS</th><th>ACTION</th></tr></thead><tbody>
        {workspace.commercialPolicies.length === 0 && <tr><td colSpan={5}>No commercial policies yet. Create a draft from the form above.</td></tr>}
        {workspace.commercialPolicies.map((policy) => <tr key={String(policy.id)}><td><b>{asText(policy.name) || asText(policy.id)}</b><small>v{String(policy.version || 1)} · {asText(policy.familyId)}</small></td><td>{asText(policy.status).replaceAll("_", " ")}</td><td>{moneyPercent(Number(policy.totalPercentage))}</td><td>{Array.isArray(policy.approvals) ? (policy.approvals as RecordItem[]).map((approval) => asText(approval.role)).join(" · ") : "None"}</td><td>{policy.status === "draft" ? <button className="rr-secondary" disabled={busy || Math.round(Number(policy.totalPercentage) * 100) !== 10000} onClick={() => void submitPolicy(policy)}>Submit for review</button> : ["awaiting_rr_approval", "awaiting_ca_approval", "awaiting_legal_approval"].includes(asText(policy.status)) ? <button className="rr-secondary" disabled={busy} onClick={() => void recordApproval(policy)}>Record signed {asText(policy.status).includes("rr") ? "RR" : asText(policy.status).includes("ca") ? "CA" : "Legal"} approval</button> : <span>Approved record</span>}</td></tr>)}
      </tbody></table></div>
    </section>

    <section className="rr-panel rr-settings-panel">
      <div className="rr-settings-head"><div className="rr-setting-symbol"><FileText size={22}/></div><div><h2>Upload private project evidence</h2><p>PDFs are stored privately and versioned. Signed/approved labels require accompanying evidence references. Current server upload limit is 4 MB.</p></div></div>
      <form className="rr-modal-form" onSubmit={(event) => void uploadDocument(event)}>
        <label>Document type</label>
        <select value={documentType} onChange={(event) => setDocumentType(event.target.value as DocumentType)}>{DOCUMENT_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
        {documentType !== "policy_approval" && <>
          <label>Related sales opportunity</label>
          <select value={leadId} onChange={(event) => { setLeadId(event.target.value); const candidate = workspace.projects.find((project) => project.sourceOpportunityId === event.target.value); if (candidate) setProjectId(asText(candidate.id)); }}>
            <option value="">Select opportunity</option>{workspace.leads.map((lead) => <option key={String(lead.id)} value={String(lead.id)}>{asText(lead.name)} · {asText(lead.project)}</option>)}
          </select>
          <label>Related project / site (required for milestone evidence)</label>
          <select value={projectId} onChange={(event) => { setProjectId(event.target.value); const candidate = workspace.projects.find((project) => project.id === event.target.value); if (candidate) setLeadId(asText(candidate.sourceOpportunityId)); }}>
            <option value="">Select project if applicable</option>{workspace.projects.map((project) => <option key={String(project.id)} value={String(project.id)}>{asText(project.reference)} · {asText(project.currentMilestone).replaceAll("_", " ")}</option>)}
          </select>
        </>}
        {documentType === "policy_approval" && <>
          <label>Policy waiting for approval</label><select required value={policyId} onChange={(event) => {
            setPolicyId(event.target.value);
            const policy = workspace.commercialPolicies.find((item) => item.id === event.target.value);
            const status = asText(policy?.status);
            setApprovalRole(status === "awaiting_ca_approval" ? "CA" : status === "awaiting_legal_approval" ? "Legal" : "RR");
          }}><option value="">Select policy</option>{workspace.commercialPolicies.filter((policy) => ["awaiting_rr_approval", "awaiting_ca_approval", "awaiting_legal_approval"].includes(asText(policy.status))).map((policy) => <option key={String(policy.id)} value={String(policy.id)}>{asText(policy.name)} · v{String(policy.version)} · {asText(policy.status).replaceAll("_", " ")}</option>)}</select>
          <label>Reviewer role</label><select value={approvalRole} onChange={(event) => setApprovalRole(event.target.value as "RR" | "CA" | "Legal")}><option value="RR">RR</option><option value="CA">CA</option><option value="Legal">Legal</option></select>
          <label>External approver name</label><input required value={approverName} onChange={(event) => setApproverName(event.target.value)} />
          <label>External approver email</label><input type="email" required value={approverEmail} onChange={(event) => setApproverEmail(event.target.value)} />
        </>}
        {DOCUMENT_OPTIONS.find((item) => item.value === documentType)?.signed && <>
          <label>Date signed / executed</label><input required type="date" value={signedAt} onChange={(event) => setSignedAt(event.target.value)} />
          <label>Signature / audit-trail reference</label><input required maxLength={1000} value={signatureEvidenceRef} onChange={(event) => setSignatureEvidenceRef(event.target.value)} placeholder="Envelope ID, signed copy reference or audit trail"/>
        </>}
        {DOCUMENT_OPTIONS.find((item) => item.value === documentType)?.approved && <>
          <label>External approval reference</label><input required maxLength={1000} value={approvalEvidenceRef} onChange={(event) => setApprovalEvidenceRef(event.target.value)} placeholder="Signed quote/reference or approved specification ID"/>
        </>}
        <label>PDF file (max 4 MB)</label><input required type="file" accept="application/pdf,.pdf" onChange={(event) => setFile(event.target.files?.[0] || null)} />
        <button type="submit" className="rr-primary" disabled={busy || !file}><Upload size={16}/>{busy ? "Saving…" : "Upload private PDF"}</button>
      </form>
      <div className="rr-table-wrap"><table className="rr-table"><thead><tr><th>DOCUMENT</th><th>VERSION / STATUS</th><th>LINKED RECORD</th><th>FILE</th></tr></thead><tbody>
        {workspace.documents.length === 0 && <tr><td colSpan={4}>No evidence documents have been uploaded.</td></tr>}
        {workspace.documents.map((doc) => <tr key={String(doc.id)}><td><b>{docLabel(doc)}</b><small>{asText(doc.name)}</small></td><td>v{String(doc.version || 1)} · {asText(doc.status)}</td><td>{asText(doc.projectId) || asText(doc.leadId) || asText(doc.policyId) || "Workspace"}</td><td><a href={`/api/admin/operations/documents?id=${encodeURIComponent(asText(doc.id))}`} target="_blank" rel="noreferrer">Download PDF</a></td></tr>)}
      </tbody></table></div>
    </section>

    <section className="rr-panel rr-settings-panel">
      <div className="rr-settings-head"><div className="rr-setting-symbol"><ClipboardCheck size={22}/></div><div><h2>Project lifecycle</h2><p>Confirm the physical site address and advance one stage at a time after all required evidence is stored.</p></div></div>
      {linkedProjects.length === 0 && <p>No projects have been created yet. Once a qualified sale passes the server-side won-stage evidence gates, the system creates a project in blocked production preflight.</p>}
      {linkedProjects.map(({ project, property, lead }) => {
        const next = NEXT_MILESTONE[asText(project.currentMilestone)];
        const addressVerified = property?.addressVerificationStatus === "confirmed";
        return <article className="rr-settings-note" key={String(project.id)} style={{ display: "block", marginBottom: 16 }}>
          <div className="rr-settings-head"><div><h3>{asText(project.reference) || asText(project.id)}</h3><p>{asText(lead?.name)} · {asText(lead?.project)}</p></div><span className={project.operationalStatus === "blocked" ? "rr-status status-awaiting-verification" : "rr-status"}>{asText(project.operationalStatus)}</span></div>
          <p><b>Current milestone:</b> {asText(project.currentMilestone).replaceAll("_", " ")}. <b>Customer:</b> {asText(project.customerId)}.</p>
          {Array.isArray(project.blockers) && project.blockers.length > 0 && <p><b>Existing blockers:</b> {(project.blockers as string[]).join(" · ")}</p>}
          {property && <form className="rr-modal-form" onSubmit={(event) => void recordSiteAddress(event, asText(property.id))}>
            <label>Site address {addressVerified ? "· confirmed" : "· needs confirmation"}</label>
            <input required minLength={8} value={addressDrafts[asText(property.id)] ?? asText(property.addressText)} onChange={(event) => setAddressDrafts((old) => ({ ...old, [asText(property.id)]: event.target.value }))} disabled={addressVerified} />
            {!addressVerified && <button type="submit" className="rr-secondary" disabled={busy}>Confirm exact site address</button>}
          </form>}
          {next && <button className="rr-primary" disabled={busy} onClick={() => void advanceProject(project)}><Check size={16}/> Advance to {next.replaceAll("_", " ")}</button>}
          {!next && <p>The project has reached warranty. Delivery may be marked complete, while any future warranty claims need a separate service case workflow.</p>}
        </article>;
      })}
    </section>
    <p className="rr-attach-hint"><LoaderCircle size={14} /> A save conflict requires refreshing and reviewing the latest records. Do not overwrite another administrator’s changes.</p>
  </div>;
}
