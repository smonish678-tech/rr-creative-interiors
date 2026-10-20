 "use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, CircleAlert, RefreshCw, ShieldCheck } from "lucide-react";

type Row = Record<string, unknown>;
type Health = { ready?: boolean; message?: string };
const tabs = ["Today","Customers","Projects","Documents","Tasks","Production","Warranty","Reports"] as const;
type Tab = (typeof tabs)[number];
const text = (r: Row, k: string) => String(r[k] ?? "");
const date = (v: unknown) => v ? new Date(String(v)).toLocaleDateString("en-IN") : "—";

export default function OperationsPage() {
  const [tab,setTab]=useState<Tab>("Today");
  const [health,setHealth]=useState<Health|null>(null);
  const [customers,setCustomers]=useState<Row[]>([]);
  const [projects,setProjects]=useState<Row[]>([]);
  const [documents,setDocuments]=useState<Row[]>([]);
  const [tasks,setTasks]=useState<Row[]>([]);
  const [selectedCustomer,setSelectedCustomer]=useState("");
  const [selectedProject,setSelectedProject]=useState("");
  const [reports,setReports]=useState<Row|null>(null);
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);

  const api=useCallback(async (url:string, init?:RequestInit) => {
    const response=await fetch(url,{...init,cache:"no-store",headers:{"Content-Type":"application/json",...(init?.headers||{})}});
    const data=await response.json().catch(()=>({})) as Record<string,unknown>;
    if(!response.ok) throw new Error(String(data.error||"The action could not be completed."));
    return data;
  },[]);

  const refresh=useCallback(async()=>{
    setBusy(true);setError("");
    try{
      const response=await fetch("/api/admin/operations/health",{cache:"no-store"});
      const h=await response.json() as Health;setHealth(h);
      if(!h.ready)return;
      const results=await Promise.all([api("/api/admin/operations/customers"),api("/api/admin/operations/projects"),api("/api/admin/operations/documents"),api("/api/admin/operations/tasks"),api("/api/admin/operations/reports")]);
      const c=Array.isArray(results[0].customers)?results[0].customers as Row[]:[];
      const p=Array.isArray(results[1].projects)?results[1].projects as Row[]:[];
      setCustomers(c);setProjects(p);setDocuments(Array.isArray(results[2].documents)?results[2].documents as Row[]:[]);
      setTasks(Array.isArray(results[3].tasks)?results[3].tasks as Row[]:[]);setReports(results[4]);
      if(!selectedCustomer&&c.length)setSelectedCustomer(text(c[0],"id"));
      if(!selectedProject&&p.length)setSelectedProject(text(p[0],"id"));
    }catch(e){setError(e instanceof Error?e.message:"Could not load operations.");}
    finally{setBusy(false);}
  },[api,selectedCustomer,selectedProject]);
  useEffect(()=>{void refresh();},[refresh]);

  async function act(fn:()=>Promise<unknown>, success:string){
    setBusy(true);setError("");setNotice("");
    try{await fn();setNotice(success);await refresh();}
    catch(e){setError(e instanceof Error?e.message:"Action failed.");}
    finally{setBusy(false);}
  }
  async function submitCustomer(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const fd=new FormData(e.currentTarget);
    await act(()=>api("/api/admin/operations/customers",{method:"POST",body:JSON.stringify({displayName:fd.get("name"),email:fd.get("email"),phone:fd.get("phone"),communicationPreference:fd.get("preference"),notes:fd.get("notes")})}),"Customer saved.");
    e.currentTarget.reset();
  }
  async function submitProject(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const fd=new FormData(e.currentTarget);
    await act(async()=>{const result=await api("/api/admin/operations/projects",{method:"POST",body:JSON.stringify({customerId:fd.get("customerId"),name:fd.get("name"),projectType:fd.get("type"),address:fd.get("address"),apartment:fd.get("apartment"),floor:fd.get("floor")})});setSelectedProject(text((result.project||{}) as Row,"id"));},"Project created and linked to its customer.");
  }
  async function submitDoc(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const fd=new FormData(e.currentTarget);
    await act(()=>api("/api/admin/operations/documents",{method:"POST",body:JSON.stringify({projectId:fd.get("projectId"),kind:fd.get("kind"),title:fd.get("title"),snapshot:{notes:fd.get("notes")}})}),"Document draft saved.");
  }
  async function submitChecklist(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const fd=new FormData(e.currentTarget);
    await act(()=>api("/api/admin/operations/checklists",{method:"POST",body:JSON.stringify({projectId:fd.get("projectId"),phase:fd.get("phase")})}),"Checklist initialised.");
  }
  async function submitTransition(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const fd=new FormData(e.currentTarget);
    await act(()=>api("/api/admin/operations/projects/"+selectedProject+"/transition",{method:"POST",body:JSON.stringify({stage:fd.get("stage"),reason:fd.get("reason")})}),"Stage transition passed the server checks.");
  }
  async function backup(){
    setBusy(true);setError("");setNotice("");
    try{const response=await fetch("/api/admin/operations/backup",{cache:"no-store"});if(!response.ok){const d=await response.json().catch(()=>({}));throw new Error(String(d.error||"Backup export failed."));}
      const blob=await response.blob();const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="rr-operations-backup.json";a.click();URL.revokeObjectURL(url);setNotice("Backup exported. Store it privately and rehearse recovery against a separate database.");
    }catch(e){setError(e instanceof Error?e.message:"Backup export failed.");}finally{setBusy(false);}
  }

  const ready=health?.ready===true;
  const selected=projects.find(p=>text(p,"id")===selectedProject);
  const field={display:"grid",gap:6,fontSize:12,color:"#6e6255"} as const;
  const input={width:"100%",boxSizing:"border-box" as const,padding:"11px 12px",border:"1px solid #e1d8c9",background:"#fffdf9",color:"#2c261f",fontSize:13};
  const button={padding:"11px 15px",background:"#30281f",color:"#fff",border:0,cursor:"pointer",fontSize:12};
  const panel={background:"#fff",border:"1px solid #e7dfd3",padding:22,minWidth:0} as const;
  const form={display:"grid",gap:14} as const;
  return <main style={{minHeight:"100vh",background:"#f6f3ed",color:"#2d261f",fontFamily:"Arial,sans-serif"}}>
    <header style={{height:72,background:"#fff",borderBottom:"1px solid #e7dfd3",display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 clamp(14px,4vw,52px)",gap:16}}>
      <Link href="/admin" style={{display:"flex",alignItems:"center",gap:8,color:"#6c6053",textDecoration:"none",fontSize:12}}><ArrowLeft size={16}/> Admin</Link>
      <div style={{display:"flex",alignItems:"center",gap:12}}><b style={{fontFamily:"Georgia,serif",letterSpacing:1}}>RR CREATIVE INTERIORS</b><span style={{fontSize:9,letterSpacing:1.5,color:"#9b7945"}}>PROJECT PASSPORT</span></div>
      <button style={{...button,display:"flex",gap:8,alignItems:"center"}} disabled={busy} onClick={()=>void refresh()}><RefreshCw size={14}/> Refresh</button>
    </header>
    <div style={{maxWidth:1320,margin:"auto",padding:"34px clamp(14px,4vw,50px) 60px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end",gap:20,flexWrap:"wrap",marginBottom:24}}>
        <div><div style={{fontSize:10,letterSpacing:2,color:"#987542"}}>ONE PROJECT · ONE SOURCE OF TRUTH</div><h1 style={{font:"400 clamp(30px,4vw,46px) Georgia",margin:"12px 0 8px"}}>Good work moves forward.</h1><p style={{fontSize:13,color:"#766a5d",margin:0}}>Customers, approvals, payments, production and aftercare—connected to one record.</p></div>
        <div style={{display:"flex",alignItems:"center",gap:8,padding:"11px 14px",border:"1px solid "+(ready?"#d6e7d7":"#f0ddbd"),background:ready?"#eff7ef":"#fff7e9",color:ready?"#315d40":"#9a5b24",fontSize:12}}>{ready?<CheckCircle2 size={16}/>:<CircleAlert size={16}/>} {health?.message||"Checking database…"}</div>
      </div>
      {notice&&<div style={{padding:12,marginBottom:12,background:"#eff7ef",color:"#315d40",fontSize:13}}>{notice}</div>}
      {error&&<div role="alert" style={{padding:12,marginBottom:12,background:"#fff1ed",color:"#922d22",fontSize:13}}>{error}</div>}
      {!ready&&<section style={{...panel,display:"grid",gridTemplateColumns:"40px 1fr",gap:16,marginBottom:22}}><ShieldCheck size={28} color="#987542"/><div><h2 style={{font:"400 22px Georgia",margin:"0 0 8px"}}>Connect the operations database before using real customer data.</h2><p style={{fontSize:13,color:"#766a5d"}}>{health?.message||"The database is not configured."}</p><ol style={{fontSize:13,lineHeight:1.8,color:"#766a5d"}}><li>Create a Neon PostgreSQL database.</li><li>Set DATABASE_URL in Vercel Preview environment variables.</li><li>Run db/migrations/001_operations.sql and db/migrations/002_website_leads.sql in the database SQL editor.</li><li>Refresh and confirm database readiness before entering customer or financial data.</li></ol><b style={{fontSize:12,color:"#9b3e29"}}>No operational records can be saved until this setup is complete. Demo CRM data is not imported automatically.</b></div></section>}
      <nav style={{display:"flex",gap:4,overflowX:"auto",borderBottom:"1px solid #dfd6c9",marginBottom:22}}>{tabs.map(t=><button key={t} onClick={()=>setTab(t)} style={{padding:"13px 15px",background:"transparent",border:0,borderBottom:tab===t?"2px solid #a17b3e":"2px solid transparent",color:tab===t?"#33281c":"#75695c",whiteSpace:"nowrap",cursor:"pointer",fontWeight:tab===t?700:400,fontSize:12}}>{t}</button>)}</nav>
      {ready&&tab==="Today"&&<><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12,marginBottom:18}}>{[["Customers",customers.length],["Projects",projects.length],["Open tasks",tasks.length],["Documents",documents.length]].map(([label,count])=><div key={String(label)} style={{...panel,padding:18}}><div style={{fontSize:12,color:"#766a5d"}}>{label}</div><div style={{font:"400 28px Georgia",marginTop:8}}>{count}</div></div>)}</div><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:16}}><section style={panel}><h2 style={{font:"400 22px Georgia",marginTop:0}}>Projects in motion</h2>{projects.map(p=><div key={text(p,"id")} style={{padding:"13px 0",borderTop:"1px solid #f0ebe3"}}><b style={{fontSize:13}}>{text(p,"name")}</b><p style={{fontSize:11,color:"#877b6d"}}>{text(p,"project_code")} · {text(p,"customer_name")} · {text(p,"stage").replaceAll("_"," ")}</p></div>)}{!projects.length&&<p style={{fontSize:13,color:"#766a5d"}}>Create a customer, then create their first Project Passport.</p>}</section><section style={panel}><h2 style={{font:"400 22px Georgia",marginTop:0}}>Next actions</h2>{tasks.slice(0,12).map(t=><div key={text(t,"id")} style={{padding:"13px 0",borderTop:"1px solid #f0ebe3"}}><b style={{fontSize:13}}>{text(t,"title")}</b><p style={{fontSize:11,color:"#877b6d"}}>{text(t,"customer_name")||"Workspace"} · due {date(t.due_at)} · {text(t,"status")}</p></div>)}{!tasks.length&&<p style={{fontSize:13,color:"#766a5d"}}>Website enquiries create follow-up tasks automatically.</p>}</section></div></>}
      {ready&&tab==="Customers"&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:16}}><section style={panel}><h2 style={{font:"400 22px Georgia",marginTop:0}}>New customer</h2><form style={form} onSubmit={submitCustomer}><label style={field}>Full name<input style={input} name="name" required minLength={2}/></label><label style={field}>Email<input style={input} name="email" type="email"/></label><label style={field}>Phone<input style={input} name="phone" type="tel"/></label><label style={field}>Preferred contact<select style={input} name="preference"><option value="whatsapp">WhatsApp</option><option value="email">Email</option><option value="phone">Phone</option><option value="none">No contact</option></select></label><label style={field}>Notes<textarea style={input} name="notes" rows={3}/></label><button style={button} disabled={busy}>Save customer</button></form></section><section style={panel}><h2 style={{font:"400 22px Georgia",marginTop:0}}>Customer register</h2>{customers.map(c=><button key={text(c,"id")} onClick={()=>setSelectedCustomer(text(c,"id"))} style={{display:"block",width:"100%",padding:"13px 0",textAlign:"left",border:0,borderTop:"1px solid #f0ebe3",background:"transparent",cursor:"pointer"}}><b style={{display:"block",fontSize:13}}>{text(c,"display_name")}</b><small style={{color:"#877b6d"}}>{text(c,"primary_email")||text(c,"primary_phone")||"No contact detail"} · {String(c.project_count||0)} projects</small></button>)}</section></div>}
      {ready&&tab==="Projects"&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:16}}><section style={panel}><h2 style={{font:"400 22px Georgia",marginTop:0}}>Create Project Passport</h2><form style={form} onSubmit={submitProject}><label style={field}>Customer<select style={input} name="customerId" required value={selectedCustomer} onChange={e=>setSelectedCustomer(e.target.value)}><option value="">Select customer</option>{customers.map(c=><option key={text(c,"id")} value={text(c,"id")}>{text(c,"display_name")}</option>)}</select></label><label style={field}>Project name<input style={input} name="name" required placeholder="3 BHK home interiors"/></label><label style={field}>Type<select style={input} name="type"><option value="residential">Residential</option><option value="commercial">Commercial</option><option value="renovation">Renovation</option><option value="other">Other</option></select></label><label style={field}>Address<input style={input} name="address"/></label><label style={field}>Apartment / unit<input style={input} name="apartment"/></label><label style={field}>Floor<input style={input} name="floor"/></label><button style={button} disabled={busy||!customers.length}>Create project</button></form></section><section style={panel}><h2 style={{font:"400 22px Georgia",marginTop:0}}>Stage gates</h2><label style={field}>Project<select style={input} value={selectedProject} onChange={e=>setSelectedProject(e.target.value)}><option value="">Select project</option>{projects.map(p=><option key={text(p,"id")} value={text(p,"id")}>{text(p,"project_code")} · {text(p,"name")}</option>)}</select></label>{selected&&<><p style={{fontSize:13,color:"#766a5d"}}>Current stage: <b>{text(selected,"stage").replaceAll("_"," ")}</b></p><form style={form} onSubmit={submitTransition}><label style={field}>Move to stage<select style={input} name="stage" defaultValue={text(selected,"stage")}>{["booking","design","design_approval","contract","production_ready","production","quality_check","dispatch","installation","handover","warranty","closed","on_hold","cancelled"].map(s=><option key={s} value={s}>{s.replaceAll("_"," ")}</option>)}</select></label><label style={field}>Reason for hold/cancellation<textarea style={input} name="reason" rows={2}/></label><button style={button} disabled={busy}>Validate & transition</button></form></>}</section></div>}
      {ready&&tab==="Documents"&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:16}}><section style={panel}><h2 style={{font:"400 22px Georgia",marginTop:0}}>Generate draft</h2><form style={form} onSubmit={submitDoc}><label style={field}>Project<select style={input} name="projectId" required value={selectedProject} onChange={e=>setSelectedProject(e.target.value)}><option value="">Select project</option>{projects.map(p=><option key={text(p,"id")} value={text(p,"id")}>{text(p,"project_code")} · {text(p,"name")}</option>)}</select></label><label style={field}>Document type<select style={input} name="kind">{["initial_quote","booking_form","design_approval","final_quote","works_contract","change_order","payment_request","payment_receipt","tax_invoice","handover_pack","warranty_certificate"].map(k=><option key={k} value={k}>{k.replaceAll("_"," ")}</option>)}</select></label><label style={field}>Title<input style={input} name="title" required/></label><label style={field}>Scope / notes<textarea style={input} name="notes" rows={3}/></label><button style={button} disabled={busy||!projects.length}>Save draft</button></form><p style={{fontSize:11,color:"#877b6d"}}>Drafts are versioned and printable. Legal/tax wording must be approved before issue.</p></section><section style={panel}><h2 style={{font:"400 22px Georgia",marginTop:0}}>Document register</h2>{documents.map(d=><div key={text(d,"id")} style={{display:"flex",justifyContent:"space-between",gap:10,padding:"13px 0",borderTop:"1px solid #f0ebe3"}}><div><b style={{fontSize:13}}>{text(d,"title")}</b><small style={{display:"block",fontSize:11,color:"#877b6d"}}>{text(d,"document_number")} · {text(d,"status")}</small></div><a href={"/api/admin/operations/documents/"+text(d,"id")+"/print"} target="_blank" rel="noreferrer" style={{fontSize:11,color:"#7e5c2c"}}>Open</a></div>)}</section></div>}
      {ready&&tab==="Tasks"&&<section style={panel}><h2 style={{font:"400 22px Georgia",marginTop:0}}>Action queue</h2>{tasks.map(t=><div key={text(t,"id")} style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,padding:"13px 0",borderTop:"1px solid #f0ebe3"}}><div><b style={{fontSize:13}}>{text(t,"title")}</b><small style={{display:"block",color:"#877b6d",marginTop:4}}>{text(t,"customer_name")||"Workspace"} · due {date(t.due_at)}</small></div><select style={input} aria-label={"Task status "+text(t,"title")} value={text(t,"status")} onChange={e=>void act(()=>api("/api/admin/operations/tasks",{method:"PATCH",body:JSON.stringify({id:text(t,"id"),status:e.target.value,blockedReason:e.target.value==="blocked"?"Needs a blocker reason":""})}),"Task status saved.")}><option value="open">Open</option><option value="in_progress">In progress</option><option value="blocked">Blocked</option><option value="done">Done</option><option value="cancelled">Cancelled</option></select></div>)}</section>}
      {ready&&tab==="Production"&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:16}}><section style={panel}><h2 style={{font:"400 22px Georgia",marginTop:0}}>Create checklist</h2><form style={form} onSubmit={submitChecklist}><label style={field}>Project<select style={input} name="projectId" required value={selectedProject} onChange={e=>setSelectedProject(e.target.value)}><option value="">Select project</option>{projects.map(p=><option key={text(p,"id")} value={text(p,"id")}>{text(p,"project_code")} · {text(p,"name")}</option>)}</select></label><label style={field}>Phase<select style={input} name="phase">{["procurement","production","quality","dispatch","site_readiness","installation","snag","handover"].map(p=><option key={p} value={p}>{p.replaceAll("_"," ")}</option>)}</select></label><button style={button} disabled={busy||!projects.length}>Initialise checklist</button></form></section><section style={panel}><h2 style={{font:"400 22px Georgia",marginTop:0}}>Gate rule</h2><p style={{fontSize:13,lineHeight:1.7,color:"#766a5d"}}>Required procurement, quality, dispatch, site-readiness, installation, snag and handover checks are stored per project. A stage transition is blocked until its evidence checks are complete.</p></section></div>}
      {ready&&tab==="Warranty"&&<section style={panel}><h2 style={{font:"400 22px Georgia",marginTop:0}}>Warranty register & claims</h2><p style={{fontSize:13,lineHeight:1.7,color:"#766a5d"}}>Warranty registration requires an approved policy version, explicit coverage dates and a signed handover record. Claims require an active warranty and automatically create a triage task.</p><button style={button} onClick={()=>window.open("/api/admin/operations/warranties","_blank")}>View warranty records</button> <button style={button} onClick={()=>window.open("/api/admin/operations/warranty-claims","_blank")}>View claims</button></section>}
      {ready&&tab==="Reports"&&<section style={panel}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:12,flexWrap:"wrap"}}><h2 style={{font:"400 22px Georgia",margin:0}}>Reports & recovery</h2><button style={button} onClick={()=>void backup()} disabled={busy}>Export backup JSON</button></div><pre style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere",fontSize:11,lineHeight:1.6,background:"#f8f5ef",padding:14,maxHeight:500,overflow:"auto"}}>{JSON.stringify(reports,null,2)}</pre><p style={{fontSize:11,color:"#877b6d"}}>Backup includes private customer, finance and warranty data. Store it with restricted access. Restore endpoint is validation-only; rehearse recovery on a separate database before production.</p></section>}
      {ready&&<p style={{display:"flex",alignItems:"center",gap:8,marginTop:22,fontSize:11,color:"#877b6d"}}><ShieldCheck size={15}/> Persistent records are saved to PostgreSQL. Payment verification, signatures and customer communications still require the real-world evidence event.</p>}
    </div>
  </main>;
}
