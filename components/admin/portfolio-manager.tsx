"use client";

import { upload } from "@vercel/blob/client";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle, Check, Eye, EyeOff, FileImage, Film, FolderOpen, LoaderCircle,
  Plus, RefreshCw, Trash2, Upload, X
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { SITE_IMAGE_SLOTS, type SiteImageSlot } from "@/lib/site-image-slots";

type PortfolioAsset = {
  id: string;
  url: string;
  pathname: string;
  contentType: string;
  kind: "image" | "video";
  title: string;
  project: string;
  description: string;
  category: string;
  published: boolean;
  siteSlot?: SiteImageSlot;
  createdAt: string;
};

const categories = ["Residential", "Kitchen & wardrobes", "Commercial", "Office", "Details & materials", "Other"];

export default function PortfolioManager() {
  const [items, setItems] = useState<PortfolioAsset[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [project, setProject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Residential");
  const [siteSlot, setSiteSlot] = useState<SiteImageSlot>("gallery");
  const [published, setPublished] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploadPercent, setUploadPercent] = useState(0);
  const [uploadIndex, setUploadIndex] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [storageHelp, setStorageHelp] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const reduceMotion = useReducedMotion();

  const refresh = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const response = await fetch("/api/admin/portfolio", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setItems([]);
        setStorageHelp(response.status === 503);
        throw new Error(data.error || "The portfolio library could not be loaded.");
      }
      setItems(Array.isArray(data.items) ? data.items : []);
      setStorageHelp(false);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The portfolio library could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/admin/portfolio", { cache: "no-store" })
      .then(async (response) => ({ response, data: await response.json().catch(() => ({})) }))
      .then(({ response, data }) => {
        if (!active) return;
        if (!response.ok) {
          setItems([]);
          setStorageHelp(response.status === 503);
          setError(data.error || "The portfolio library could not be loaded.");
          return;
        }
        setItems(Array.isArray(data.items) ? data.items : []);
        setStorageHelp(false);
        setError("");
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : "The portfolio library could not be loaded.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function onUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setNotice("");
    if (!project.trim()) {
      setError("Add the project name before uploading media.");
      return;
    }
    if (!files.length) {
      setError("Choose one or more photos or video clips first.");
      return;
    }
    if (siteSlot !== "gallery" && files.length > 1) {
      setError("Choose one file when assigning it to a specific website placement. Multiple files can be added to the portfolio gallery.");
      return;
    }
    if (siteSlot !== "gallery" && files.some((file) => !file.type.startsWith("image/"))) {
      setError("Website logo and image placements accept photos only. Videos belong in the portfolio gallery.");
      return;
    }
    const invalid = files.find((file) => {
      const allowed = file.type.startsWith("image/") || ["video/mp4", "video/webm", "video/quicktime"].includes(file.type);
      const limit = file.type.startsWith("video/") ? 150 * 1024 * 1024 : 30 * 1024 * 1024;
      return !allowed || file.size > limit;
    });
    if (invalid) {
      setError(`${invalid.name} is unsupported or too large. Photos must be under 30 MB and videos under 150 MB.`);
      return;
    }

    setBusy(true);
    let uploadedCount = 0;
    try {
      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        setUploadIndex(index + 1);
        setUploadPercent(0);
        const safeName = file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "portfolio-media";
        const blob = await upload(`rr-creative-interiors/portfolio/${Date.now()}-${index}-${safeName}`, file, {
          access: "public",
          handleUploadUrl: "/api/admin/portfolio/upload",
          multipart: file.size > 4.5 * 1024 * 1024,
          onUploadProgress: ({ percentage }) => setUploadPercent(Math.round(percentage)),
        });
        const mediaTitle = title.trim()
          ? (files.length === 1 ? title.trim() : `${title.trim()} · ${index + 1}`)
          : file.name.replace(/\.[^.]+$/, "");
        const response = await fetch("/api/admin/portfolio", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: blob.url,
            pathname: blob.pathname,
            contentType: blob.contentType || file.type,
            title: mediaTitle,
            project: project.trim(),
            description: description.trim(),
            category,
            published,
            siteSlot,
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || `Could not save metadata for ${file.name}.`);
        uploadedCount += 1;
      }
      setFiles([]);
      setTitle("");
      setDescription("");
      setSiteSlot("gallery");
      if (inputRef.current) inputRef.current.value = "";
      setNotice(`${uploadedCount} media ${uploadedCount === 1 ? "item" : "items"} uploaded successfully. ${published ? "Published items will appear in the website portfolio." : "Items are saved as drafts."}`);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The upload failed. Please try again.");
      await refresh();
    } finally {
      setBusy(false);
      setUploadPercent(0);
      setUploadIndex(0);
    }
  }

  async function updatePublished(item: PortfolioAsset) {
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/portfolio", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, published: !item.published }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not update publish status.");
      setItems((previous) => previous.map((entry) => entry.id === item.id ? data.item : entry));
      setNotice(!item.published ? "Project published to the public portfolio." : "Project moved to drafts.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update publish status.");
    }
  }

  async function updateSiteSlot(item: PortfolioAsset, nextSlot: SiteImageSlot) {
    if (item.siteSlot === nextSlot || busy) return;
    if (nextSlot !== "gallery" && item.kind !== "image") {
      setError("Only photos can be assigned to a logo or website image placement.");
      return;
    }
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/portfolio", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, siteSlot: nextSlot }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not update the website placement.");
      await refresh();
      const placement = SITE_IMAGE_SLOTS.find((slot) => slot.value === nextSlot)?.label || "Portfolio gallery";
      setNotice(nextSlot === "gallery" ? `“${item.title}” is back in the public portfolio gallery.` : `“${item.title}” now controls: ${placement}.`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update the website placement.");
    }
  }

  async function removeItem(item: PortfolioAsset) {
    if (!window.confirm(`Remove “${item.title}” from the portfolio? This also deletes the uploaded file.`)) return;
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/admin/portfolio?id=${encodeURIComponent(item.id)}`, { method: "DELETE" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not remove this media item.");
      setItems((previous) => previous.filter((entry) => entry.id !== item.id));
      setNotice("Portfolio item and uploaded file removed.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not remove this media item.");
    }
  }

  return (
    <section className="rr-portfolio-manager">
      <div className="rr-page-heading">
        <div>
          <span className="rr-eyebrow">THE WORK, PRESENTED WITH INTENTION</span>
          <h1>Website assets &amp; portfolio</h1>
          <p>Replace the logo, choose the photos used across the homepage, and publish your finished work. Changes appear on the live site after publishing.</p>
        </div>
        <button className="rr-primary" type="button" onClick={() => inputRef.current?.click()}>
          <Plus size={17} /> Add media
        </button>
      </div>

      <div className="rr-library-summary">
        <div><span>Library items</span><b>{items.length.toString().padStart(2, "0")}</b></div>
        <div><span>Published to website</span><b>{items.filter((item) => item.published).length.toString().padStart(2, "0")}</b></div>
        <div><span>Drafts</span><b>{items.filter((item) => !item.published).length.toString().padStart(2, "0")}</b></div>
      </div>

      {storageHelp && (
        <div className="rr-portfolio-storage-help">
          <AlertCircle size={19} />
          <div>
            <b>Connect the media library once in Vercel</b>
            <p>Create the connected Vercel Blob media store and set <code>BLOB_READ_WRITE_TOKEN</code> plus the admin environment values in Preview and Production. Uploaded photos and logos are public website assets; only administrators can upload, publish, replace or remove them.</p>
          </div>
        </div>
      )}

      {error && <div className="rr-portfolio-message is-error"><AlertCircle size={16} />{error}<button onClick={() => setError("")} aria-label="Dismiss error"><X size={15} /></button></div>}
      {notice && <div className="rr-portfolio-message is-success"><Check size={16} />{notice}<button onClick={() => setNotice("")} aria-label="Dismiss message"><X size={15} /></button></div>}

      <section className="rr-panel rr-upload-panel">
        <div className="rr-panel-heading">
          <div><h2>New project media</h2><p>One project name can be applied to a batch of photos and clips.</p></div>
          <span className="rr-upload-lock"><FolderOpen size={16} /> Private admin action</span>
        </div>
        <form className="rr-portfolio-upload-form" onSubmit={onUpload}>
          <label className="rr-dropzone" htmlFor="rr-portfolio-files">
            <input
              ref={inputRef}
              id="rr-portfolio-files"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif,image/heic,video/mp4,video/webm,video/quicktime"
              multiple
              disabled={busy}
              onChange={(event) => setFiles(Array.from(event.target.files || []))}
            />
            <span className="rr-dropzone-icon"><Upload size={22} /></span>
            <b>{files.length ? `${files.length} file${files.length === 1 ? "" : "s"} selected` : "Drop project media here or browse files"}</b>
            <small>JPG, PNG, WEBP, AVIF · MP4, MOV, WEBM</small>
            <small>Up to 30 MB per photo and 150 MB per video</small>
          </label>
          {files.length > 0 && (
            <div className="rr-selected-files">
              {files.map((file) => <span key={`${file.name}-${file.size}`}>{file.type.startsWith("video/") ? <Film size={13} /> : <FileImage size={13} />}{file.name}<small>{(file.size / (1024 * 1024)).toFixed(1)} MB</small></span>)}
              <button type="button" onClick={() => { setFiles([]); if (inputRef.current) inputRef.current.value = ""; }} disabled={busy} aria-label="Clear selected files"><X size={15} /></button>
            </div>
          )}
          <div className="rr-portfolio-form-grid">
            <label className="rr-wide-field">Website placement <small>Optional</small><select value={siteSlot} onChange={(event) => setSiteSlot(event.target.value as SiteImageSlot)} disabled={busy}>{SITE_IMAGE_SLOTS.map((slot) => <option key={slot.value} value={slot.value}>{slot.label}</option>)}</select><small>{SITE_IMAGE_SLOTS.find((slot) => slot.value === siteSlot)?.help}</small></label>
            <label>Project name <span>*</span><input value={project} onChange={(e) => setProject(e.target.value)} placeholder="e.g. Indiranagar residence" maxLength={140} required disabled={busy} /></label>
            <label>Media title <small>Optional</small><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Warm oak living room" maxLength={140} disabled={busy} /></label>
            <label>Category<select value={category} onChange={(e) => setCategory(e.target.value)} disabled={busy}>{categories.map((value) => <option key={value}>{value}</option>)}</select></label>
            <label className="rr-publish-check"><input type="checkbox" checked={published} onChange={(e) => setPublished(e.target.checked)} disabled={busy} /><span><b>Publish when uploaded</b><small>Published assets appear in the public website gallery.</small></span></label>
            <label className="rr-description-field">Caption / description<textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="A sentence about the design idea, materials, or project brief." maxLength={600} rows={3} disabled={busy} /></label>
          </div>
          {busy && <div className="rr-upload-progress"><div><span>{`Uploading ${uploadIndex} of ${files.length}`}</span><b>{uploadPercent}%</b></div><span className="rr-upload-track"><i style={{ width: `${uploadPercent}%` }} /></span></div>}
          <div className="rr-upload-form-footer">
            <p>Large files upload directly to storage. Only published items are shown on the public portfolio page.</p>
            <button className="rr-primary" type="submit" disabled={busy || files.length === 0 || !project.trim()}>
              {busy ? <LoaderCircle className="rr-spinning" size={16} /> : <Upload size={16} />}
              {busy ? "Uploading media…" : "Upload to portfolio"}
            </button>
          </div>
        </form>
      </section>

      <div className="rr-library-heading">
        <div><h2>Project media</h2><p>Your published work and drafts, in one place.</p></div>
        <button className="rr-secondary" type="button" onClick={() => void refresh(true)} disabled={loading}><RefreshCw size={15} /> Refresh library</button>
      </div>
      {loading ? (
        <div className="rr-library-empty"><LoaderCircle className="rr-spinning" size={21} /><span>Loading your portfolio…</span></div>
      ) : items.length === 0 ? (
        <div className="rr-library-empty"><FolderOpen size={25} /><b>Your next project starts here.</b><span>Upload the finished photos or a short video walkthrough to begin building the library.</span></div>
      ) : (
        <div className="rr-portfolio-grid">
          {items.map((item, index) => (
            <motion.article
              key={item.id}
              className="rr-portfolio-card"
              initial={reduceMotion ? false : { opacity: 0, transform: "translateY(12px)" }}
              animate={{ opacity: 1, transform: "translateY(0px)" }}
              transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1], delay: reduceMotion ? 0 : (index % 5) * 0.035 }}
            >
              <div className="rr-portfolio-preview">
                {item.kind === "video" ? <video src={item.url} controls preload="metadata" playsInline aria-label={item.title} /> : <img src={item.url} alt={item.title} loading="lazy" />}
                <span className={`rr-published-pill ${item.published ? "is-published" : "is-draft"}`}>{item.published ? "Published" : "Draft"}</span>
                <span className="rr-portfolio-kind">{item.kind === "video" ? <Film size={13} /> : <FileImage size={13} />}{item.kind}</span>
              </div>
              <div className="rr-portfolio-card-body">
                <span className="rr-portfolio-category">{item.category}</span>
                <h3>{item.title}</h3>
                <p className="rr-portfolio-project">{item.project}</p>
                <label className="rr-asset-placement"><span>Website placement</span><select aria-label={`Website placement for ${item.title}`} value={item.siteSlot || "gallery"} onChange={(event) => void updateSiteSlot(item, event.target.value as SiteImageSlot)}>{SITE_IMAGE_SLOTS.filter((slot) => item.kind === "image" || slot.value === "gallery").map((slot) => <option key={slot.value} value={slot.value}>{slot.label}</option>)}</select><small>{SITE_IMAGE_SLOTS.find((slot) => slot.value === (item.siteSlot || "gallery"))?.help}</small></label>
                {item.description && <p className="rr-portfolio-caption">{item.description}</p>}
                <div className="rr-portfolio-card-actions">
                  <button className="rr-secondary" type="button" onClick={() => void updatePublished(item)}>{item.published ? <EyeOff size={14} /> : <Eye size={14} />}{item.published ? "Unpublish" : "Publish"}</button>
                  <button className="rr-danger-action" type="button" onClick={() => void removeItem(item)} aria-label={`Delete ${item.title}`}><Trash2 size={15} /></button>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      )}
    </section>
  );
}
