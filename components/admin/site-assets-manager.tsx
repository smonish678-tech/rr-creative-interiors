"use client";

import { upload } from "@vercel/blob/client";
import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Check, FileImage, Image as ImageIcon, LoaderCircle, RefreshCw, Trash2, Upload } from "lucide-react";
import { SITE_ASSET_GROUPS, type SiteAssetKey, type SiteAssetManifest } from "@/lib/site-assets";

export default function SiteAssetsManager() {
  const [assets, setAssets] = useState<SiteAssetManifest>({});
  const [groupId, setGroupId] = useState<string>("brand");
  const [loading, setLoading] = useState(true);
  const [uploadingKey, setUploadingKey] = useState<SiteAssetKey | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/site-assets", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Website assets could not be loaded.");
      setAssets(data.assets || {});
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Website assets could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  async function replaceAsset(key: SiteAssetKey, file: File) {
    setError("");
    setNotice("");
    if (!file.type.startsWith("image/") || !["image/jpeg", "image/png", "image/webp", "image/avif", "image/heic"].includes(file.type)) {
      setError("Choose a JPG, PNG, WebP, AVIF or HEIC image. SVG files are not accepted.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("This image is larger than 20 MB. Please export a smaller web-ready version first.");
      return;
    }

    setUploadingKey(key);
    setProgress(0);
    try {
      const safeName = file.name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "website-image";
      const blob = await upload(
        `rr-creative-interiors/site-assets/uploads/${key}-${Date.now()}-${safeName}`,
        file,
        {
          access: "public",
          handleUploadUrl: "/api/admin/site-assets/upload",
          onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)),
        }
      );
      const response = await fetch("/api/admin/site-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key,
          asset: {
            url: blob.url,
            pathname: blob.pathname,
            contentType: blob.contentType || file.type,
            updatedAt: new Date().toISOString(),
          },
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "The image uploaded, but its website slot could not be updated.");
      setAssets(data.assets || {});
      setNotice("Website image replaced. Refresh the public website to see the new version.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The image could not be uploaded.");
    } finally {
      setUploadingKey(null);
      setProgress(0);
    }
  }

  async function restoreDefault(key: SiteAssetKey) {
    if (!window.confirm("Restore the built-in default for this slot? The uploaded image remains in storage but will no longer be used here.")) return;
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/site-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, remove: true }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "The default image could not be restored.");
      setAssets(data.assets || {});
      setNotice("Built-in image restored for this slot.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The default image could not be restored.");
    }
  }

  const currentGroup = SITE_ASSET_GROUPS.find((group) => group.id === groupId) || SITE_ASSET_GROUPS[0];
  const configuredCount = Object.keys(assets).length;

  return (
    <section className="rr-site-assets">
      <div className="rr-page-heading">
        <div>
          <span className="rr-eyebrow">BRAND · PHOTOGRAPHY · CONTROL</span>
          <h1>Website & brand</h1>
          <p>Change the logo and homepage photography yourself. Uploads are stored in RR's media library and take effect without editing the website source code.</p>
        </div>
        <button type="button" className="rr-secondary" onClick={() => void refresh()} disabled={loading || Boolean(uploadingKey)}>
          <RefreshCw size={15}/> Refresh settings
        </button>
      </div>

      <div className="rr-site-assets-stats">
        <div><span>Image slots customised</span><b>{configuredCount} / {SITE_ASSET_GROUPS.reduce((sum, group) => sum + group.slots.length, 0)}</b></div>
        <div><span>Upload limit</span><b>20 MB / image</b></div>
        <div><span>File types</span><b>JPG · PNG · WebP · AVIF</b></div>
      </div>

      {error && <div className="rr-portfolio-message is-error"><AlertCircle size={16}/>{error}</div>}
      {notice && <div className="rr-portfolio-message is-success"><Check size={16}/>{notice}</div>}

      <div className="rr-site-assets-layout">
        <nav className="rr-site-assets-tabs" aria-label="Website asset groups">
          {SITE_ASSET_GROUPS.map((group) => (
            <button key={group.id} type="button" className={groupId === group.id ? "is-active" : ""} onClick={() => setGroupId(group.id)}>
              <span>{group.title}</span>
              <small>{group.slots.filter((slot) => Boolean(assets[slot.key])).length}/{group.slots.length} customised</small>
            </button>
          ))}
          <div className="rr-site-assets-tip">
            <b>Keep the brand consistent</b>
            <p>Use real RR project photography where possible. A logo with a transparent background usually sits best on the light palette.</p>
          </div>
        </nav>

        <div className="rr-site-assets-content">
          <div className="rr-site-assets-group-head">
            <div><h2>{currentGroup.title}</h2><p>{currentGroup.description}</p></div>
            <span>{currentGroup.slots.length} slots</span>
          </div>

          {loading ? (
            <div className="rr-library-empty"><LoaderCircle className="rr-spinning" size={21}/><span>Loading website asset settings…</span></div>
          ) : (
            <div className="rr-site-assets-grid">
              {currentGroup.slots.map((slot) => {
                const asset = assets[slot.key];
                const busy = uploadingKey === slot.key;
                return (
                  <article key={slot.key} className={`rr-site-asset-card${asset ? " is-configured" : ""}`}>
                    <div className={`rr-site-asset-preview${slot.key === "brandLogo" || slot.key === "brandMark" ? " is-logo" : ""}`}>
                      {asset?.url ? (
                        <img src={asset.url} alt={`${slot.label} preview`} />
                      ) : (
                        <div className="rr-site-asset-default"><ImageIcon size={23}/><span>Built-in image</span><small>Uploads override this default</small></div>
                      )}
                      <span className={`rr-site-asset-state${asset ? " is-custom" : ""}`}>{asset ? "Custom asset" : "Default"}</span>
                    </div>
                    <div className="rr-site-asset-card-body">
                      <div className="rr-site-asset-title"><FileImage size={15}/><h3>{slot.label}</h3></div>
                      <p>{slot.help}</p>
                      <small className="rr-site-asset-recommended">Suggested: {slot.recommended}</small>
                      {busy && <div className="rr-site-asset-progress"><span style={{ width: `${progress}%` }}/><small>{progress}% uploaded</small></div>}
                      <div className="rr-site-asset-actions">
                        <label className={`rr-primary rr-site-asset-upload${busy || Boolean(uploadingKey) ? " is-disabled" : ""}`}>
                          {busy ? <LoaderCircle className="rr-spinning" size={15}/> : asset ? <RefreshCw size={15}/> : <Upload size={15}/>}
                          {busy ? "Uploading…" : asset ? "Replace image" : "Upload image"}
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp,image/avif,image/heic"
                            disabled={Boolean(uploadingKey)}
                            onChange={(event) => {
                              const file = event.currentTarget.files?.[0];
                              if (file) void replaceAsset(slot.key, file);
                              event.currentTarget.value = "";
                            }}
                          />
                        </label>
                        {asset && <button type="button" className="rr-site-asset-reset" disabled={Boolean(uploadingKey)} onClick={() => void restoreDefault(slot.key)}><Trash2 size={14}/> Restore default</button>}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <div className="rr-site-assets-bottom-note"><Check size={16}/><p><b>Changes are live-site content.</b> The public site reads the current asset manifest, so replacing an image does not require another deploy. The code deployment is still needed for content, layout or design changes.</p></div>
    </section>
  );
}
