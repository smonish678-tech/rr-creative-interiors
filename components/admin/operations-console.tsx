"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Activity, AlertTriangle, ArrowRight, BadgeCheck, BriefcaseBusiness, CalendarClock, Check, ChevronDown,
  CircleDollarSign, ClipboardCheck, FileText, FolderKanban, ListTodo, LoaderCircle, Plus, RefreshCw,
  ShieldCheck, UserRound, Users, Wallet, X,
} from "lucide-react";
import {
  PROJECT_STAGES, PROJECT_STAGE_LABELS, type OpsBundle, type OpsCustomer, type OpsProject,
  type OpsTask, type ProjectStage,
} from "@/lib/operations-model";

type LegacyRecord = Record<string, unknown>;
type ConsoleResponse = {
  bundle: OpsBundle;
  legacy: { leads: LegacyRecord[]; clients: LegacyRecord[]; invoices: LegacyRecord[] };
  phase0Checklist: Array<{ key: string; label: string; complete: boolean; detail: string }>;
  dashboard: { projects: number; activeProjects: number; overdueTasks: number; dueTasks: number; pendingPaymentVerifications: number; projectsOnHold: number; unapprovedPhase0Items: number; openWarrantyClaims: number };
};

type ConsoleTab = "today" | "projects" | "leads" | "tasks" | "phase0";

function safeText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function money(value: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);
}

