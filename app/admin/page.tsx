"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import Image from "next/image";
import PortfolioManager from "@/components/admin/portfolio-manager";
import PipelineConfigurator from "@/components/admin/pipeline-configurator";
import { DEFAULT_SALES_PIPELINE, PIPELINE_FIELD_OPTIONS, normalizeSalesPipeline, type PipelineAutomationTrigger, type PipelineField, type SalesPipelineStage } from "@/lib/sales-pipeline";
import { normalizeCustomerEmail, normalizeCustomerPhone, resolveCustomerIdentity, type CustomerRecord } from "@/lib/customer-matching";
import { ArrowLeft, Bell, CalendarDays, Check, ChevronDown, ClipboardList, Download, FileText, Filter, LayoutDashboard, LogOut, Mail, Plus, Search, Settings, Users, Wallet, X, FolderOpen, SlidersHorizontal } from "lucide-react";

type Stage = string;
type AgreementStatus = "not-started" | "sent" | "signed";
type AdvanceStatus = "not-requested" | "due" | "received" | "waived";
type Lead = {
  id:string; clientId?:string; name:string; email:string; phone:string; project:string; source:string; budget:string; status:Stage; date:string; notes:string;
  stageId?:string; serviceType?:string; location?:string; area?:string; timeline?:string; nextAction?:string; nextFollowUpDate?:string;
  lostReason?:string; agreementStatus?:AgreementStatus; advanceStatus?:AdvanceStatus; advanceExceptionReason?:string;
};
type Invoice = { id:string; clientId?:string; leadId?:string; appliesToInvoiceId?:string; client:string; email:string; phone?:string; project:string; date:string; due:string; description:string; amount:number; tax:number; paid:number; type:"Invoice"|"Cash receipt"; status:"Draft"|"Partially paid"|"Paid" };

