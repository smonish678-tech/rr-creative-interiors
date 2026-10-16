"use client";

import { upload } from "@vercel/blob/client";
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { AlertCircle, Check, FileImage, ImagePlus, LoaderCircle, RefreshCw, Trash2, Upload } from "lucide-react";
import { WEBSITE_ASSET_GROUPS, type WebsiteAssetAssignments, type WebsiteAssetRecord, type WebsiteAssetSlot } from "@/lib/website-assets";

type ManagerConfig = { assets: WebsiteAssetRecord[]; assignments: WebsiteAssetAssignments };

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function requestWebsiteAssetConfig(): Promise<ManagerConfig> {
  const response = await fetch("/api/admin/site-assets", { cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "The website asset library could not be loaded.");
  return {
    assets: Array.isArray(data.assets) ? data.assets : [],
    assignments: data.assignments && typeof data.assignments === "object" ? data.assignments : {},
  };
}

export default function WebsiteAssetsManager() {
  const [assets, setAssets] = useState<WebsiteAssetRecord[]>([]);
  const [assignments, setAssignments] = useState<WebsiteAssetAssignments>({});
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [savingAssignments, setSavingAssignments] = useState(false);
  const [uploadIndex, setUploadIndex] = useState(0);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedPreview, setSelectedPreview] = useState<string>("");
  const assignmentQueue = useRef<Promise<void>>(Promise.resolve());

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const config = await requestWebsiteAssetConfig();
      setAssets(config.assets);
      setAssignments(config.assignments);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The website asset library could not be loaded.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    requestWebsiteAssetConfig()
      .then((config) => {
        if (!active) return;
        setAssets(config.assets);
        setAssignments(config.assignments);
      })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "The website asset library could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  const assetById = new Map<string, WebsiteAssetRecord>(assets.map((asset) => [asset.id, asset] as const));
  const assignedIds = new Set(Object.values(assignments).filter((id): id is string => typeof id === "string" && Boolean(id)));

  async function saveAssignment(slot: WebsiteAssetSlot, id: string) {
    const next: WebsiteAssetAssignments = { ...assignments };
    if (id) next[slot] = id;
    else delete next[slot];
    setAssignments(next);
    setSavingAssignments(true);
    setError("");
    setNotice("");
    assignmentQueue.current = assignmentQueue.current.catch(() => undefined).then(async () => {
      const response = await fetch("/api/admin/site-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "assignments", assignments: next }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "The website image assignment could not be saved.");
      setAssignments(data.assignments || next);
      setNotice("Website changes saved. The public site now uses the selected image.");
    }).catch((cause) => {
      setError(cause instanceof Error ? cause.message : "The website image assignment could not be saved.");
      void refresh();
    }).finally(() => setSavingAssignments(false));
    await assignmentQueue.current;
  }

  async function onUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!files.length || busy) return;
    const websiteImageTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
    if (files.some((file) => !websiteImageTypes.has(file.type))) {
      setError("Upload image files only. Use the Portfolio library for video.");
      return;
    }
    if (files.some((file) => file.size > 30 * 1024 * 1024)) {
      setError("Each image must be 30 MB or smaller.");
      return;
    }

    setBusy(true);
    setError("");
    setNotice("");
    let savedCount = 0;
    try {
      for (const [index, file] of files.entries()) {
        setUploadIndex(index + 1);
        setUploadPercent(0);
        const safeName = file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "website-image";
        const blob = await upload(`rr-creative-interiors/site-assets/${Date.now()}-${index}-${safeName}`, file, {
          access: "public",
          handleUploadUrl: "/api/admin/portfolio/upload",
          clientPayload: JSON.stringify({ purpose: "rr-creative-interiors-site-assets" }),
          onUploadProgress: ({ percentage }) => setUploadPercent(Math.round(percentage)),
        });
        const response = await fetch("/api/admin/site-assets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "addAsset",
            url: blob.url,
            pathname: blob.pathname,
            contentType: file.type || "image/jpeg",
            fileName: file.name,
            sizeBytes: file.size,
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || `Could not save ${file.name} to the website image library.`);
        setAssets((current) => [data.asset as WebsiteAssetRecord, ...current]);
        savedCount += 1;
      }
      setNotice(`${savedCount} image${savedCount === 1 ? "" : "s"} uploaded. Assign each image to a website section below to publish it.`);
      setFiles([]);
      const input = document.getElementById("rr-website-asset-files") as HTMLInputElement | null;
      if (input) input.value = "";
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The image upload failed. Check your connection and try again.");
      await refresh();
    } finally {
      setBusy(false);
      setUploadIndex(0);
      setUploadPercent(0);
    }
  }

  async function removeAsset(asset: WebsiteAssetRecord) {
    if (assignedIds.has(asset.id)) {
      setError("This image is currently in use. Assign another image to that website slot before deleting it.");
      return;
    }
    if (!window.confirm(`Delete “${asset.fileName}” from the website image library? This also deletes the uploaded file.`)) return;
    setError("");
    try {
      const response = await fetch(`/api/admin/site-assets?id=${encodeURIComponent(asset.id)}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not delete the image.");
      setAssets((current) => current.filter((item) => item.id !== asset.id));
      setNotice("Image removed from the website library.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not delete the image.");
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFiles(Array.from(event.target.files || []));
    setError("");
    setNotice("");
  }

  return (
    <section className="rr-website-assets-manager">
      <div className="rr-page-heading">
        <div>
          <span className="rr-eyebrow">PUBLIC WEBSITE · BRAND & PHOTOGRAPHY</span>
          <h1>Website studio</h1>
          <p>Change the logo and choose which real project photographs appear in the opening story and editorial sections. Changes save as you assign them.</p>
        </div>
        <button className="rr-secondary" type="button" onClick={() => void refresh()} disabled={loading || busy}>
          {loading ? <LoaderCircle className="rr-spinning" size={15}/> : <RefreshCw size={15}/>} Refresh library
        </button>
      </div>

      <div className="rr-website-assets-note">
        <ImagePlus size={19}/>
        <div><b>One image library. A deliberate website.</b><p>Upload a photo once, then assign it to any section. Use your real finished work wherever possible. A transparent PNG or WebP works best for the logo; wide, high-resolution photos work best for the scroll story.</p></div>
      </div>

      {error && <div className="rr-portfolio-message is-error"><AlertCircle size={16}/>{error}<button type="button" onClick={() => setError("")} aria-label="Dismiss error">×</button></div>}
      {notice && <div className="rr-portfolio-message is-success"><Check size={16}/>{notice}<button type="button" onClick={() => setNotice("")} aria-label="Dismiss message">×</button></div>}

      <section className="rr-panel rr-upload-panel">
        <div className="rr-panel-heading"><div><h2>Upload logo or photography</h2><p>JPG, PNG, WebP or AVIF · up to 30 MB each</p></div><span className="rr-upload-lock"><Upload size={15}/> Admin only</span></div>
        <form className="rr-portfolio-upload-form" onSubmit={onUpload}>
          <label className="rr-dropzone" htmlFor="rr-website-asset-files">
            <input id="rr-website-asset-files" type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif" onChange={handleFileChange} disabled={busy}/>
            <span className="rr-dropzone-icon"><ImagePlus size={22}/></span>
            <b>Choose your logo or project photos</b>
            <small>You can select several images at once. Uploads are saved to the RR website image library.</small>
          </label>
          {files.length > 0 && <div className="rr-selected-files">{files.map((file) => <span key={`${file.name}-${file.size}`}><FileImage size={13}/>{file.name}<small>{formatBytes(file.size)}</small></span>)}</div>}
          {busy && <div className="rr-upload-progress"><div><span>Uploading {uploadIndex} of {files.length}</span><b>{uploadPercent}%</b></div><span className="rr-upload-track"><i style={{ width: `${uploadPercent}%` }}/></span></div>}
          <div className="rr-upload-form-footer"><p>Uploading does not replace anything by itself. After upload, choose the image for the logo or website section below. This prevents an accidental photo from becoming the new logo.</p><button type="submit" className="rr-primary" disabled={busy || files.length===0}>{busy ? <LoaderCircle className="rr-spinning" size={15}/> : <Upload size={15}/>} {busy ? "Uploading…" : "Upload to website library"}</button></div>
        </form>
      </section>

      {WEBSITE_ASSET_GROUPS.map((group) => (
        <section className="rr-website-asset-group" key={group.title}>
          <div className="rr-library-heading"><div><h2>{group.title}</h2><p>{group.description}</p></div></div>
          <div className="rr-website-slot-grid">
            {group.slots.map((slot) => {
              const selectedId = assignments[slot.key] || "";
              const selected = selectedId ? assetById.get(selectedId) : undefined;
              return (
                <article className={`rr-website-slot-card${slot.key==="logo" ? " rr-website-logo-slot" : ""}`} key={slot.key}>
                  <div className={`rr-website-slot-preview${slot.key==="logo" ? " is-logo-preview" : ""}`}>
                    {selected ? <img src={selected.url} alt={slot.label}/> : <div className="rr-website-slot-empty"><ImagePlus size={20}/><span>Using the site fallback</span></div>}
                    {selected && <span className="rr-website-slot-status"><Check size={12}/> Assigned</span>}
                  </div>
                  <div className="rr-website-slot-body">
                    <b>{slot.label}</b><p>{slot.hint}</p>
                    <label className="rr-website-slot-select"><span>Use image</span><select value={selectedId} onChange={(event) => void saveAssignment(slot.key, event.target.value)} disabled={busy || savingAssignments || loading}><option value="">Use default website image</option>{assets.map((asset) => <option value={asset.id} key={asset.id}>{asset.fileName}</option>)}</select></label>
                    {selected && <button type="button" className="rr-website-unassign" onClick={() => void saveAssignment(slot.key, "")} disabled={busy || savingAssignments}>Clear this slot</button>}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}

      <section className="rr-website-asset-library">
        <div className="rr-library-heading"><div><h2>Website image library</h2><p>{assets.length} uploaded image{assets.length===1 ? "" : "s"} · {assignedIds.size} active assignment{assignedIds.size===1 ? "" : "s"}</p></div><span className="rr-site-asset-save-status">{savingAssignments ? <><LoaderCircle className="rr-spinning" size={13}/> Saving…</> : <><Check size={13}/> {notice ? "Changes saved" : "Ready to edit"}</>}</span></div>
        {loading ? <div className="rr-library-empty"><LoaderCircle className="rr-spinning" size={20}/><span>Loading the website image library…</span></div> : assets.length===0 ? <div className="rr-library-empty"><ImagePlus size={25}/><b>Your image library is empty.</b><span>Upload the new logo and actual RR project photographs above, then assign them to the website.</span></div> : (
          <div className="rr-site-asset-library-grid">
            {assets.map((asset) => (
              <article key={asset.id} className="rr-site-asset-card">
                <button type="button" className="rr-site-asset-image" onClick={() => setSelectedPreview(asset.url)} aria-label={`Preview ${asset.fileName}`}><img src={asset.url} alt={asset.fileName}/></button>
                <div className="rr-site-asset-card-body"><b title={asset.fileName}>{asset.fileName}</b><small>{formatBytes(asset.sizeBytes)} · {new Date(asset.createdAt).toLocaleDateString("en-IN")}</small><div className="rr-site-asset-actions">{assignedIds.has(asset.id) ? <span className="rr-site-assigned-tag"><Check size={12}/> In use</span> : <span className="rr-site-unassigned-tag">Not assigned</span>}<button type="button" disabled={assignedIds.has(asset.id) || busy} onClick={() => void removeAsset(asset)} title={assignedIds.has(asset.id) ? "Replace assignment before deleting" : "Delete image"}><Trash2 size={14}/></button></div></div>
              </article>
            ))}
          </div>
        )}
      </section>

      {selectedPreview && <div className="rr-site-image-lightbox" role="dialog" aria-modal="true" aria-label="Image preview" onMouseDown={(event) => { if(event.target===event.currentTarget)setSelectedPreview(""); }}><button type="button" onClick={() => setSelectedPreview("")} aria-label="Close image preview">×</button><img src={selectedPreview} alt="Selected website asset preview"/></div>}
    </section>
  );
}