function dateLabel(value: string): string {
  if (!value) return "Not set";
  const date = new Date(value.length === 10 ? value + "T12:00:00" : value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

export default function OperationsConsole() {
  const [data, setData] = useState<ConsoleResponse | null>(null);
  const [tab, setTab] = useState<ConsoleTab>("today");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [gateBlockers, setGateBlockers] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [createCustomerOpen, setCreateCustomerOpen] = useState(false);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [customerForm, setCustomerForm] = useState({ name: "", email: "", phone: "", billingAddress: "" });
  const [projectForm, setProjectForm] = useState({ customerId: "", title: "", serviceType: "", propertyAddress: "", apartmentNumber: "", floorNumber: "", approximateArea: "", targetHandoverDate: "" });
  const [taskForm, setTaskForm] = useState({ title: "", category: "design", description: "", dueDate: "", owner: "", priority: "normal" });

  const bundle = data?.bundle;
  const projects = bundle?.projects || [];
  const tasks = bundle?.tasks || [];
  const customers = bundle?.customers || [];
  const legacyLeads = data?.legacy.leads || [];
  const phase0Checklist = data?.phase0Checklist || [];
  const selectedProject = projects.find((project) => project.id === selectedProjectId) || null;

  const filteredProjects = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return projects;
    return projects.filter((project) => {
      const customer = customers.find((item) => item.id === project.customerId);
      return [project.projectCode, project.title, project.propertyAddress, customer?.name || ""].join(" ").toLowerCase().includes(needle);
    });
  }, [projects, customers, search]);

  const leadsNotConverted = useMemo(() => legacyLeads.filter((lead) => {
    const id = safeText(lead.id);
    return !projects.some((project) => project.sourceLeadId === id);
  }), [legacyLeads, projects]);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/operations", { cache: "no-store" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Project Operations could not be loaded.");
      setData(result as ConsoleResponse);
      if (selectedProjectId && !(result.bundle.projects as OpsProject[]).some((project) => project.id === selectedProjectId)) {
        setSelectedProjectId("");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Project Operations could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    fetch("/api/admin/operations", { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(result.error || "Project Operations could not be loaded.");
        return result as ConsoleResponse;
      })
      .then((result) => {
        if (active) setData(result);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Project Operations could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  async function command(payload: Record<string, unknown>, success: string) {
    setBusy(true);
    setError("");
    setNotice("");
    setGateBlockers([]);
    try {
      const response = await fetch("/api/admin/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, requestId: crypto.randomUUID() }),
      });
      const result = await response.json().catch(() => ({}));
      if (response.status === 409) {
        setGateBlockers(Array.isArray(result.blockers) ? result.blockers : []);
        throw new Error(result.blockers?.[0] || result.error || "This action is blocked by a stage gate.");
      }
      if (!response.ok) throw new Error(result.error || "The action could not be saved.");
      setNotice(success);
      await refresh();
      return result as Record<string, unknown>;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The action could not be saved.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function convertLead(lead: LegacyRecord) {
    const result = await command({ command: "convert-lead", leadId: safeText(lead.id) }, "A Project Passport was created. The source CRM lead stays linked and cannot be converted twice.");
    const project = result?.project as OpsProject | undefined;
    if (project?.id) {
      setSelectedProjectId(project.id);
      setTab("projects");
    }
    const blockers = Array.isArray(result?.blockers) ? result.blockers as string[] : [];
    if (blockers.length) setGateBlockers(blockers);
  }

  async function saveCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await command({ command: "create-customer", ...customerForm }, "Customer record saved.");
    const customer = result?.customer as OpsCustomer | undefined;
    if (customer) {
      setCustomerForm({ name: "", email: "", phone: "", billingAddress: "" });
      setCreateCustomerOpen(false);
      setProjectForm((current) => ({ ...current, customerId: customer.id }));
      setCreateProjectOpen(true);
    }
  }

  async function saveProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await command({ command: "create-project", ...projectForm }, "Project Passport created.");
    const project = result?.project as OpsProject | undefined;
    if (project) {
      setSelectedProjectId(project.id);
      setProjectForm({ customerId: "", title: "", serviceType: "", propertyAddress: "", apartmentNumber: "", floorNumber: "", approximateArea: "", targetHandoverDate: "" });
      setCreateProjectOpen(false);
      setTab("projects");
    }
  }

  async function updateProjectField(field: string, value: string) {
    if (!selectedProject) return;
    const result = await command({
      command: "update-project", projectId: selectedProject.id, expectedUpdatedAt: selectedProject.updatedAt,
      patch: { [field]: value },
    }, "Project details saved.");
    if (result?.project) setData((current) => current ? { ...current, bundle: { ...current.bundle, projects: current.bundle.projects.map((project) => project.id === selectedProject.id ? result.project as OpsProject : project) } } : current);
  }

  async function moveStage(targetStage: ProjectStage) {
    if (!selectedProject) return;
    await command({ command: "transition-project", projectId: selectedProject.id, targetStage, expectedUpdatedAt: selectedProject.updatedAt }, "Project stage updated. The activity has been recorded.");
  }

  async function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProject) return;
    const result = await command({ command: "create-task", projectId: selectedProject.id, ...taskForm }, "Task added to the project.");
    if (result?.task) {
      setTaskForm({ title: "", category: "design", description: "", dueDate: "", owner: "", priority: "normal" });
      setNewTaskOpen(false);
    }
  }

  async function setTaskStatus(task: OpsTask, status: OpsTask["status"]) {
    await command({ command: "update-task", taskId: task.id, expectedUpdatedAt: task.updatedAt, patch: { status } }, status === "done" ? "Task completed." : "Task status updated.");
  }

  const openTasks = tasks.filter((task) => !["done", "cancelled"].includes(task.status));
  const overdueTasks = openTasks.filter((task) => task.dueDate && task.dueDate < new Date().toISOString().slice(0, 10));
  const projectTasks = selectedProject ? tasks.filter((task) => task.projectId === selectedProject.id) : [];

  return (
    <section className="rr-ops">
      <div className="rr-page-heading rr-ops-heading">
        <div>
          <span className="rr-eyebrow">RR OPERATIONS · ONE PROJECT, ONE SOURCE OF TRUTH</span>
          <h1>Project operations</h1>
          <p>Turn an accepted customer into a controlled project. Every stage shows its next action and what must be true before work can move forward.</p>
        </div>
        <div className="rr-page-actions">
          <button type="button" className="rr-secondary" onClick={() => void refresh()} disabled={loading || busy}>
            {loading ? <LoaderCircle size={15} className="rr-spin" /> : <RefreshCw size={15} />} Refresh
          </button>
          <button type="button" className="rr-secondary" onClick={() => setCreateCustomerOpen(true)}><Users size={15}/> Add customer</button><button type="button" className="rr-primary" onClick={() => setCreateProjectOpen(true)} disabled={!customers.length}> <Plus size={16} /> New project</button>
        </div>
      </div>

      {error && <div className="rr-ops-alert is-error"><AlertTriangle size={16} /><span>{error}</span><button type="button" onClick={() => { setError(""); setGateBlockers([]); }} aria-label="Dismiss error"><X size={15}/></button></div>}
      {notice && <div className="rr-ops-alert is-success"><Check size={16} /><span>{notice}</span><button type="button" onClick={() => setNotice("")} aria-label="Dismiss message"><X size={15}/></button></div>}
      {gateBlockers.length > 0 && <div className="rr-ops-gate"><div><ShieldCheck size={18}/><b>RR stopped this transition to protect the project.</b></div><p>Complete these items first. No stage or payment record was changed by this blocked action.</p><ul>{gateBlockers.map((blocker) => <li key={blocker}>{blocker}</li>)}</ul></div>}

      <nav className="rr-ops-tabs" aria-label="Project Operations views">
        {([
          ["today", "Today", Activity],
          ["projects", "Projects", FolderKanban],
          ["leads", "Leads to convert", Users],
          ["tasks", "Tasks & follow-ups", ListTodo],
          ["phase0", "Phase 0 rules", ShieldCheck],
        ] as const).map(([key, label, Icon]) => (
          <button key={key} type="button" className={tab === key ? "active" : ""} onClick={() => setTab(key)}>
            <Icon size={16}/>{label}
          </button>
        ))}
      </nav>

      {loading && !data ? <div className="rr-ops-loading"><LoaderCircle className="rr-spin" size={22}/><span>Loading your project records…</span></div> : null}

      {data && tab === "today" && (
        <>
          <div className="rr-ops-kpis">
            <article><span>Active projects</span><b>{data.dashboard.activeProjects}</b><small>Across booking to handover</small></article>
            <article><span>Overdue actions</span><b className={data.dashboard.overdueTasks ? "has-alert" : ""}>{data.dashboard.overdueTasks}</b><small>Tasks that need attention</small></article>
            <article><span>Payment verification</span><b>{data.dashboard.pendingPaymentVerifications}</b><small>Not counted as money received yet</small></article>
            <article><span>Phase 0 approvals</span><b className={data.dashboard.unapprovedPhase0Items ? "has-alert" : ""}>{data.dashboard.unapprovedPhase0Items}</b><small>Rules still need sign-off</small></article>
          </div>
          <div className="rr-ops-two-col">
            <section className="rr-panel">
              <div className="rr-panel-heading"><div><h2>What needs attention</h2><p>The next action, not another dashboard.</p></div><button type="button" className="rr-text-action" onClick={() => setTab("tasks")}>All tasks <ArrowRight size={15}/></button></div>
              {overdueTasks.length === 0 && openTasks.filter((task) => task.dueDate && task.dueDate === new Date().toISOString().slice(0, 10)).length === 0
                ? <div className="rr-ops-empty"><BadgeCheck size={24}/><b>No overdue dated actions</b><span>New work appears here when its next action or due date is recorded.</span></div>
                : <div className="rr-ops-list">{[...overdueTasks, ...openTasks.filter((task) => task.dueDate === new Date().toISOString().slice(0, 10) && !overdueTasks.some((old) => old.id === task.id))].slice(0, 8).map((task) => {
                  const project = projects.find((item) => item.id === task.projectId);
                  return <div className="rr-ops-list-row" key={task.id}><span className={"rr-ops-dot " + (task.priority === "critical" || task.priority === "high" ? "is-alert" : "")}/><div><b>{task.title}</b><small>{project?.projectCode || "Project"} · {dateLabel(task.dueDate)}</small></div><button type="button" className="rr-ops-mini" onClick={() => { setSelectedProjectId(task.projectId); setTab("projects"); }}>Open</button></div>;
                })}</div>}
            </section>
            <section className="rr-panel">
              <div className="rr-panel-heading"><div><h2>Project journey</h2><p>Stages are separate from the sales pipeline.</p></div></div>
              <div className="rr-ops-stage-grid">{PROJECT_STAGES.filter((stage) => stage !== "on-hold").map((stage) => <div key={stage}><span>{PROJECT_STAGE_LABELS[stage]}</span><b>{projects.filter((project) => project.stage === stage).length}</b></div>)}</div>
              <div className="rr-ops-small-note"><ShieldCheck size={15}/><span>Moving a project forward checks the required approvals, verified payments and completed checklists.</span></div>
            </section>
          </div>
          <section className="rr-panel rr-ops-priority-panel">
            <div className="rr-panel-heading"><div><h2>Recently updated projects</h2><p>Resume where the work last moved.</p></div><button type="button" className="rr-text-action" onClick={() => setTab("projects")}>Browse projects <ArrowRight size={15}/></button></div>
            {projects.length ? <div className="rr-ops-project-cards">{projects.slice(0, 4).map((project) => {
              const customer = customers.find((item) => item.id === project.customerId);
              return <button className="rr-ops-project-card" type="button" key={project.id} onClick={() => { setSelectedProjectId(project.id); setTab("projects"); }}><span className="rr-ops-project-code">{project.projectCode}</span><b>{project.title}</b><small>{customer?.name || "Customer review pending"}</small><span className={"rr-ops-stage-chip stage-" + project.stage}>{PROJECT_STAGE_LABELS[project.stage]}</span><span className="rr-ops-card-next">{project.nextAction || "Choose next action"} <ArrowRight size={14}/></span></button>;
            })}</div> : <div className="rr-ops-empty"><FolderKanban size={24}/><b>No projects created yet</b><span>Open Leads to convert to make the first Project Passport from a CRM lead.</span><button type="button" className="rr-primary" onClick={() => setTab("leads")}>Review leads <ArrowRight size={15}/></button></div>}
          </section>
        </>
      )}

      {data && tab === "projects" && (
        <>
          <div className="rr-ops-workspace-grid">
            <section className="rr-panel rr-ops-project-list">
              <div className="rr-panel-heading"><div><h2>Project register</h2><p>{projects.length} Project Passport{projects.length === 1 ? "" : "s"}</p></div></div>
              <input className="rr-ops-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search project, customer or address…" aria-label="Search projects"/>
              {filteredProjects.length ? filteredProjects.map((project) => {
                const customer = customers.find((item) => item.id === project.customerId);
                return <button key={project.id} type="button" className={"rr-ops-project-row " + (selectedProjectId === project.id ? "selected" : "")} onClick={() => setSelectedProjectId(project.id)}><div><b>{project.title}</b><small>{project.projectCode} · {customer?.name || "Unlinked customer"}</small><span className={"rr-ops-stage-chip stage-" + project.stage}>{PROJECT_STAGE_LABELS[project.stage]}</span></div><ChevronDown size={16}/></button>;
              }) : <div className="rr-ops-empty"><FolderKanban size={22}/><b>No matching projects</b><span>Convert a CRM lead or create a project from a customer.</span></div>}
            </section>
            <div className="rr-ops-project-detail">
              {!selectedProject ? <section className="rr-panel rr-ops-empty"><FolderKanban size={28}/><b>Select a project</b><span>Each project has one record, linked customer, gated stage, document history and task list.</span></section> : (() => {
                const customer = customers.find((item) => item.id === selectedProject.customerId);
                const projectTasksForSelected = tasks.filter((task) => task.projectId === selectedProject.id);
                const nextStages = selectedProject.stage === "on-hold" ? [selectedProject.previousStage].filter(Boolean) as ProjectStage[] : PROJECT_STAGES.filter((stage) => stage !== "on-hold" && stage !== selectedProject.stage && PROJECT_STAGES.filter((item) => item !== "on-hold").indexOf(stage) === PROJECT_STAGES.filter((item) => item !== "on-hold").indexOf(selectedProject.stage) + 1);
                return <section className="rr-panel rr-ops-detail-panel">
                  <div className="rr-ops-detail-top"><div><span className="rr-eyebrow">{selectedProject.projectCode} · PROJECT PASSPORT</span><h2>{selectedProject.title}</h2><p>{customer?.name || "Customer identity needs review"}{selectedProject.serviceType ? " · " + selectedProject.serviceType : ""}</p></div><span className={"rr-ops-stage-chip stage-" + selectedProject.stage}>{PROJECT_STAGE_LABELS[selectedProject.stage]}</span></div>
                  {customer?.identityReviewRequired && <div className="rr-ops-alert is-warning"><AlertTriangle size={16}/><span>Customer identity needs review: {customer.identityReviewReason}</span></div>}
                  <div className="rr-ops-detail-fields">
                    <label>Project title<input value={selectedProject.title} onChange={(event) => void updateProjectField("title", event.target.value)} onBlur={() => {}} disabled={busy}/></label>
                    <label>Service type<input value={selectedProject.serviceType} onChange={(event) => { const v = event.target.value; setData((current) => current ? { ...current, bundle: { ...current.bundle, projects: current.bundle.projects.map((p) => p.id === selectedProject.id ? { ...p, serviceType: v } : p) } } : current); }} onBlur={(event) => void updateProjectField("serviceType", event.target.value)} disabled={busy}/></label>
                    <label className="wide">Property address<input value={selectedProject.propertyAddress} onChange={(event) => { const v = event.target.value; setData((current) => current ? { ...current, bundle: { ...current.bundle, projects: current.bundle.projects.map((p) => p.id === selectedProject.id ? { ...p, propertyAddress: v } : p) } } : current); }} onBlur={(event) => void updateProjectField("propertyAddress", event.target.value)} disabled={busy}/></label>
                    <label>Apartment / unit<input value={selectedProject.apartmentNumber} onChange={(event) => { const v = event.target.value; setData((current) => current ? { ...current, bundle: { ...current.bundle, projects: current.bundle.projects.map((p) => p.id === selectedProject.id ? { ...p, apartmentNumber: v } : p) } } : current); }} onBlur={(event) => void updateProjectField("apartmentNumber", event.target.value)} disabled={busy}/></label>
                    <label>Floor<input value={selectedProject.floorNumber} onChange={(event) => { const v = event.target.value; setData((current) => current ? { ...current, bundle: { ...current.bundle, projects: current.bundle.projects.map((p) => p.id === selectedProject.id ? { ...p, floorNumber: v } : p) } } : current); }} onBlur={(event) => void updateProjectField("floorNumber", event.target.value)} disabled={busy}/></label>
                    <label>Approx. area<input value={selectedProject.approximateArea} onChange={(event) => { const v = event.target.value; setData((current) => current ? { ...current, bundle: { ...current.bundle, projects: current.bundle.projects.map((p) => p.id === selectedProject.id ? { ...p, approximateArea: v } : p) } } : current); }} onBlur={(event) => void updateProjectField("approximateArea", event.target.value)} disabled={busy}/></label>
                    <label>Target handover<input type="date" value={selectedProject.targetHandoverDate} onChange={(event) => { const v = event.target.value; setData((current) => current ? { ...current, bundle: { ...current.bundle, projects: current.bundle.projects.map((p) => p.id === selectedProject.id ? { ...p, targetHandoverDate: v } : p) } } : current); }} onBlur={(event) => void updateProjectField("targetHandoverDate", event.target.value)} disabled={busy}/></label>
                  </div>
                  <div className="rr-ops-detail-next"><div><span>NEXT ACTION</span><b>{selectedProject.nextAction || "No next action set"}</b></div><div><span>CREATED</span><b>{dateLabel(selectedProject.createdAt)}</b></div></div>
                  <div className="rr-ops-transition">
                    <div><span className="rr-eyebrow">STAGE GATE</span><p>Choose the next stage. RR will validate evidence and explain any blockers before the status changes.</p></div>
                    <div className="rr-ops-transition-actions"><select key={selectedProject.id} id="rr-ops-stage-target" defaultValue={nextStages[0] || ""} disabled={!nextStages.length || busy}><option value="">Choose next stage</option>{nextStages.map((stage) => <option key={stage} value={stage}>{PROJECT_STAGE_LABELS[stage]}</option>)}{selectedProject.stage !== "complete" && selectedProject.stage !== "on-hold" && <option value="on-hold">On hold</option>}</select><button type="button" className="rr-primary" disabled={busy} onClick={() => { const select = document.getElementById("rr-ops-stage-target") as HTMLSelectElement | null; if (select?.value) void moveStage(select.value as ProjectStage); }}>Check & move <ArrowRight size={15}/></button></div>
                  </div>
                  <div className="rr-ops-subsection-head"><div><h3>Project tasks</h3><p>{projectTasksForSelected.filter((task) => !["done","cancelled"].includes(task.status)).length} open of {projectTasksForSelected.length}</p></div><button type="button" className="rr-secondary" onClick={() => setNewTaskOpen((open) => !open)}><Plus size={15}/> Add task</button></div>
                  {newTaskOpen && <form className="rr-ops-task-form" onSubmit={saveTask}>
                    <label>Task title<input required value={taskForm.title} onChange={(event) => setTaskForm((current) => ({ ...current, title: event.target.value }))}/></label>
                    <div className="rr-ops-inline-fields"><label>Category<select value={taskForm.category} onChange={(event) => setTaskForm((current) => ({ ...current, category: event.target.value }))}>{["booking","design","procurement","production","quality","dispatch","site-readiness","installation","snag","handover","warranty","finance","communication","admin"].map((value) => <option key={value} value={value}>{value.replaceAll("-"," ")}</option>)}</select></label><label>Due date<input type="date" value={taskForm.dueDate} onChange={(event) => setTaskForm((current) => ({ ...current, dueDate: event.target.value }))}/></label></div>
                    <label>Description<textarea rows={2} value={taskForm.description} onChange={(event) => setTaskForm((current) => ({ ...current, description: event.target.value }))}/></label>
                    <div><button type="submit" className="rr-primary" disabled={busy || !taskForm.title.trim()}>{busy ? "Saving…" : "Create task"}</button> <button type="button" className="rr-secondary" onClick={() => setNewTaskOpen(false)}>Cancel</button></div>
                  </form>}
                  <div className="rr-ops-task-list">{projectTasksForSelected.length ? projectTasksForSelected.map((task) => <div key={task.id} className={"rr-ops-task-row " + (task.status === "done" ? "is-done" : "")}><div className="rr-ops-task-icon">{task.status === "done" ? <Check size={15}/> : <ListTodo size={15}/>}</div><div className="rr-ops-task-copy"><b>{task.title}</b><small>{task.category.replaceAll("-"," ")} · {task.dueDate ? dateLabel(task.dueDate) : "No due date"}{task.owner ? " · " + task.owner : ""}</small>{task.blockerReason && <small className="is-alert">{task.blockerReason}</small>}</div><select value={task.status} disabled={busy} onChange={(event) => void setTaskStatus(task, event.target.value as OpsTask["status"])} aria-label={"Status for " + task.title}><option value="open">Open</option><option value="in-progress">In progress</option><option value="blocked">Blocked</option><option value="done">Done</option><option value="cancelled">Cancelled</option></select></div>) : <div className="rr-ops-empty small"><ListTodo size={20}/><b>No tasks yet</b><span>Use the task action to assign the next physical or admin step.</span></div>}</div>
                  <div className="rr-ops-detail-foot"><span><Activity size={14}/> Stable project ID: {selectedProject.id}</span><span>{selectedProject.sourceLeadId ? "Linked to CRM lead " + selectedProject.sourceLeadId : "Manually created project"}</span></div>
                </section>;
              })()}
            </div>
          </div>
        </>
      )}

      {data && tab === "leads" && (
        <section className="rr-panel rr-ops-lead-inbox">
          <div className="rr-panel-heading"><div><h2>Leads ready to become projects</h2><p>Conversion makes one Project Passport linked to the existing CRM lead. Repeated clicks return the same project rather than creating a duplicate.</p></div><span className="rr-ops-count">{leadsNotConverted.length} not converted</span></div>
          {leadsNotConverted.length ? <div className="rr-ops-lead-list">{leadsNotConverted.map((lead) => {
            const leadId = safeText(lead.id);
            return <article key={leadId} className="rr-ops-lead-row"><div className="rr-ops-lead-avatar"><UserRound size={18}/></div><div className="rr-ops-lead-main"><b>{safeText(lead.name) || "Unnamed lead"}</b><small>{leadId} · {safeText(lead.phone) || safeText(lead.email) || "No contact"} · {safeText(lead.source) || "Manual lead"}</small><p>{safeText(lead.project) || safeText(lead.serviceType) || "Project requirements to confirm"}</p></div><span className="rr-ops-stage-chip stage-booking">Sales: {safeText(lead.status) || "New enquiry"}</span><button type="button" className="rr-primary" onClick={() => void convertLead(lead)} disabled={busy}>{busy ? "Working…" : "Create project"} <ArrowRight size={15}/></button></article>;
          })}</div> : <div className="rr-ops-empty"><BadgeCheck size={27}/><b>Every current lead has a Project Passport</b><span>New leads will appear here automatically. A lead and the delivery project remain separate, linked records.</span></div>}
          <div className="rr-ops-inline-note"><ShieldCheck size={17}/><span>Contact matches use phone/email. Name alone never merges people. If identifiers conflict, RR creates a separate customer record flagged for review.</span></div>
        </section>
      )}

      {data && tab === "tasks" && (
        <section className="rr-panel rr-ops-all-tasks">
          <div className="rr-panel-heading"><div><h2>Tasks & follow-ups</h2><p>All project actions, sorted by due date first.</p></div><span className="rr-ops-count">{openTasks.length} open</span></div>
          {tasks.length ? <div className="rr-ops-task-list">{[...tasks].sort((a, b) => (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31")).map((task) => {
            const project = projects.find((item) => item.id === task.projectId);
            return <div key={task.id} className={"rr-ops-task-row " + (task.status === "done" ? "is-done" : "")}><div className="rr-ops-task-icon">{task.status === "done" ? <Check size={15}/> : <ListTodo size={15}/>}</div><div className="rr-ops-task-copy"><b>{task.title}</b><small>{project?.projectCode || "Project"} · {task.category.replaceAll("-"," ")} · {task.dueDate ? dateLabel(task.dueDate) : "No due date"}</small></div><select value={task.status} disabled={busy} onChange={(event) => void setTaskStatus(task, event.target.value as OpsTask["status"])} aria-label={"Status for " + task.title}><option value="open">Open</option><option value="in-progress">In progress</option><option value="blocked">Blocked</option><option value="done">Done</option><option value="cancelled">Cancelled</option></select></div>;
          })}</div> : <div className="rr-ops-empty"><ListTodo size={25}/><b>No tasks yet</b><span>Tasks are automatically created when a lead becomes a project.</span></div>}
        </section>
      )}

      {data && tab === "phase0" && (
        <>
          <section className="rr-ops-phase0-banner"><div className="rr-ops-phase0-icon"><ShieldCheck size={21}/></div><div><b>Commercial policies start unapproved by design</b><p>RR will not issue a tax/contract/warranty document or pass a gate that depends on an unapproved business rule. Fill this checklist only after the source templates are corrected and the CA/legal decisions are confirmed.</p></div></section>
          <section className="rr-panel">
            <div className="rr-panel-heading"><div><h2>Phase 0: rules that control automation</h2><p>{phase0Checklist.filter((item) => item.complete).length} of {phase0Checklist.length} approval groups configured.</p></div></div>
            <div className="rr-ops-phase0-list">{phase0Checklist.map((item, index) => <div key={item.key} className="rr-ops-phase0-row"><span className={"rr-ops-phase0-number " + (item.complete ? "is-done" : "")}>{item.complete ? <Check size={14}/> : String(index + 1).padStart(2,"0")}</span><div><b>{item.label}</b><small>{item.detail}</small></div><span className={"rr-ops-review-status " + (item.complete ? "complete" : "pending")}>{item.complete ? "Approved" : "Needs review"}</span></div>)}</div>
            <div className="rr-ops-inline-note"><AlertTriangle size={17}/><span>Do not mark an item approved merely to bypass a gate. The Phase 0 setup form will require the values, evidence/version and approver before an approval can be saved.</span></div>
          </section>
        </>
      )}

      {createCustomerOpen && <div className="rr-ops-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCreateCustomerOpen(false); }}><section className="rr-ops-modal"><header><div><span className="rr-eyebrow">CUSTOMER MASTER</span><h2>Create customer</h2></div><button type="button" onClick={() => setCreateCustomerOpen(false)} aria-label="Close"><X size={18}/></button></header><form onSubmit={saveCustomer}><label>Name / organisation<input required value={customerForm.name} onChange={(event) => setCustomerForm((current) => ({ ...current, name: event.target.value }))}/></label><div className="rr-ops-inline-fields"><label>Email<input type="email" value={customerForm.email} onChange={(event) => setCustomerForm((current) => ({ ...current, email: event.target.value }))}/></label><label>Phone<input value={customerForm.phone} onChange={(event) => setCustomerForm((current) => ({ ...current, phone: event.target.value }))}/></label></div><label>Billing address<textarea rows={2} value={customerForm.billingAddress} onChange={(event) => setCustomerForm((current) => ({ ...current, billingAddress: event.target.value }))}/></label><p>Phone/email identify a possible match. Names are never used alone; conflicting contacts are flagged for review rather than silently merged.</p><footer><button className="rr-secondary" type="button" onClick={() => setCreateCustomerOpen(false)}>Cancel</button><button className="rr-primary" type="submit" disabled={busy}>{busy ? "Saving…" : "Save customer"}</button></footer></form></section></div>}

      {createProjectOpen && <div className="rr-ops-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCreateProjectOpen(false); }}><section className="rr-ops-modal"><header><div><span className="rr-eyebrow">PROJECT PASSPORT</span><h2>Create a new project</h2></div><button type="button" onClick={() => setCreateProjectOpen(false)} aria-label="Close"><X size={18}/></button></header><form onSubmit={saveProject}><label>Customer<select required value={projectForm.customerId} onChange={(event) => setProjectForm((current) => ({ ...current, customerId: event.target.value }))}><option value="">Choose a customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name} · {customer.phones[0] || customer.emails[0] || "Contact pending"}</option>)}</select></label>{!customers.length && <p>Create a customer before creating a project.</p>}<label>Project name<input required value={projectForm.title} onChange={(event) => setProjectForm((current) => ({ ...current, title: event.target.value }))} placeholder="e.g. Lakshmi · Merit Elite"/></label><label>Service type<select value={projectForm.serviceType} onChange={(event) => setProjectForm((current) => ({ ...current, serviceType: event.target.value }))}><option value="">Choose a service</option>{["Residential turnkey","Commercial","Renovation","Design-only","Modular","Furniture"].map((service) => <option key={service}>{service}</option>)}</select></label><label>Property address<textarea rows={2} value={projectForm.propertyAddress} onChange={(event) => setProjectForm((current) => ({ ...current, propertyAddress: event.target.value }))}/></label><div className="rr-ops-inline-fields"><label>Apartment / unit<input value={projectForm.apartmentNumber} onChange={(event) => setProjectForm((current) => ({ ...current, apartmentNumber: event.target.value }))}/></label><label>Floor<input value={projectForm.floorNumber} onChange={(event) => setProjectForm((current) => ({ ...current, floorNumber: event.target.value }))}/></label></div><div className="rr-ops-inline-fields"><label>Approx. area<input value={projectForm.approximateArea} onChange={(event) => setProjectForm((current) => ({ ...current, approximateArea: event.target.value }))}/></label><label>Target handover<input type="date" value={projectForm.targetHandoverDate} onChange={(event) => setProjectForm((current) => ({ ...current, targetHandoverDate: event.target.value }))}/></label></div><footer><button className="rr-secondary" type="button" onClick={() => setCreateProjectOpen(false)}>Cancel</button><button className="rr-primary" type="submit" disabled={busy || !projectForm.customerId || !projectForm.title.trim()}>{busy ? "Creating…" : "Create Project Passport"}</button></footer></form></section></div>}

      {data && <div className="rr-ops-bottom-bar"><span><ShieldCheck size={14}/> Encrypted operations records · auditable stage changes</span><span>Updated {new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span></div>}
    </section>
  );
}