function localDateValue(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateAfterDays(days: number | null): string {
  if (days === null) return "";
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return localDateValue(date);
}

function stageForLead(lead: Lead, pipeline: SalesPipelineStage[]): SalesPipelineStage | undefined {
  return pipeline.find((stage) => stage.id === lead.stageId) || pipeline.find((stage) => stage.name === lead.status);
}

function pipelineTone(lead: Lead, pipeline: SalesPipelineStage[]): string {
  return stageForLead(lead, pipeline)?.tone || "stone";
}

function missingPipelineFields(lead: Lead, stage: SalesPipelineStage): PipelineField[] {
  const immutableGateFields: PipelineField[] = stage.kind === "won"
    ? ["agreementSigned", "advanceConfirmed"]
    : stage.kind === "lost" || stage.kind === "disqualified"
      ? ["lostReason"]
      : [];
  const requiredFields = [...new Set([...stage.requiredFields, ...immutableGateFields])];
  return requiredFields.filter((field) => {
    switch (field) {
      case "name": return !lead.name?.trim();
      case "contact": return !(lead.phone?.trim() || lead.email?.trim());
      case "project": return !lead.project?.trim();
      case "serviceType": return !lead.serviceType?.trim();
      case "location": return !lead.location?.trim();
      case "area": return !lead.area?.trim();
      case "budget": return !lead.budget?.trim();
      case "timeline": return !lead.timeline?.trim();
      case "nextAction": return !lead.nextAction?.trim();
      case "email": return !lead.email?.trim();
      case "phone": return !lead.phone?.trim();
      case "notes": return !lead.notes?.trim();
      case "lostReason": return !lead.lostReason?.trim();
      case "agreementSigned": return lead.agreementStatus !== "signed";
      case "advanceConfirmed":
        return lead.advanceStatus !== "received" &&
          !(lead.advanceStatus === "waived" && Boolean(lead.advanceExceptionReason?.trim()));
      default: return false;
    }
  });
}

function fieldLabel(field: PipelineField): string {
  return PIPELINE_FIELD_OPTIONS.find((option) => option.key === field)?.label || field;
}

function createCustomerRecord(id: string, name: string, email: string, phone: string): CustomerRecord {
  const now = new Date().toISOString();
  return { id, name: name.trim(), email: email.trim(), phone: phone.trim(), createdAt: now, updatedAt: now };
}

function customerIdFor(base: string, customers: CustomerRecord[]): string {
  const stem = `CL-${base.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 70) || Date.now().toString()}`;
  if (!customers.some((customer) => customer.id === stem)) return stem;
  let suffix = 2;
  while (customers.some((customer) => customer.id === `${stem}-${suffix}`)) suffix += 1;
  return `${stem}-${suffix}`;
}

function migrateCustomerLinks(rawLeads: Lead[], rawInvoices: Invoice[], savedCustomers: CustomerRecord[]) {
  const customers: CustomerRecord[] = savedCustomers.filter((customer) => customer && typeof customer.id === "string" && typeof customer.name === "string").map((customer) => ({
    ...customer, email: typeof customer.email === "string" ? customer.email : "", phone: typeof customer.phone === "string" ? customer.phone : "",
  }));
  let leads = rawLeads.map((lead) => ({ ...lead }));
  let invoices = rawInvoices.map((invoice) => ({ ...invoice }));
  const customerExists = (id: string | undefined) => Boolean(id && customers.some((customer) => customer.id === id));

  leads = leads.map((lead) => {
    let customer = customerExists(lead.clientId) ? customers.find((item) => item.id === lead.clientId) : undefined;
    if (!customer) {
      const match = resolveCustomerIdentity(customers, lead.email, lead.phone);
      if (match.status === "matched") customer = match.customer;
    }
    if (!customer) {
      const id = customerIdFor(lead.id, customers);
      customer = createCustomerRecord(id, lead.name || "Unnamed customer", lead.email || "", lead.phone || "");
      customers.push(customer);
    } else {
      customer = { ...customer, email: customer.email || lead.email || "", phone: customer.phone || lead.phone || "", updatedAt: new Date().toISOString() };
      const index = customers.findIndex((item) => item.id === customer!.id);
      if (index >= 0) customers[index] = customer;
    }
    return { ...lead, clientId: customer.id, name: customer.name || lead.name, email: customer.email || lead.email || "", phone: customer.phone || lead.phone || "" };
  });

  invoices = invoices.map((invoice) => {
    const linkedLead = leads.find((lead) => lead.id === invoice.leadId);
    let customer = linkedLead ? customers.find((item) => item.id === linkedLead.clientId) : undefined;
    if (!customer && customerExists(invoice.clientId)) customer = customers.find((item) => item.id === invoice.clientId);
    if (!customer) {
      const match = resolveCustomerIdentity(customers, invoice.email, invoice.phone);
      if (match.status === "matched") customer = match.customer;
    }
    if (!customer) {
      const id = customerIdFor(invoice.id, customers);
      customer = createCustomerRecord(id, invoice.client || "Unnamed customer", invoice.email || "", invoice.phone || "");
      customers.push(customer);
    } else {
      customer = { ...customer, email: customer.email || invoice.email || "", phone: customer.phone || invoice.phone || "", updatedAt: new Date().toISOString() };
      const index = customers.findIndex((item) => item.id === customer!.id);
      if (index >= 0) customers[index] = customer;
    }
    let leadId = invoice.leadId || linkedLead?.id;
    if (!leadId) {
      const projectMatches = leads.filter((lead) => lead.clientId === customer!.id && lead.project.trim().toLocaleLowerCase() === (invoice.project || "").trim().toLocaleLowerCase());
      if (projectMatches.length === 1) leadId = projectMatches[0].id;
    }
    return { ...invoice, clientId: customer.id, leadId, client: invoice.client || customer.name, email: invoice.email || customer.email, phone: invoice.phone || customer.phone };
  });

  return { customers, leads, invoices };
}

function invoiceClientLabel(invoice: Invoice, customers: CustomerRecord[]): string {
  return customers.find((customer) => customer.id === invoice.clientId)?.name || invoice.client;
}

function invoiceClientEmail(invoice: Invoice, customers: CustomerRecord[]): string {
  return customers.find((customer) => customer.id === invoice.clientId)?.email || invoice.email;
}

function invoiceClientPhone(invoice: Invoice, customers: CustomerRecord[]): string {
  return customers.find((customer) => customer.id === invoice.clientId)?.phone || invoice.phone || "";
}

const money=(n:number)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(n);
const total=(i:Invoice)=>i.amount*(1+i.tax/100);
const emailUrl=(to:string,subject:string,body:string)=>`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
function printDocument(i:Invoice){const grand=total(i),balance=Math.max(0,grand-i.paid);const html=`<!doctype html><html><head><meta charset="utf-8"><title>${i.id}</title><style>@page{size:A4;margin:18mm}body{font:14px Arial;color:#251d17}.top{display:flex;justify-content:space-between;border-bottom:3px solid #b18a4c;padding-bottom:18px}.brand{font:700 23px Georgia;letter-spacing:1px}.sub{font-size:10px;letter-spacing:2px;color:#927444}.kind{font:24px Georgia;color:#9d793e;text-align:right}.muted{color:#83766a;font-size:12px}.meta{display:flex;gap:5%;margin:28px 0}.box{background:#f7f3ed;padding:15px;width:47%;line-height:1.8}table{width:100%;border-collapse:collapse;margin-top:22px}th{background:#241a14;color:white;text-align:left;padding:12px}td{padding:13px 12px;border-bottom:1px solid #e5ddd2}th:last-child,td:last-child{text-align:right}.totals{margin:23px 0 0 auto;width:48%;line-height:2}.grand{display:flex;justify-content:space-between;background:#f2e7d3;padding:12px;font-size:17px;font-weight:bold}.stamp{display:inline-block;border:2px solid #47765b;color:#47765b;padding:7px 12px;font-weight:bold;margin-top:20px}.foot{border-top:1px solid #ded4c8;margin-top:55px;padding-top:15px;color:#8b7b6a;font-size:11px}</style></head><body><div class="top"><div><div class="brand">RR CREATIVE INTERIORS</div><div class="sub">BEYOND THE ORDINARY</div><p class="muted">Bengaluru, Karnataka, India<br>www.rrcreativeinteriors.in</p></div><div><div class="kind">${i.type.toUpperCase()}</div><p style="text-align:right;line-height:1.7"><b>${i.id}</b><br><span class="muted">Issued: ${i.date}<br>Due: ${i.due}</span></p></div></div><div class="meta"><div class="box"><b>BILL TO</b><br>${i.client}<br>${i.email}<br><span class="muted">Project: ${i.project}</span></div><div class="box"><b>PAYMENT SUMMARY</b><br>Total: <b>${money(grand)}</b><br>Received: ${money(i.paid)}<br>Balance: <b>${money(balance)}</b></div></div><table><thead><tr><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody><tr><td>${i.description}</td><td>1</td><td>${money(i.amount)}</td><td>${money(i.amount)}</td></tr></tbody></table><div class="totals"><div style="display:flex;justify-content:space-between"><span>Subtotal</span><b>${money(i.amount)}</b></div><div style="display:flex;justify-content:space-between"><span>Tax (${i.tax}%)</span><b>${money(grand-i.amount)}</b></div><div class="grand"><span>Total</span><span>${money(grand)}</span></div><div style="display:flex;justify-content:space-between"><span>Amount received</span><b>${money(i.paid)}</b></div><div style="display:flex;justify-content:space-between"><span>Balance due</span><b>${money(balance)}</b></div></div>${i.type==="Cash receipt"||i.status==="Paid"?'<div class="stamp">PAYMENT RECEIVED</div>':''}<p>Thank you for choosing RR Creative Interiors.</p><p class="muted">Please retain this document for your records.</p><div class="foot">RR Creative Interiors · Bengaluru · www.rrcreativeinteriors.in<br>Generated ${new Date().toLocaleDateString("en-IN")}</div><script>window.onload=()=>setTimeout(()=>window.print(),250)</script></body></html>`;const w=window.open("about:blank","_blank");if(w){w.document.open();w.document.write(html);w.document.close();}else{const url=URL.createObjectURL(new Blob([html],{type:"text/html"}));const a=document.createElement("a");a.href=url;a.download=`${i.id}.html`;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}}
export default function AdminPage(){
const [logged,setLogged]=useState(false),[loginEmail,setLoginEmail]=useState(""),[loginPass,setLoginPass]=useState(""),[loginError,setLoginError]=useState("");
const [section,setSection]=useState("Overview"),[leads,setLeads]=useState<Lead[]>([]),[invoices,setInvoices]=useState<Invoice[]>([]),[clients,setClients]=useState<CustomerRecord[]>([]);
const [pipelineStages,setPipelineStages]=useState<SalesPipelineStage[]>(DEFAULT_SALES_PIPELINE.map(stage=>({...stage,requiredFields:[...stage.requiredFields]})));
const [search,setSearch]=useState(""),[stageFilter,setStageFilter]=useState("All stages"),[leadModal,setLeadModal]=useState(false),[invoiceModal,setInvoiceModal]=useState(false);
const [selectedLead,setSelectedLead]=useState<Lead|null>(null),[selectedInvoice,setSelectedInvoice]=useState<Invoice|null>(null),[selectedLeadError,setSelectedLeadError]=useState(""),[leadFormError,setLeadFormError]=useState(""),[notice,setNotice]=useState("");
const [studioName,setStudioName]=useState("RR Creative Interiors"),[studioEmail,setStudioEmail]=useState("accounts@rrcreativeinteriors.in");
const [workspaceLoaded,setWorkspaceLoaded]=useState(false),[workspaceStatus,setWorkspaceStatus]=useState("loading");
const saveQueueRef=useRef<Promise<void>>(Promise.resolve());const leadsRef=useRef<Lead[]>([]);const clientsRef=useRef<CustomerRecord[]>([]);leadsRef.current=leads;clientsRef.current=clients;
const [leadForm,setLeadForm]=useState({name:"",email:"",phone:"",project:"",serviceType:"",location:"",area:"",timeline:"",source:"Website enquiry",budget:"",notes:"",nextAction:""});
const [billForm,setBillForm]=useState({client:"",email:"",phone:"",project:"",leadId:"",linkedInvoiceId:"",date:localDateValue(),due:dateAfterDays(7),description:"Interior design services",amount:"",tax:"18",paid:"0",type:"Invoice" as "Invoice"|"Cash receipt"});const [billFormError,setBillFormError]=useState("");
const activeStages = useMemo(()=>pipelineStages.filter(stage=>stage.active || leads.some(lead=>lead.stageId===stage.id || lead.status===stage.name)),[pipelineStages,leads]);
const initialStage = useMemo(()=>pipelineStages.find(stage=>stage.active&&stage.isInitial&&stage.kind==="open") || pipelineStages.find(stage=>stage.active&&stage.kind==="open") || DEFAULT_SALES_PIPELINE[0],[pipelineStages]);
const stageLeadCounts = useMemo(()=>pipelineStages.reduce<Record<string,number>>((counts,stage)=>{counts[stage.id]=leads.filter(lead=>stageForLead(lead,pipelineStages)?.id===stage.id).length;return counts;},{}),[pipelineStages,leads]);
const billIdentityMatch = useMemo(()=>resolveCustomerIdentity(clients,billForm.email,billForm.phone),[clients,billForm.email,billForm.phone]);
const billIdentityLeads = useMemo(()=>billIdentityMatch.status==="matched"?leads.filter(lead=>lead.clientId===billIdentityMatch.customer.id&&!["Won","Lost","Disqualified"].includes(stageForLead(lead,pipelineStages)?.name||lead.status)):[],[billIdentityMatch,leads,pipelineStages]);
const visibleLeads=useMemo(()=>leads.filter(l=>{
const stage=stageForLead(l,pipelineStages);
const matchesStage=stageFilter==="All stages"||stage?.id===stageFilter||l.status===stageFilter;
return matchesStage&&`${l.name} ${l.email} ${l.phone} ${l.project} ${l.serviceType||""} ${l.location||""} ${l.source} ${l.id} ${l.nextAction||""}`.toLowerCase().includes(search.toLowerCase());
}),[leads,stageFilter,search,pipelineStages]);const visibleInvoices=useMemo(()=>invoices.filter(i=>`${i.id} ${invoiceClientLabel(i,clients)} ${invoiceClientEmail(i,clients)} ${invoiceClientPhone(i,clients)} ${i.project}`.toLowerCase().includes(search.toLowerCase())),[invoices,search,clients]);const billableInvoices=invoices.filter(i=>i.type==="Invoice");const received=invoices.reduce((sum,item)=>sum+(item.type==="Invoice"?item.paid:item.appliesToInvoiceId?0:item.paid),0),outstanding=billableInvoices.reduce((sum,item)=>sum+Math.max(0,total(item)-item.paid),0);
const todayLabel = new Intl.DateTimeFormat("en-IN",{day:"2-digit",month:"short",year:"numeric"}).format(new Date());
useEffect(()=>{let active=true;fetch("/api/admin/session",{cache:"no-store"}).then(async r=>r.ok?r.json():null).then(data=>{if(active&&data?.authenticated===true)setLogged(true);}).catch(()=>{});return()=>{active=false;};},[]);
useEffect(()=>{
 if(!logged)return;
 let active=true;
 fetch("/api/admin/workspace",{cache:"no-store"}).then(async response=>{
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(data.error||"Could not load saved workspace data.");
  return data;
 }).then(data=>{
  if(!active)return;
  const workspace=data.workspace;
  if(workspace){
   let loadedStages=normalizeSalesPipeline(workspace.pipelineStages);
   const rawLeads=Array.isArray(workspace.leads)?workspace.leads as Lead[]:[];
   const rawInvoices=Array.isArray(workspace.invoices)?workspace.invoices as Invoice[]:[];
   const rawCustomers=Array.isArray(workspace.clients)?workspace.clients as CustomerRecord[]:[];
   const linkedWorkspace=migrateCustomerLinks(rawLeads,rawInvoices,rawCustomers);
   const usedLegacyNames=new Set(loadedStages.map(stage=>stage.name.toLocaleLowerCase()));
   for(const lead of linkedWorkspace.leads){
    const known=loadedStages.find(stage=>stage.id===lead.stageId)||loadedStages.find(stage=>stage.name===lead.status);
    if(!known&&lead.status?.trim()&&!usedLegacyNames.has(lead.status.toLocaleLowerCase())){
     const legacyId=lead.stageId||`legacy-${lead.status.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,60)}`;
     loadedStages=[...loadedStages,{id:legacyId,name:lead.status,kind:"open",tone:"stone",followUpDays:null,defaultNextAction:lead.nextAction||"Review existing lead",requiredFields:[],active:false,isInitial:false,automationTriggers:[]}];
     usedLegacyNames.add(lead.status.toLocaleLowerCase());
    }
   }
   setPipelineStages(loadedStages);
   setClients(linkedWorkspace.customers);
   setLeads(linkedWorkspace.leads.map(lead=>{
    const stage=loadedStages.find(item=>item.id===lead.stageId)||loadedStages.find(item=>item.name===lead.status)||loadedStages.find(item=>item.isInitial)||loadedStages[0];
    return {...lead,clientId:lead.clientId,stageId:stage.id,status:stage.name,serviceType:lead.serviceType||"",location:lead.location||"",area:lead.area||"",timeline:lead.timeline||"",nextAction:lead.nextAction||stage.defaultNextAction||"",nextFollowUpDate:lead.nextFollowUpDate||"",agreementStatus:lead.agreementStatus||"not-started",advanceStatus:lead.advanceStatus||"not-requested",advanceExceptionReason:lead.advanceExceptionReason||"",lostReason:lead.lostReason||""};
   }));
   setInvoices(linkedWorkspace.invoices);
   if(typeof workspace.studioName==="string")setStudioName(workspace.studioName);
   if(typeof workspace.studioEmail==="string")setStudioEmail(workspace.studioEmail);
  }
  setWorkspaceLoaded(true);setWorkspaceStatus("saved");
 }).catch(error=>{
  if(!active)return;
  setWorkspaceStatus("error");
  setNotice(error instanceof Error?error.message:"Saved workspace data could not be loaded. Changes are paused until the connection is restored.");
 });
 return()=>{active=false;};
},[logged]);
useEffect(()=>{
 if(!logged||!workspaceLoaded)return;
 const payload={leads,invoices,clients,studioName,studioEmail,pipelineStages};
 const timer=window.setTimeout(()=>{
  setWorkspaceStatus("saving");
  saveQueueRef.current=saveQueueRef.current.then(async()=>{
   const response=await fetch("/api/admin/workspace",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
   const data=await response.json().catch(()=>({}));
   if(!response.ok)throw new Error(data.error||"Workspace changes could not be saved.");
  }).then(()=>{setWorkspaceStatus("saved");}).catch(error=>{
   setWorkspaceStatus("error");
   setNotice(error instanceof Error?error.message:"Workspace changes could not be saved.");
  });
 },700);
 return()=>window.clearTimeout(timer);
},[logged,workspaceLoaded,leads,invoices,clients,studioName,studioEmail,pipelineStages]);
useEffect(()=>{
 if(!logged||!workspaceLoaded)return;
 const checkForWebsiteEnquiries=async()=>{
  try{
   const response=await fetch("/api/admin/enquiries/updates",{cache:"no-store"});
   if(!response.ok)return;
   const data=await response.json().catch(()=>({}));
   if(!Array.isArray(data.leads)||!data.leads.length)return;
   const currentLeads=leadsRef.current;
   const knownLeadIds=new Set(currentLeads.map(lead=>lead.id));
   const additions=(data.leads as Lead[]).filter(lead=>typeof lead.id==="string"&&!knownLeadIds.has(lead.id));
   if(!additions.length)return;
   const currentClients=clientsRef.current;
   const incomingClients=Array.isArray(data.clients)?data.clients as CustomerRecord[]:[];
   const clientById=new Map<string,CustomerRecord>([...currentClients,...incomingClients].map(client=>[client.id,client] as const));
   const newClients=incomingClients.filter(client=>!currentClients.some(current=>current.id===client.id));
   if(newClients.length)setClients(current=>[...current,...newClients.filter(item=>!current.some(existing=>existing.id===item.id))]);
   const linkedAdditions=additions.map(lead=>{
    const customer=typeof lead.clientId==="string"?clientById.get(lead.clientId):undefined;
    return customer?{...lead,name:customer.name||lead.name,email:customer.email||lead.email,phone:customer.phone||lead.phone}:lead;
   });
   setLeads(current=>{
    const ids=new Set(current.map(lead=>lead.id));
    const fresh=linkedAdditions.filter(lead=>!ids.has(lead.id));
    return fresh.length?[...fresh,...current]:current;
   });
   setNotice(`${additions.length} new website ${additions.length===1?"enquiry has":"enquiries have"} been added to the CRM pipeline.`);
  }catch{ /* A temporary poll failure must not interrupt admin work. */ }
 };
 void checkForWebsiteEnquiries();
 const timer=window.setInterval(()=>void checkForWebsiteEnquiries(),30000);
 return()=>window.clearInterval(timer);
},[logged,workspaceLoaded]);
async function login(e:FormEvent){e.preventDefault();setLoginError("");try{const response=await fetch("/api/admin/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:loginEmail,password:loginPass})});const data=await response.json().catch(()=>({}));if(!response.ok){setLoginError(data.error||"Unable to sign in.");return;}setWorkspaceLoaded(false);setWorkspaceStatus("loading");setLogged(true);setLoginPass("");}catch{setLoginError("Unable to reach the sign-in service. Please try again.");}}
function openLeadModal(){setLeadFormError("");setLeadModal(true);}
function maybePromoteLeadToWon(lead:Lead):Lead{
 const current=stageForLead(lead,pipelineStages);
 if(current?.kind==="won"||current?.kind==="lost"||current?.kind==="disqualified")return lead;
 const wonStage=pipelineStages.find(stage=>stage.active&&stage.kind==="won");
 if(!wonStage)return lead;
 const candidate:Lead={...lead,stageId:wonStage.id,status:wonStage.name,nextAction:wonStage.defaultNextAction||"Start project onboarding",nextFollowUpDate:dateAfterDays(wonStage.followUpDays)};
 return missingPipelineFields(candidate,wonStage).length===0?candidate:lead;
}
function applyPipelineTrigger(lead:Lead,trigger:PipelineAutomationTrigger):Lead{
 const updated:Lead=trigger==="receipt_saved"?{...lead,advanceStatus:"received"}:lead;
 const current=stageForLead(updated,pipelineStages);
 // An explicit invoice on a previously lost/disqualified opportunity is a deliberate reactivation.
 // Keep already-won projects won when another milestone invoice is issued.
 if(current?.kind==="won")return updated;
 if((current?.kind==="lost"||current?.kind==="disqualified")&&trigger!=="invoice_saved"&&updated.agreementStatus!=="signed")return updated;
 const target=pipelineStages.find(stage=>stage.active&&(stage.automationTriggers||[]).includes(trigger));
 if(!target)return updated;
 const candidate:Lead={...updated,stageId:target.id,status:target.name,nextAction:target.defaultNextAction||updated.nextAction||"",nextFollowUpDate:dateAfterDays(target.followUpDays)};
 const missing=missingPipelineFields(candidate,target);
 if(missing.length){
  if(trigger==="receipt_saved"&&missing.includes("agreementSigned"))return {...updated,nextAction:"Complete and sign the agreement",nextFollowUpDate:dateAfterDays(1)};
  return {...updated,nextAction:trigger==="invoice_saved"?target.defaultNextAction:`Complete: ${missing.map(fieldLabel).join(", ")}`,nextFollowUpDate:dateAfterDays(1)};
 }
 return candidate;
}
function updateSelectedLeadField<K extends keyof Lead>(field:K,value:Lead[K]){
 if(!selectedLead)return;
 const updated={...selectedLead,[field]:value} as Lead;
 const contactField=field==="name"||field==="email"||field==="phone";
 if(contactField&&selectedLead.clientId){
  const customer=clients.find(item=>item.id===selectedLead.clientId);
  if(customer){
   if(field==="email"||field==="phone"){
    const collision=resolveCustomerIdentity(clients.filter(item=>item.id!==customer.id),updated.email,updated.phone);
    if(collision.status!=="none"){setSelectedLeadError(collision.status==="conflict"?collision.reason:"These contact details already belong to another customer record. Choose the existing CRM customer rather than merging them.");return;}
   }
   const nextCustomer:CustomerRecord={...customer,name:updated.name,email:updated.email,phone:updated.phone,updatedAt:new Date().toISOString()};
   setClients(previous=>previous.map(item=>item.id===customer.id?nextCustomer:item));
   setLeads(previous=>previous.map(item=>{
    if(item.clientId===customer.id){
     const next={...item,name:nextCustomer.name,email:nextCustomer.email,phone:nextCustomer.phone};
     return item.id===selectedLead.id?{...next,...updated}:next;
    }
    return item.id===selectedLead.id?updated:item;
   }).map(item=>item.id===selectedLead.id&&(field==="agreementStatus"||field==="advanceStatus")?maybePromoteLeadToWon(item):item));
   const displayUpdated=field==="agreementStatus"||field==="advanceStatus"?maybePromoteLeadToWon(updated):updated;
   setSelectedLead(displayUpdated);setSelectedLeadError("");
   return;
  }
 }
 const displayUpdated=field==="agreementStatus"||field==="advanceStatus"?maybePromoteLeadToWon(updated):updated;
 setSelectedLead(displayUpdated);setSelectedLeadError("");
 setLeads(current=>current.map(lead=>lead.id===selectedLead.id?displayUpdated:lead));
}

function transitionLead(leadId:string,targetStageId:string){
 const lead=leads.find(item=>item.id===leadId);
 const target=pipelineStages.find(stage=>stage.id===targetStageId);
 if(!lead||!target)return;
 const currentStage=stageForLead(lead,pipelineStages);
 if(target.id===currentStage?.id)return;
 if(target.id!==currentStage?.id&&!target.active){setNotice("That stage is inactive. Activate it in Pipeline setup before moving leads into it.");return;}
 const candidate:Lead={...lead,stageId:target.id,status:target.name,nextAction:target.defaultNextAction||lead.nextAction||"",nextFollowUpDate:dateAfterDays(target.followUpDays)};
 const missing=missingPipelineFields(candidate,target);
 if(missing.length){
  setSelectedLead(lead);setSelectedLeadError(`Cannot move to “${target.name}” yet. Complete: ${missing.map(fieldLabel).join(", ")}.`);
  return;
 }
 setLeads(current=>current.map(item=>item.id===leadId?candidate:item));
 if(selectedLead?.id===leadId){setSelectedLead(candidate);setSelectedLeadError("");}
 setNotice(`Lead moved to ${target.name}. Next action: ${candidate.nextAction||"Review this lead"}.`);
}
function addLead(e:FormEvent){
 e.preventDefault();setLeadFormError("");
 const target=initialStage;
 const id=`LD-${Date.now().toString().slice(-6)}`;
 const match=resolveCustomerIdentity(clients,leadForm.email,leadForm.phone);
 if(match.status==="conflict"){setLeadFormError(match.reason);return;}
 let customer:CustomerRecord;
 let nextCustomers=[...clients];
 if(match.status==="matched"){
  customer=match.customer;
  customer={...customer,email:customer.email||leadForm.email,phone:customer.phone||leadForm.phone,updatedAt:new Date().toISOString()};
  nextCustomers=nextCustomers.map(item=>item.id===customer.id?customer:item);
 }else{
  customer=createCustomerRecord(customerIdFor(id,clients),leadForm.name,leadForm.email,leadForm.phone);
  nextCustomers=[...nextCustomers,customer];
 }
 const lead:Lead={...leadForm,id,clientId:customer.id,name:customer.name,email:customer.email||leadForm.email,phone:customer.phone||leadForm.phone,date:localDateValue(),stageId:target.id,status:target.name,nextAction:leadForm.nextAction.trim()||target.defaultNextAction,nextFollowUpDate:dateAfterDays(target.followUpDays),agreementStatus:"not-started",advanceStatus:"not-requested",lostReason:"",advanceExceptionReason:""};
 const missing=missingPipelineFields(lead,target);
 if(missing.length){setLeadFormError(`The starting stage requires: ${missing.map(fieldLabel).join(", ")}.`);return;}
 setClients(nextCustomers);setLeads(current=>[lead,...current]);setLeadModal(false);
 setLeadForm({name:"",email:"",phone:"",project:"",serviceType:"",location:"",area:"",timeline:"",source:"Website enquiry",budget:"",notes:"",nextAction:""});
 setNotice(`Lead saved under ${customer.name}. ${match.status==="matched"?"Matched to the existing customer by phone/email. ":""}Next action: ${lead.nextAction}.`);
}
function updatePipelineStage(id:string,patch:Partial<SalesPipelineStage>){
 const current=pipelineStages.find(stage=>stage.id===id);
 if(!current)return;
 if(current.isInitial&&patch.kind&&patch.kind!=="open"){setNotice("The starting stage must remain an active opportunity stage.");return;}
 if(current.isInitial&&patch.active===false){setNotice("Choose another starting stage before deactivating this stage.");return;}
 if(patch.isInitial===true&&(patch.active===false||patch.kind&&patch.kind!=="open")){setNotice("The starting stage must be active and use Active opportunity behaviour.");return;}
 if(patch.active===false&&current.kind==="open"&&current.active&&pipelineStages.filter(stage=>stage.active&&stage.kind==="open").length<=1){setNotice("Keep at least one active opportunity stage.");return;}
 const proposed={...current,...patch};
 const mandatoryFields: PipelineField[] = proposed.kind === "won"
  ? ["agreementSigned", "advanceConfirmed"]
  : proposed.kind === "lost" || proposed.kind === "disqualified"
   ? ["lostReason"]
   : [];
 proposed.requiredFields=[...new Set([...proposed.requiredFields,...mandatoryFields])];
 proposed.automationTriggers=[...new Set(proposed.automationTriggers||[])];
 if(proposed.automationTriggers.includes("invoice_saved")&&proposed.kind!=="open"){setNotice("Invoice-saved automation must target an Active opportunity stage.");return;}
 if(proposed.automationTriggers.includes("receipt_saved")&&proposed.kind!=="won"){setNotice("Receipt-saved automation must target a Won stage.");return;}
 if(proposed.kind==="won"||proposed.kind==="lost"||proposed.kind==="disqualified")proposed.followUpDays=null;
 let next=pipelineStages.map(stage=>{
  if(stage.id===id)return proposed;
  return {...stage,automationTriggers:(stage.automationTriggers||[]).filter(trigger=>!proposed.automationTriggers.includes(trigger))};
 });
 if(patch.isInitial===true)next=next.map(stage=>({...stage,isInitial:stage.id===id}));
 if(patch.isInitial===false&&current.isInitial){setNotice("Select a new starting stage before removing the starting-stage flag.");return;}
 if(next.filter(stage=>stage.active&&stage.kind==="won").length<1){setNotice("Keep at least one active Won stage.");return;}
 if(next.filter(stage=>stage.active&&(stage.kind==="lost"||stage.kind==="disqualified")).length<1){setNotice("Keep at least one active Lost or Disqualified stage.");return;}
 setPipelineStages(next);
 setNotice("Pipeline setting updated. Changes are saving automatically.");
}
function renamePipelineStage(id:string,nextName:string){
 const current=pipelineStages.find(stage=>stage.id===id);
 const name=nextName.trim();
 if(!current||!name||name===current.name)return;
 if(pipelineStages.some(stage=>stage.id!==id&&stage.name.trim().toLocaleLowerCase()===name.toLocaleLowerCase())){setNotice("Each pipeline stage needs a unique name.");return;}
 setPipelineStages(previous=>previous.map(stage=>stage.id===id?{...stage,name}:stage));
 setLeads(previous=>previous.map(lead=>(lead.stageId===id||(!lead.stageId&&lead.status===current.name))?{...lead,stageId:id,status:name}:lead));
 if(stageFilter===current.id||stageFilter===current.name)setStageFilter(id);
 if(selectedLead&&(selectedLead.stageId===id||selectedLead.status===current.name))setSelectedLead(previous=>previous?{...previous,stageId:id,status:name}:previous);
 setNotice(`Stage renamed to “${name}”. Existing leads remain in this stage.`);
}
function movePipelineStage(id:string,direction:-1|1){
 const from=pipelineStages.findIndex(stage=>stage.id===id),to=from+direction;
 if(from<0||to<0||to>=pipelineStages.length)return;
 const reordered=[...pipelineStages];[reordered[from],reordered[to]]=[reordered[to],reordered[from]];
 setPipelineStages(reordered);setNotice("Pipeline stage order updated.");
}
function addPipelineStage(){
 if(pipelineStages.length>=30){setNotice("You can configure up to 30 pipeline stages.");return;}
 let suffix=1,name="New stage";
 while(pipelineStages.some(stage=>stage.name.toLocaleLowerCase()===name.toLocaleLowerCase())){suffix+=1;name=`New stage ${suffix}`;}
 const stage:SalesPipelineStage={id:`custom-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,name,kind:"open",tone:"gold",followUpDays:2,defaultNextAction:"Define the next action",requiredFields:[],active:true,isInitial:false,automationTriggers:[]};
 const firstOutcome=pipelineStages.findIndex(item=>item.kind==="won"||item.kind==="nurture"||item.kind==="lost"||item.kind==="disqualified");
 const next=[...pipelineStages];next.splice(firstOutcome<0?next.length:firstOutcome,0,stage);
 setPipelineStages(next);setNotice("New stage added. Configure its name, entry requirements and next action.");
}
function removePipelineStage(id:string){
 const stage=pipelineStages.find(item=>item.id===id);
 if(!stage)return;
 if((stage.automationTriggers||[]).length){setNotice("Move this stage’s automatic event trigger to another stage in Pipeline setup before removing it.");return;}
 if(stage.isInitial){setNotice("Choose another starting stage before removing this stage.");return;}
 if(stageLeadCounts[id]>0){setNotice(`Move the ${stageLeadCounts[id]} lead(s) out of “${stage.name}” before removing it.`);return;}
 if(stage.active&&stage.kind==="open"&&pipelineStages.filter(item=>item.active&&item.kind==="open").length<=1){setNotice("Keep at least one active opportunity stage.");return;}
 if(stage.active&&stage.kind==="won"&&pipelineStages.filter(item=>item.active&&item.kind==="won").length<=1){setNotice("Keep at least one active Won stage.");return;}
 if(stage.active&&(stage.kind==="lost"||stage.kind==="disqualified")&&pipelineStages.filter(item=>item.active&&(item.kind==="lost"||item.kind==="disqualified")).length<=1){setNotice("Keep at least one active Lost or Disqualified stage.");return;}
 if(!window.confirm(`Remove “${stage.name}” from the pipeline? This cannot be undone.`))return;
 setPipelineStages(current=>current.filter(item=>item.id!==id));setNotice(`Removed stage “${stage.name}”.`);
}
function openInvoiceModal(){setBillFormError("");setInvoiceModal(true);}
function chooseBillLead(leadId:string){
 if(leadId==="__none__"){setBillForm({...billForm,leadId:"__none__",linkedInvoiceId:""});setBillFormError("");return;}
 if(!leadId){setBillForm({...billForm,leadId:"",linkedInvoiceId:""});setBillFormError("");return;}
 const lead=leads.find(item=>item.id===leadId);
 if(!lead)return;
 const customer=clients.find(item=>item.id===lead.clientId);
 setBillForm({...billForm,leadId:lead.id,linkedInvoiceId:"",client:customer?.name||lead.name,email:customer?.email||lead.email,phone:customer?.phone||lead.phone,project:lead.project});
 setBillFormError("");
}
function chooseReceiptInvoice(invoiceId:string){
 if(invoiceId==="__none__"){setBillForm({...billForm,linkedInvoiceId:"__none__"});setBillFormError("");return;}
 if(!invoiceId){setBillForm({...billForm,linkedInvoiceId:""});setBillFormError("");return;}
 const invoice=invoices.find(item=>item.id===invoiceId&&item.type==="Invoice");
 if(!invoice)return;
 const lead=leads.find(item=>item.id===invoice.leadId);
 const customer=clients.find(item=>item.id===invoice.clientId)||(lead?clients.find(item=>item.id===lead.clientId):undefined);
 setBillForm({...billForm,linkedInvoiceId:invoice.id,leadId:lead?.id||"",client:customer?.name||invoice.client,email:customer?.email||invoice.email,phone:customer?.phone||invoice.phone||"",project:invoice.project});
 setBillFormError("");
}
function addBill(e:FormEvent){
 e.preventDefault();setBillFormError("");
 const amount=Number(billForm.amount);
 if(!billForm.client.trim()||!billForm.project.trim()||!billForm.description.trim()){setBillFormError("Enter the customer, project and document description.");return;}
 if(!billForm.email.trim()&&!billForm.phone.trim()){setBillFormError("Enter at least one contact identifier: email or phone. Names alone are not safe for matching.");return;}
 if(!Number.isFinite(amount)||amount<=0){setBillFormError("Enter an amount greater than zero.");return;}
 const receipt=billForm.type==="Cash receipt";
 const tax=receipt?0:Number(billForm.tax);
 const paid=receipt?amount:Number(billForm.paid);
 const grand=amount*(1+tax/100);
 if(paid<0||paid>grand){setBillFormError("The amount already received cannot be negative or greater than the document total.");return;}
 let nextInvoices=[...invoices];
 let sourceInvoice:Invoice|undefined;
 if(receipt&&billForm.linkedInvoiceId&&billForm.linkedInvoiceId!=="__none__"){
  sourceInvoice=nextInvoices.find(item=>item.id===billForm.linkedInvoiceId&&item.type==="Invoice");
  if(!sourceInvoice){setBillFormError("The invoice selected for this receipt no longer exists. Refresh the workspace and select it again.");return;}
  const balance=Math.max(0,total(sourceInvoice)-sourceInvoice.paid);
  if(amount>balance+0.009){setBillFormError(`This receipt exceeds the linked invoice balance of ${money(balance)}.`);return;}
  if(billForm.leadId&&billForm.leadId!=="__none__"&&sourceInvoice.leadId&&billForm.leadId!==sourceInvoice.leadId){setBillFormError("The receipt invoice and CRM project do not match. Select the invoice again so the receipt remains attached to the correct sale.");return;}
 }
 let linkedLead:Lead|undefined;
 let customer:CustomerRecord|undefined;
 let nextCustomers=[...clients];
 const explicitLeadId=sourceInvoice?.leadId||((billForm.leadId&&billForm.leadId!=="__none__")?billForm.leadId:"");
 if(explicitLeadId){
  linkedLead=leads.find(item=>item.id===explicitLeadId);
  if(!linkedLead){setBillFormError("The selected CRM lead no longer exists. Refresh and choose the current lead/project.");return;}
  customer=nextCustomers.find(item=>item.id===linkedLead?.clientId);
  if(!customer){setBillFormError("The selected lead has no customer record yet. Open and save the lead profile first so RR can repair its customer link.");return;}
  if(normalizeCustomerEmail(billForm.email)&&normalizeCustomerEmail(customer.email)&&normalizeCustomerEmail(billForm.email)!==normalizeCustomerEmail(customer.email)){setBillFormError("The email differs from the selected CRM customer. Update the customer contact in the CRM first, or select the correct lead.");return;}
  if(normalizeCustomerPhone(billForm.phone)&&normalizeCustomerPhone(customer.phone)&&normalizeCustomerPhone(billForm.phone)!==normalizeCustomerPhone(customer.phone)){setBillFormError("The phone differs from the selected CRM customer. Update the customer contact in the CRM first, or select the correct lead.");return;}
  customer={...customer,email:customer.email||billForm.email,phone:customer.phone||billForm.phone,updatedAt:new Date().toISOString()};
  nextCustomers=nextCustomers.map(item=>item.id===customer!.id?customer!:item);
  if(billForm.project.trim().toLocaleLowerCase()!==linkedLead.project.trim().toLocaleLowerCase()){setBillFormError(`The selected CRM project is “${linkedLead.project}”, but the document project is “${billForm.project}”. Select the right lead or update the project in the CRM first.`);return;}
 }else{
  const match=resolveCustomerIdentity(nextCustomers,billForm.email,billForm.phone);
  if(match.status==="conflict"){setBillFormError(match.reason);return;}
  if(match.status==="matched"){
   customer=match.customer;
   customer={...customer,email:customer.email||billForm.email,phone:customer.phone||billForm.phone,updatedAt:new Date().toISOString()};
   nextCustomers=nextCustomers.map(item=>item.id===customer?.id?customer!:item);
   if(billForm.leadId!=="__none__"){
    const projectMatches=leads.filter(lead=>lead.clientId===customer!.id&&lead.project.trim().toLocaleLowerCase()===billForm.project.trim().toLocaleLowerCase());
    if(projectMatches.length>1){setBillFormError("More than one CRM opportunity has this customer and project name. Select the exact lead/project in the CRM link field.");return;}
    if(projectMatches.length===1)linkedLead=projectMatches[0];
    else {
     const existingLeads=leads.filter(lead=>lead.clientId===customer!.id);
     if(existingLeads.length>0){setBillFormError("RR matched the customer by phone/email, but the project does not uniquely match an existing CRM opportunity. Select the correct lead/project above, or explicitly choose “Standalone document — do not move CRM”.");return;}
    }
   }
  }else{
   customer=createCustomerRecord(customerIdFor(`DOC-${Date.now()}`,nextCustomers),billForm.client,billForm.email,billForm.phone);
   nextCustomers=[...nextCustomers,customer];
  }
 }
 if(receipt&&!sourceInvoice&&billForm.linkedInvoiceId!=="__none__"&&customer){
  const outstandingInvoices=nextInvoices.filter(item=>item.type==="Invoice"&&item.clientId===customer!.id&&total(item)>item.paid);
  const projectMatches=outstandingInvoices.filter(item=>item.project.trim().toLocaleLowerCase()===billForm.project.trim().toLocaleLowerCase());
  if(projectMatches.length>1){setBillFormError("More than one outstanding invoice has this customer and project. Select the exact invoice to apply the receipt.");return;}
  if(projectMatches.length===1)sourceInvoice=projectMatches[0];
  else if(outstandingInvoices.length>0){setBillFormError("This customer has outstanding invoices, but none matches the receipt project. Select the exact invoice above or choose Unapplied receipt.");return;}
 }
 if(sourceInvoice&&customer&&sourceInvoice.clientId&&sourceInvoice.clientId!==customer.id){setBillFormError("The selected invoice belongs to a different customer than the contact matched. Correct the contact or select the right CRM customer.");return;}
 if(sourceInvoice&&sourceInvoice.project.trim().toLocaleLowerCase()!==billForm.project.trim().toLocaleLowerCase()){setBillFormError("The receipt project must match the invoice project. Select the invoice again to copy its details.");return;}
 if(sourceInvoice&&sourceInvoice.leadId){
  const invoiceLead=leads.find(item=>item.id===sourceInvoice!.leadId);
  if(invoiceLead&&linkedLead&&invoiceLead.id!==linkedLead.id){setBillFormError("The receipt invoice is linked to a different CRM opportunity. Select its matching invoice or lead.");return;}
  if(invoiceLead)linkedLead=invoiceLead;
 }
 if(sourceInvoice){
  const balance=Math.max(0,total(sourceInvoice)-sourceInvoice.paid);
  if(amount>balance+0.009){setBillFormError(`This receipt exceeds the linked invoice balance of ${money(balance)}.`);return;}
  const updatedPaid=Math.min(total(sourceInvoice),sourceInvoice.paid+amount);
  const updatedSource:Invoice={...sourceInvoice,clientId:customer.id,leadId:sourceInvoice.leadId||linkedLead?.id,paid:updatedPaid,status:updatedPaid>=total(sourceInvoice)?"Paid":updatedPaid>0?"Partially paid":"Draft"};
  nextInvoices=nextInvoices.map(item=>item.id===sourceInvoice!.id?updatedSource:item);
 }
 const year=new Date().getFullYear();
 const nextNumber=nextInvoices.filter(item=>item.type===billForm.type).length+1;
 const document:Invoice={id:`RR-${receipt?"REC":"INV"}-${year}-${String(nextNumber).padStart(3,"0")}`,clientId:customer.id,leadId:linkedLead?.id,appliesToInvoiceId:sourceInvoice?.id,client:billForm.client.trim(),email:billForm.email.trim(),phone:billForm.phone.trim(),project:billForm.project.trim(),date:billForm.date,due:billForm.due,description:billForm.description.trim(),amount,tax,paid,type:billForm.type,status:receipt||paid>=grand?"Paid":paid>0?"Partially paid":"Draft"};
 nextInvoices=[document,...nextInvoices];
 let updatedLead:Lead|undefined;
 if(linkedLead){
  updatedLead=linkedLead;
  if(receipt){updatedLead=applyPipelineTrigger(updatedLead,"receipt_saved");}
  else {updatedLead=applyPipelineTrigger(updatedLead,"invoice_saved");if(paid>0)updatedLead=applyPipelineTrigger(updatedLead,"receipt_saved");}
 }
 setClients(nextCustomers);
 setInvoices(nextInvoices);
 if(updatedLead){
  setLeads(current=>current.map(lead=>lead.id===updatedLead!.id?updatedLead!:lead));
  if(selectedLead?.id===updatedLead.id)setSelectedLead(updatedLead);
 }
 setInvoiceModal(false);setSelectedInvoice(document);
 setBillFormError("");
 setBillForm({client:"",email:"",phone:"",project:"",leadId:"",linkedInvoiceId:"",date:localDateValue(),due:dateAfterDays(7),description:"Interior design services",amount:"",tax:"18",paid:"0",type:"Invoice"});
 const stageMessage=updatedLead?` CRM updated to “${updatedLead.status}” for ${updatedLead.name}.`: " No CRM stage moved because this document was not linked to a specific CRM opportunity.";
 const paymentMessage=sourceInvoice?` Applied ${money(amount)} to ${sourceInvoice.id}.`:"";
 setNotice(`${receipt?"Cash receipt":"Invoice"} saved and linked to customer ${customer.name}.${paymentMessage}${stageMessage}`);
}
function draftEmail(i:Invoice){
 const recipient=invoiceClientEmail(i,clients);
 const recipientName=invoiceClientLabel(i,clients);
 if(!recipient.trim()){setNotice("Add an email address to the customer record before drafting this email.");return;}
 const subject=`${i.type} ${i.id} — ${i.project}`;
 const body=`Dear ${recipientName},\n\nPlease find the ${i.type.toLowerCase()} details for your project with ${studioName}.\n\nDocument: ${i.id}\nProject: ${i.project}\nTotal: ${money(total(i))}\nAmount received: ${money(i.paid)}\nBalance: ${money(Math.max(0,total(i)-i.paid))}\n\nPlease attach the downloaded PDF before sending.\n\nWarm regards,\n${studioName}\n${studioEmail}`;
 window.open(emailUrl(recipient,subject,body),"_blank","noopener,noreferrer");
}
if(!logged)return <main className="rr-login"><div className="rr-login-art"><div className="rr-login-mark">RR<span> / </span>CI</div><div className="rr-login-copy"><span className="rr-eyebrow">PRIVATE WORKSPACE</span><h1>Good spaces<br/><i>start with clarity.</i></h1><p>Leads, projects and accounts — thoughtfully brought together.</p></div><div className="rr-login-foot">RR CREATIVE INTERIORS <span>·</span> BEYOND THE ORDINARY</div></div><div className="rr-login-panel"><Link className="rr-back" href="/"><ArrowLeft size={16}/> Back to website</Link><div className="rr-login-form"><div className="rr-monogram">RR</div><span className="rr-eyebrow">ADMINISTRATION</span><h2>Welcome back.</h2><p>Sign in to manage your workspace.</p><form onSubmit={login}><label>Admin email</label><input type="email" autoComplete="username" value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} placeholder="you@rrcreativeinteriors.in" required/><label>Password</label><input type="password" autoComplete="current-password" value={loginPass} onChange={e=>setLoginPass(e.target.value)} placeholder="Enter your password" required/>{loginError&&<div className="rr-login-error">{loginError}</div>}<button className="rr-primary rr-login-submit" type="submit">Sign in <ChevronDown size={16}/></button></form><div className="rr-secure-note"><span/> Private access only. Credentials are not stored in the browser.</div></div></div></main>;
return <main className="rr-admin"><aside className="rr-sidebar"><Link href="/" className="rr-admin-brand"><Image alt="" width={38} height={38} src="/rr-media/logo/Glossy%20Red%20and%20Gold%20Split%20Emblem.png"/><span><b>RR CREATIVE</b><small>INTERIORS · ADMIN</small></span></Link><div className="rr-workspace-tag">WORKSPACE <span>LIVE</span></div><nav>{[{label:"Overview",icon:LayoutDashboard},{label:"Leads & CRM",icon:Users},{label:"Pipeline setup",icon:SlidersHorizontal},{label:"Invoices & receipts",icon:FileText},{label:"Portfolio library",icon:FolderOpen},{label:"Settings",icon:Settings}].map(n=><button key={n.label} className={section===n.label?"active":""} onClick={()=>{setSection(n.label);setSearch("");if(n.label!=="Leads & CRM")setStageFilter("All stages");}}><n.icon size={18}/>{n.label}{n.label==="Leads & CRM"&&<em>{leads.filter(l=>stageForLead(l,pipelineStages)?.isInitial).length}</em>}</button>)}</nav><div className="rr-sidebar-bottom"><div className="rr-help-card"><div className="rr-help-icon">✦</div><b>Everything in order.</b><p>Your business workspace, one considered detail at a time.</p></div><div className="rr-user"><div className="rr-avatar">RR</div><div><b>Administrator</b><small>{studioEmail}</small></div><button title="Sign out" onClick={async()=>{await fetch("/api/admin/logout",{method:"POST"}).catch(()=>{});setLogged(false);setWorkspaceLoaded(false);setWorkspaceStatus("loading");setLoginEmail("");setLoginPass("");}}><LogOut size={17}/></button></div></div></aside><section className="rr-main"><header className="rr-topbar"><div className="rr-crumb">Workspace <span>/</span> <b>{section}</b></div><div className="rr-top-actions"><span className="rr-today"><CalendarDays size={15}/>{todayLabel||"Today"}</span><span className="rr-save-status" role="status"><i className={workspaceStatus}/>{workspaceStatus==="loading"?"Loading records":workspaceStatus==="saving"?"Saving changes":workspaceStatus==="error"?"Sync issue":"All changes saved"}</span><button className="rr-bell" title="Notifications"><Bell size={18}/><i/></button><div className="rr-top-avatar">RR</div></div></header><div className="rr-content">{notice&&<div className="rr-notice"><Check size={16}/>{notice}<button onClick={()=>setNotice("")}><X size={15}/></button></div>}
{section==="Overview"&&<><div className="rr-page-heading"><div><span className="rr-eyebrow">YOUR STUDIO AT A GLANCE</span><h1>Good afternoon.</h1><p>Here’s what’s happening across your studio.</p></div><button className="rr-primary" onClick={openInvoiceModal}><Plus size={17}/> Create invoice</button></div><div className="rr-stats"><article className="rr-stat"><div className="rr-stat-top"><span>Active enquiries</span><span className="rr-stat-icon pink"><Users size={18}/></span></div><strong>{String(leads.filter(l=>!['Won','Lost'].includes(l.status)).length).padStart(2,"0")}</strong><small><b>{leads.filter(l=>l.status==="New enquiry").length} new</b> · needs attention</small></article><article className="rr-stat"><div className="rr-stat-top"><span>Outstanding balance</span><span className="rr-stat-icon gold"><Wallet size={18}/></span></div><strong>{money(outstanding)}</strong><small>Across {billableInvoices.filter(i=>total(i)>i.paid).length} unpaid invoices</small></article><article className="rr-stat"><div className="rr-stat-top"><span>Payments recorded</span><span className="rr-stat-icon green"><Wallet size={18}/></span></div><strong>{money(received)}</strong><small>Recorded receipts and invoice payments</small></article><article className="rr-stat"><div className="rr-stat-top"><span>Documents</span><span className="rr-stat-icon blue"><FileText size={18}/></span></div><strong>{String(invoices.length).padStart(2,"0")}</strong><small>{invoices.filter(i=>i.status==="Draft").length} draft · {invoices.filter(i=>i.status==="Paid").length} paid</small></article></div><div className="rr-overview-grid"><section className="rr-panel rr-pipeline-panel"><div className="rr-panel-heading"><div><h2>Lead pipeline</h2><p>Move every enquiry towards a decision.</p></div><button className="rr-text-action" onClick={()=>setSection("Leads & CRM")}>View CRM <ChevronDown size={15}/></button></div><div className="rr-pipeline">{pipelineStages.filter(stage=>stage.active).map((stage)=>{const count=stageLeadCounts[stage.id]||0;return <button key={stage.id} onClick={()=>{setSection("Leads & CRM");setStageFilter(stage.id);}}><span>{stage.name}</span><b>{count}</b><i className={`rr-pipe-${stage.tone}`} style={{width:`${Math.max(5,count/Math.max(1,leads.length)*100)}%`}}/></button>})}</div><div className="rr-panel-footer"><span>Pipeline conversion starts with a timely reply.</span><button onClick={openLeadModal}><Plus size={15}/> Add lead</button></div></section><section className="rr-panel rr-invoice-panel"><div className="rr-panel-heading"><div><h2>Recent documents</h2><p>Invoices and receipts at a glance.</p></div><button className="rr-icon-link" title="View all" onClick={()=>setSection("Invoices & receipts")}><ArrowLeft size={16}/></button></div><div className="rr-mini-invoices">{invoices.slice(0,4).map(i=><div className="rr-mini-invoice" key={i.id}><div className="rr-file-icon"><FileText size={17}/></div><div className="rr-mini-meta"><b>{invoiceClientLabel(i,clients)}</b><small>{i.id} · {i.type}</small></div><div className="rr-mini-amount"><b>{money(total(i))}</b><small className={`rr-status status-${i.status.toLowerCase().replaceAll(" ","-")}`}>{i.status}</small></div><button onClick={()=>setSelectedInvoice(i)} title="Open document"><ChevronDown size={16}/></button></div>)}</div><button className="rr-view-all" onClick={()=>setSection("Invoices & receipts")}>All invoices & receipts <ArrowLeft size={15}/></button></section></div><section className="rr-panel rr-recent-leads"><div className="rr-panel-heading"><div><h2>Recent enquiries</h2><p>The next conversation could start here.</p></div><button className="rr-text-action" onClick={()=>setSection("Leads & CRM")}>Open CRM <ChevronDown size={15}/></button></div><div className="rr-table-wrap"><table className="rr-table"><thead><tr><th>CONTACT</th><th>PROJECT</th><th>SOURCE</th><th>STATUS</th><th>RECEIVED</th><th/></tr></thead><tbody>{leads.slice(0,4).map(l=><tr key={l.id}><td><div className="rr-contact"><span className="rr-contact-avatar">{l.name.split(" ").map(w=>w[0]).join("")}</span><span><b>{l.name}</b><small>{l.email}</small></span></div></td><td>{l.project}</td><td>{l.source}</td><td><span className={`rr-status status-${pipelineTone(l,pipelineStages)}`}>{l.status}</span></td><td>{l.date}</td><td><button className="rr-row-more" onClick={()=>{setSelectedLeadError("");setSelectedLead(l);}}>•••</button></td></tr>)}</tbody></table></div></section></>}
{section==="Leads & CRM"&&<><div className="rr-page-heading"><div><span className="rr-eyebrow">RELATIONSHIPS, WELL MANAGED</span><h1>Leads & CRM</h1><p>One clear next action for every enquiry. Configure the stages and required fields in Pipeline setup.</p></div><div className="rr-page-actions"><button className="rr-secondary" onClick={()=>setSection("Pipeline setup")}><SlidersHorizontal size={15}/> Pipeline setup</button><button className="rr-primary" onClick={openLeadModal}><Plus size={17}/> Add lead</button></div></div>
<div className="rr-crm-metrics">
<div><span>Total leads</span><b>{leads.length}</b></div>
<div><span>New enquiries</span><b>{leads.filter(l=>stageForLead(l,pipelineStages)?.isInitial).length}</b></div>
<div><span>Follow-ups due</span><b>{leads.filter(l=>{const stage=stageForLead(l,pipelineStages);return Boolean(stage&&(stage.kind==="open"||stage.kind==="nurture")&&l.nextFollowUpDate&&l.nextFollowUpDate<=localDateValue());}).length}</b></div>
<div><span>Won</span><b>{leads.filter(l=>stageForLead(l,pipelineStages)?.kind==="won").length}</b></div>
</div>
<section className="rr-panel rr-crm-panel"><div className="rr-crm-toolbar"><div className="rr-search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, contact, project or next action"/></div><div className="rr-filter"><Filter size={16}/><select value={stageFilter} onChange={e=>setStageFilter(e.target.value)}><option value="All stages">All stages</option>{activeStages.map(stage=><option key={stage.id} value={stage.id}>{stage.name}{!stage.active?" · inactive":""}</option>)}</select></div></div>
<div className="rr-table-wrap"><table className="rr-table"><thead><tr><th>CONTACT</th><th>SERVICE / PROJECT</th><th>SOURCE</th><th>STAGE</th><th>NEXT ACTION</th><th>FOLLOW-UP</th><th>ACTION</th></tr></thead><tbody>
{visibleLeads.map(l=>{const currentStage=stageForLead(l,pipelineStages);const due=l.nextFollowUpDate||"";const dueState=due&&due<localDateValue()&&(currentStage?.kind==="open"||currentStage?.kind==="nurture")?"overdue":due===localDateValue()?"today":"future";const options=activeStages.filter(stage=>stage.active||stage.id===currentStage?.id);return <tr key={l.id}><td><div className="rr-contact"><span className="rr-contact-avatar">{l.name.split(" ").map(w=>w[0]).join("")}</span><span><b>{l.name}</b><small>{l.email||"No email"}<br/>{l.phone||"No phone"}</small></span></div></td><td><b>{l.serviceType||"Service not set"}</b><small className="rr-cell-note">{l.project}{l.budget?` · ${l.budget}`:""}</small></td><td>{l.source}</td><td><select aria-label={`Stage for ${l.name}`} className={`rr-status-select status-${pipelineTone(l,pipelineStages)}`} value={currentStage?.id||""} onChange={e=>transitionLead(l.id,e.target.value)}>{options.map(stage=><option key={stage.id} value={stage.id}>{stage.name}</option>)}</select></td><td className="rr-next-action-cell"><b>{l.nextAction||"Define next action"}</b>{l.location&&<small>{l.location}</small>}</td><td><span className={`rr-follow-up is-${dueState}`}>{!due?"Not scheduled":dueState==="overdue"?"Overdue · "+due:dueState==="today"?"Due today":due}</span></td><td><button className="rr-small-button" onClick={()=>{setSelectedLeadError("");setSelectedLead(l);}}>Open</button></td></tr>})}
</tbody></table>{visibleLeads.length===0&&<div className="rr-empty">{leads.length===0?"No leads yet. Add a lead here or connect the website capture flow next.":"No leads match your search or filter."}</div>}</div><div className="rr-table-bottom">Showing {visibleLeads.length} of {leads.length} leads <span>Stage changes check the target stage&apos;s required information and schedule the next follow-up.</span></div></section></>}{section==="Invoices & receipts"&&<><div className="rr-page-heading"><div><span className="rr-eyebrow">CLEAR BOOKS, CONFIDENT CLIENTS</span><h1>Invoices & receipts</h1><p>Create polished billing documents, record payments, and prepare client emails.</p></div><button className="rr-primary" onClick={openInvoiceModal}><Plus size={17}/> Create document</button></div><div className="rr-crm-metrics rr-billing-metrics"><div><span>Total billed</span><b>{money(billableInvoices.reduce((s,i)=>s+total(i),0))}</b></div><div><span>Received</span><b>{money(received)}</b></div><div><span>Balance due</span><b>{money(outstanding)}</b></div><div><span>Paid invoices</span><b>{billableInvoices.filter(i=>i.status==="Paid").length}</b></div></div><section className="rr-panel rr-crm-panel"><div className="rr-crm-toolbar"><div className="rr-search"><Search size={17}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search document, client or project"/></div><div className="rr-filter"><ClipboardList size={16}/><span>{invoices.length} documents</span></div></div><div className="rr-table-wrap"><table className="rr-table rr-billing-table"><thead><tr><th>DOCUMENT</th><th>CLIENT / PROJECT</th><th>ISSUED</th><th>TOTAL</th><th>RECEIVED</th><th>STATUS</th><th>ACTIONS</th></tr></thead><tbody>{visibleInvoices.map(i=><tr key={i.id}><td><div className="rr-doc-id"><span className="rr-file-icon"><FileText size={17}/></span><span><b>{i.id}</b><small>{i.type}</small></span></div></td><td><b>{invoiceClientLabel(i,clients)}</b><small className="rr-cell-note">{i.project}</small></td><td>{i.date}</td><td><b>{money(total(i))}</b></td><td>{money(i.paid)}</td><td><span className={`rr-status status-${i.status.toLowerCase().replaceAll(" ","-")}`}>{i.status}</span></td><td><div className="rr-action-row"><button title="Open document" onClick={()=>setSelectedInvoice(i)}><FileText size={16}/></button><button title="Draft client email" onClick={()=>draftEmail(i)}><Mail size={16}/></button></div></td></tr>)}</tbody></table></div><div className="rr-table-bottom">Download a print-ready document and choose Save as PDF. <span>Email attachment must be added manually in Gmail.</span></div></section></>}
{section==="Settings"&&<><div className="rr-page-heading"><div><span className="rr-eyebrow">YOUR STUDIO, YOUR RULES</span><h1>Workspace settings</h1><p>Set the studio details used in documents and email drafts.</p></div></div><section className="rr-panel rr-settings-panel"><div className="rr-settings-head"><div className="rr-setting-symbol"><Settings size={22}/></div><div><h2>Business identity</h2><p>These details appear in generated documents and email signatures.</p></div></div><form onSubmit={e=>{e.preventDefault();setNotice("Workspace settings updated. Changes will sync automatically.");}}><label>Business / studio name</label><input value={studioName} onChange={e=>setStudioName(e.target.value)} required/><label>Accounts email</label><input type="email" value={studioEmail} onChange={e=>setStudioEmail(e.target.value)} required/><div className="rr-settings-note"><FileText size={18}/><p><b>A4 document format</b><br/>Invoice and cash receipt layout, tax, amount received, balance and payment received mark.</p></div><div className="rr-settings-note"><Mail size={18}/><p><b>Email workflow</b><br/>Opens a prefilled Gmail compose. Attach your PDF manually before sending — websites cannot silently attach a local file.</p></div><button className="rr-primary" type="submit">Save settings <Check size={16}/></button></form></section></>}
{section==="Pipeline setup"&&<PipelineConfigurator stages={pipelineStages} leadCounts={stageLeadCounts} onUpdate={updatePipelineStage} onRename={renamePipelineStage} onMove={movePipelineStage} onAdd={addPipelineStage} onRemove={removePipelineStage}/>}
{section==="Portfolio library"&&<PortfolioManager />}
</div><footer className="rr-admin-footer"><span>© 2026 RR Creative Interiors</span><span>Thoughtfully managed. <b>Beyond the ordinary.</b></span></footer></section>
{leadModal&&<div className="rr-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setLeadModal(false);}}><section className="rr-modal rr-modal-wide"><div className="rr-modal-head"><div><span className="rr-eyebrow">CRM · NEW RECORD</span><h2>Add a lead</h2><p>Capture enough context to make the next contact useful. New leads start in <b>{initialStage.name}</b>.</p></div><button onClick={()=>setLeadModal(false)}><X size={19}/></button></div>
<form className="rr-modal-form" onSubmit={addLead}>
<label>Customer / organisation name *</label><input required value={leadForm.name} onChange={e=>setLeadForm({...leadForm,name:e.target.value})} placeholder="Full name or company"/>
<div className="rr-two-field"><div><label>Email</label><input type="email" value={leadForm.email} onChange={e=>setLeadForm({...leadForm,email:e.target.value})} placeholder="name@company.com"/></div><div><label>Phone</label><input value={leadForm.phone} onChange={e=>setLeadForm({...leadForm,phone:e.target.value})} placeholder="+91"/></div></div>
<label>Project / requirement *</label><input required value={leadForm.project} onChange={e=>setLeadForm({...leadForm,project:e.target.value})} placeholder="e.g. 3 BHK home interiors"/>
<div className="rr-two-field"><div><label>Service type</label><select value={leadForm.serviceType} onChange={e=>setLeadForm({...leadForm,serviceType:e.target.value})}><option value="">Select service / not sure yet</option><option>Residential turnkey</option><option>Commercial / corporate</option><option>Renovation</option><option>Design-only</option><option>Modular kitchen / wardrobes</option><option>Furniture / individual work</option><option>Other / unsure</option></select></div><div><label>Lead source</label><select value={leadForm.source} onChange={e=>setLeadForm({...leadForm,source:e.target.value})}><option>Website enquiry</option><option>WhatsApp</option><option>Instagram</option><option>Phone call</option><option>Referral</option><option>Paid ads</option><option>Email</option><option>Walk-in</option><option>Other</option></select></div></div>
<div className="rr-two-field"><div><label>Property / project location</label><input value={leadForm.location} onChange={e=>setLeadForm({...leadForm,location:e.target.value})} placeholder="Area / city"/></div><div><label>Approximate area</label><input value={leadForm.area} onChange={e=>setLeadForm({...leadForm,area:e.target.value})} placeholder="e.g. 1,800 sq. ft."/></div></div>
<div className="rr-two-field"><div><label>Estimated budget</label><input value={leadForm.budget} onChange={e=>setLeadForm({...leadForm,budget:e.target.value})} placeholder="Range or amount"/></div><div><label>Expected start timeline</label><select value={leadForm.timeline} onChange={e=>setLeadForm({...leadForm,timeline:e.target.value})}><option value="">Not discussed yet</option><option>Immediately</option><option>Within 1 month</option><option>1–3 months</option><option>3–6 months</option><option>6+ months</option><option>Flexible / exploring</option></select></div></div>
<label>Notes / first conversation outcome</label><textarea rows={3} value={leadForm.notes} onChange={e=>setLeadForm({...leadForm,notes:e.target.value})} placeholder="Requirements, preferences, source detail or what you agreed to do next…"/>
<div className="rr-stage-start-note"><SlidersHorizontal size={16}/><span><b>Starting stage: {initialStage.name}</b><small>The pipeline applies its required fields and follow-up timing. To change those rules, use Pipeline setup.</small></span></div>
{leadFormError&&<div className="rr-login-error" role="alert">{leadFormError}</div>}
<div className="rr-modal-actions"><button type="button" className="rr-secondary" onClick={()=>setLeadModal(false)}>Cancel</button><button type="submit" className="rr-primary">Save lead <Plus size={16}/></button></div></form></section></div>}{invoiceModal&&<div className="rr-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setInvoiceModal(false);}}><section className="rr-modal rr-modal-wide"><div className="rr-modal-head"><div><span className="rr-eyebrow">ACCOUNTS · NEW DOCUMENT</span><h2>Create invoice or receipt</h2><p>Link this document to the exact customer and project so finance updates the CRM sale.</p></div><button onClick={()=>setInvoiceModal(false)}><X size={19}/></button></div>
<form className="rr-modal-form" onSubmit={addBill}>
<label>Document type</label><div className="rr-segment"><button type="button" className={billForm.type==="Invoice"?"chosen":""} onClick={()=>{setBillForm({...billForm,type:"Invoice",linkedInvoiceId:""});setBillFormError("");}}><FileText size={16}/> Invoice</button><button type="button" className={billForm.type==="Cash receipt"?"chosen":""} onClick={()=>{setBillForm({...billForm,type:"Cash receipt",tax:"0"});setBillFormError("");}}><Wallet size={16}/> Cash receipt</button></div>
<div className="rr-two-field"><div><label>Customer / organisation name *</label><input required value={billForm.client} onChange={e=>setBillForm({...billForm,client:e.target.value})} placeholder="Customer or bill-to name"/></div><div><label>Email</label><input type="email" value={billForm.email} onChange={e=>setBillForm({...billForm,email:e.target.value})} placeholder="name@email.com"/></div></div>
<div className="rr-two-field"><div><label>Phone</label><input value={billForm.phone} onChange={e=>setBillForm({...billForm,phone:e.target.value})} placeholder="+91..."/></div><div><label>Link CRM lead / project</label><select value={billForm.leadId} onChange={e=>chooseBillLead(e.target.value)}><option value="">Auto-match by phone/email and project</option><option value="__none__">Standalone document — do not move CRM</option>{leads.map(lead=><option key={lead.id} value={lead.id}>{lead.name} · {lead.phone||lead.email||"No contact"} · {lead.project} · {stageForLead(lead,pipelineStages)?.name||lead.status}</option>)}</select></div></div>
{billForm.leadId===""&&billIdentityMatch.status==="matched"&&<div className="rr-settings-note"><Users size={17}/><p><b>Customer matched by {billIdentityMatch.matchedBy}.</b><br/>{billIdentityLeads.length===0?"No CRM opportunity is attached to this customer yet.":billIdentityLeads.length===1?`Possible CRM project: ${billIdentityLeads[0].project}. The project name must match to auto-link safely.`:"This customer has multiple CRM opportunities. Select the correct project above so RR moves the right sale."}</p></div>}
{billForm.leadId===""&&billIdentityMatch.status==="conflict"&&<div className="rr-login-error" role="alert">{billIdentityMatch.reason} Select the correct lead explicitly or correct the contact fields.</div>}
{billForm.type==="Cash receipt"&&<><label>Apply this receipt to an unpaid invoice</label><select value={billForm.linkedInvoiceId} onChange={e=>chooseReceiptInvoice(e.target.value)}><option value="">Auto-match one outstanding invoice using customer and project</option><option value="__none__">Unapplied receipt — do not change invoice balance</option>{invoices.filter(invoice=>invoice.type==="Invoice"&&total(invoice)>invoice.paid).map(invoice=><option key={invoice.id} value={invoice.id}>{invoice.id} · {invoiceClientLabel(invoice,clients)} · {invoice.project} · Balance {money(Math.max(0,total(invoice)-invoice.paid))}</option>)}</select><p className="rr-attach-hint">If the customer has multiple unpaid invoices, select the exact invoice. A receipt will update its paid amount and balance.</p></>}
<label>Project name *</label><input required value={billForm.project} onChange={e=>setBillForm({...billForm,project:e.target.value})} placeholder="Project / property name"/>
<label>Description *</label><input required value={billForm.description} onChange={e=>setBillForm({...billForm,description:e.target.value})}/>
<div className="rr-two-field"><div><label>Amount (₹) *</label><input type="number" min="0.01" step="0.01" required value={billForm.amount} onChange={e=>setBillForm({...billForm,amount:e.target.value})} placeholder="0.00"/></div><div><label>Tax rate</label><select disabled={billForm.type==="Cash receipt"} value={billForm.tax} onChange={e=>setBillForm({...billForm,tax:e.target.value})}><option value="0">0%</option><option value="5">5%</option><option value="12">12%</option><option value="18">18%</option><option value="28">28%</option></select></div></div>
<div className="rr-two-field"><div><label>Issue date</label><input type="date" value={billForm.date} onChange={e=>setBillForm({...billForm,date:e.target.value})}/></div><div><label>Payment due / receipt date</label><input type="date" value={billForm.due} onChange={e=>setBillForm({...billForm,due:e.target.value})}/></div></div>
{billForm.type==="Invoice"&&<><label>Payment already received (₹)</label><input type="number" min="0" step="0.01" value={billForm.paid} onChange={e=>setBillForm({...billForm,paid:e.target.value})}/></>}
{billFormError&&<div className="rr-login-error" role="alert">{billFormError}</div>}
<div className="rr-total-preview"><span>Document total <small>Tax included where applicable</small></span><b>{money((Number(billForm.amount)||0)*(1+(billForm.type==="Cash receipt"?0:Number(billForm.tax))/100))}</b></div>
<div className="rr-stage-start-note"><SlidersHorizontal size={16}/><span><b>Connected workflow</b><small>Saving an invoice moves the linked active sale to its configured invoice stage. A linked receipt updates the invoice balance and marks payment received; RR moves the sale to Won only when the signed-agreement and payment gates pass. Name alone is never used to auto-match.</small></span></div>
<div className="rr-modal-actions"><button type="button" className="rr-secondary" onClick={()=>setInvoiceModal(false)}>Cancel</button><button type="submit" className="rr-primary">{billForm.type==="Cash receipt"?"Record receipt":"Save invoice"} <Check size={16}/></button></div>
</form></section></div>}{selectedLead&&<div className="rr-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setSelectedLead(null);}}><section className="rr-modal rr-modal-wide"><div className="rr-modal-head"><div><span className="rr-eyebrow">{selectedLead.id} · LEAD PROFILE</span><h2>{selectedLead.name}</h2><p>{selectedLead.project}</p></div><button onClick={()=>setSelectedLead(null)}><X size={19}/></button></div>
{selectedLeadError&&<div className="rr-login-error" role="alert">{selectedLeadError}</div>}
<div className="rr-detail-list"><div><span>Lead received</span><b>{selectedLead.date}</b></div><div><span>Source</span><b>{selectedLead.source}</b></div><div><span>Current stage</span><b>{stageForLead(selectedLead,pipelineStages)?.name||selectedLead.status}</b></div></div>
<label className="rr-detail-status-label">Move to pipeline stage</label><select className="rr-detail-status" value={stageForLead(selectedLead,pipelineStages)?.id||""} onChange={e=>transitionLead(selectedLead.id,e.target.value)}>{activeStages.filter(stage=>stage.active||stage.id===stageForLead(selectedLead,pipelineStages)?.id).map(stage=><option key={stage.id} value={stage.id}>{stage.name}</option>)}</select>
<div className="rr-profile-field-grid">
<label>Customer / organisation<input value={selectedLead.name} onChange={e=>updateSelectedLeadField("name",e.target.value)}/></label>
<label>Email<input type="email" value={selectedLead.email} onChange={e=>updateSelectedLeadField("email",e.target.value)}/></label>
<label>Phone<input value={selectedLead.phone} onChange={e=>updateSelectedLeadField("phone",e.target.value)}/></label>
<label>Project / requirement<input value={selectedLead.project} onChange={e=>updateSelectedLeadField("project",e.target.value)}/></label>
<label>Service type<select value={selectedLead.serviceType||""} onChange={e=>updateSelectedLeadField("serviceType",e.target.value)}><option value="">Not selected</option><option>Residential turnkey</option><option>Commercial / corporate</option><option>Renovation</option><option>Design-only</option><option>Modular kitchen / wardrobes</option><option>Furniture / individual work</option><option>Other / unsure</option></select></label>
<label>Property / project location<input value={selectedLead.location||""} onChange={e=>updateSelectedLeadField("location",e.target.value)} placeholder="Area / city"/></label>
<label>Approximate area<input value={selectedLead.area||""} onChange={e=>updateSelectedLeadField("area",e.target.value)} placeholder="e.g. 1,800 sq. ft."/></label>
<label>Estimated budget<input value={selectedLead.budget} onChange={e=>updateSelectedLeadField("budget",e.target.value)} placeholder="Range or amount"/></label>
<label>Expected start timeline<select value={selectedLead.timeline||""} onChange={e=>updateSelectedLeadField("timeline",e.target.value)}><option value="">Not discussed</option><option>Immediately</option><option>Within 1 month</option><option>1–3 months</option><option>3–6 months</option><option>6+ months</option><option>Flexible / exploring</option></select></label>
<label>Next action<input value={selectedLead.nextAction||""} onChange={e=>updateSelectedLeadField("nextAction",e.target.value)} placeholder="What must happen next?"/></label>
<label>Follow-up date<input type="date" value={selectedLead.nextFollowUpDate||""} onChange={e=>updateSelectedLeadField("nextFollowUpDate",e.target.value)}/></label>
<label>Lost / disqualification reason<input value={selectedLead.lostReason||""} onChange={e=>updateSelectedLeadField("lostReason",e.target.value)} placeholder="Required when closing as lost"/></label>
<label>Agreement status<select value={selectedLead.agreementStatus||"not-started"} onChange={e=>updateSelectedLeadField("agreementStatus",e.target.value as AgreementStatus)}><option value="not-started">Not started</option><option value="sent">Sent for signature</option><option value="signed">Signed (manually verified)</option></select></label>
<label>Initial payment status<select value={selectedLead.advanceStatus||"not-requested"} onChange={e=>updateSelectedLeadField("advanceStatus",e.target.value as AdvanceStatus)}><option value="not-requested">Not requested</option><option value="due">Due / awaiting payment</option><option value="received">Received (manually verified)</option><option value="waived">Authorised exception / waived</option></select></label>
{selectedLead.advanceStatus==="waived"&&<label className="rr-profile-full">Reason for payment exception<input value={selectedLead.advanceExceptionReason||""} onChange={e=>updateSelectedLeadField("advanceExceptionReason",e.target.value)} placeholder="Who approved it and why"/></label>}
<label className="rr-profile-full">Conversation notes<textarea rows={4} value={selectedLead.notes} onChange={e=>updateSelectedLeadField("notes",e.target.value)} placeholder="Record the last conversation, objections and decisions."/></label>
</div>
<div className="rr-stage-start-note"><Check size={16}/><span><b>Operational rule</b><small>Moving a lead to Won requires a signed-agreement check and initial payment received or a documented authorised exception. These checks are manual until signing/payment integration is connected.</small></span></div>
<div className="rr-modal-actions"><button className="rr-secondary" onClick={()=>setSelectedLead(null)}>Close</button><button className="rr-primary" onClick={()=>{if(selectedLead.email?.trim())window.open(emailUrl(selectedLead.email,`Following up: ${selectedLead.project} — RR Creative Interiors`,`Dear ${selectedLead.name},\n\nThank you for reaching out to RR Creative Interiors about ${selectedLead.project}. The next step is: ${selectedLead.nextAction||"a short follow-up conversation"}.\n\nWarm regards,\n${studioName}`),"_blank","noopener,noreferrer");else setNotice("Add an email address before drafting an email follow-up.");}}><Mail size={16}/> Draft follow-up</button></div></section></div>}{selectedInvoice&&<div className="rr-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)setSelectedInvoice(null);}}><section className="rr-modal"><div className="rr-modal-head"><div><span className="rr-eyebrow">DOCUMENT DETAILS</span><h2>{selectedInvoice.type}</h2><p>{selectedInvoice.id}</p></div><button onClick={()=>setSelectedInvoice(null)}><X size={19}/></button></div><div className="rr-doc-preview"><div className="rr-doc-brand">RR <span>CREATIVE INTERIORS</span></div><div className="rr-doc-preview-kind">{selectedInvoice.type.toUpperCase()}</div><h3>{invoiceClientLabel(selectedInvoice,clients)}</h3><p>{invoiceClientEmail(selectedInvoice,clients)}{invoiceClientPhone(selectedInvoice,clients)?` · ${invoiceClientPhone(selectedInvoice,clients)}`:""}</p><p className="rr-cell-note">{selectedInvoice.project}</p><p className="rr-attach-hint">The preview shows current customer contact details; saved document PDFs retain the bill-to details recorded when the document was created.</p><div className="rr-doc-line"><span>{selectedInvoice.description}</span><b>{money(selectedInvoice.amount)}</b></div><div className="rr-doc-line"><span>Tax ({selectedInvoice.tax}%)</span><b>{money(total(selectedInvoice)-selectedInvoice.amount)}</b></div><div className="rr-doc-total"><span>Total</span><b>{money(total(selectedInvoice))}</b></div><div className="rr-doc-line"><span>Received</span><b>{money(selectedInvoice.paid)}</b></div><div className="rr-doc-line"><span>Balance due</span><b>{money(Math.max(0,total(selectedInvoice)-selectedInvoice.paid))}</b></div></div><div className="rr-document-notice"><Download size={17}/><p><b>Download / save as PDF</b><br/>Opens a print-ready A4 document. Choose “Save as PDF” in the browser print dialog.</p></div><div className="rr-modal-actions rr-doc-actions"><button className="rr-secondary" onClick={()=>printDocument(selectedInvoice)}><Download size={16}/> Print / PDF</button><button className="rr-primary" onClick={()=>draftEmail(selectedInvoice)}><Mail size={16}/> Draft email</button></div><p className="rr-attach-hint">Attach the saved PDF manually in Gmail before sending. Email providers do not allow a website to silently attach a local file.</p></section></div>}
</main>;
}
