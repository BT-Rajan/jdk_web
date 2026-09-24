import { useState } from "react";
import { adminApi } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import "./ProductDetailPanel.css";

// Mirrors the backend's checks in routers/admin_uploads.py (which sniffs
// the real bytes and is the actual gate) — checked here too so a wrong
// file gets an instant, specific message instead of a round-trip.
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

const EMPTY_FORM = {
  name: "", description: "", price: "", unit: "unit",
  imageUrl: "", datasheetUrl: "", datasheetFilename: "", isActive: true,
};

export default function ProductDetailPanel({ mode, product, onClose, onCreated, onUpdated, onDeleted }) {
  const { handleSessionExpired } = useAuth();
  const [form, setForm] = useState(
    mode === "edit"
      ? {
          name: product.name, description: product.description, price: String(product.price), unit: product.unit,
          imageUrl: product.imageUrl || "", datasheetUrl: product.datasheetUrl || "",
          datasheetFilename: product.datasheetFilename || "", isActive: product.isActive,
        }
      : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingDatasheet, setUploadingDatasheet] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [previewBroken, setPreviewBroken] = useState(false);

  function handleApiError(e) {
    if (e.status === 401) handleSessionExpired();
    else setError(e.message);
  }

  const priceNumber = Number(form.price);
  const priceValid = form.price !== "" && !Number.isNaN(priceNumber) && priceNumber >= 0;

  async function uploadImageFile(file) {
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type)) {
      setError("Unsupported image type — use PNG, JPEG or WEBP.");
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError("Image is larger than 4 MB — please use a smaller file.");
      return;
    }
    setUploadingImage(true);
    setError("");
    try {
      const { url } = await adminApi.uploadImage(file);
      setPreviewBroken(false);
      setForm((f) => ({ ...f, imageUrl: url }));
    } catch (err) {
      handleApiError(err);
    } finally {
      setUploadingImage(false);
    }
  }

  function handleImageFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    uploadImageFile(file);
  }

  function handleImageDrop(e) {
    e.preventDefault();
    setDragOver(false);
    if (uploadingImage) return;
    uploadImageFile(e.dataTransfer.files?.[0]);
  }

  async function handleDatasheetFile(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingDatasheet(true);
    setError("");
    try {
      const { url, filename } = await adminApi.uploadDocument(file);
      setForm((f) => ({ ...f, datasheetUrl: url, datasheetFilename: filename }));
    } catch (err) {
      handleApiError(err);
    } finally {
      setUploadingDatasheet(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    const body = {
      name: form.name, description: form.description, price: priceNumber, unit: form.unit,
      imageUrl: form.imageUrl.trim() || null,
      datasheetUrl: form.datasheetUrl.trim() || null,
      datasheetFilename: form.datasheetFilename.trim() || null,
      isActive: form.isActive,
    };
    try {
      if (mode === "create") {
        const created = await adminApi.createProduct(body);
        onCreated(created);
      } else {
        const updated = await adminApi.updateProduct(product.id, body);
        onUpdated(updated);
      }
    } catch (e) {
      handleApiError(e);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`Delete "${product.name}"? It will no longer show up on the public products page or order form.`)) return;
    try {
      await adminApi.deleteProduct(product.id);
      onDeleted(product.id);
    } catch (e) {
      handleApiError(e);
    }
  }

  return (
    <aside className="card product-panel">
      <div className="product-panel-head">
        <div className="product-panel-title">{mode === "create" ? "New product" : "Edit product"}</div>
        <button className="product-panel-close" onClick={onClose} aria-label="Close">×</button>
      </div>

      <label className="product-panel-label">Name</label>
      <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Widget A" />

      <label className="product-panel-label">Description</label>
      <textarea
        rows={2} value={form.description}
        onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        placeholder="Shown on the product card and the order form"
      />

      <div className="product-panel-row-2">
        <div>
          <label className="product-panel-label">Price (KWD)</label>
          <input
            type="number" min="0" step="0.01" value={form.price}
            onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
          />
        </div>
        <div>
          <label className="product-panel-label">Unit</label>
          <input value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} placeholder="unit" />
        </div>
      </div>

      <label className="product-panel-label">Product image</label>
      <div className="product-panel-image-field">
        <label
          className={`product-panel-dropzone${dragOver ? " is-dragover" : ""}${uploadingImage ? " is-busy" : ""}`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleImageDrop}
        >
          {form.imageUrl && !previewBroken ? (
            <img src={form.imageUrl} alt="" className="product-panel-dropzone-img" onError={() => setPreviewBroken(true)} />
          ) : (
            <span className="product-panel-dropzone-empty">
              {form.imageUrl ? "Image could not be loaded — check the URL or upload a new one" : "No image yet"}
            </span>
          )}
          <span className="product-panel-dropzone-cta">
            {uploadingImage ? "Uploading…" : form.imageUrl ? "Click or drop to replace" : "Click or drop an image to upload"}
          </span>
          <input type="file" accept={IMAGE_TYPES.join(",")} onChange={handleImageFile} disabled={uploadingImage} hidden />
        </label>
        <div className="product-panel-hint">
          PNG, JPEG or WEBP, up to 4 MB. Shown on the public Products page — a 4:3 landscape photo fits best.
        </div>
        <input
          type="text" value={form.imageUrl}
          onChange={(e) => { setPreviewBroken(false); setForm((f) => ({ ...f, imageUrl: e.target.value })); }}
          placeholder="…or paste an image URL (https://…)"
        />
        {form.imageUrl && (
          <button
            type="button" className="product-panel-clear-btn"
            onClick={() => { setPreviewBroken(false); setForm((f) => ({ ...f, imageUrl: "" })); }}
          >
            Remove image
          </button>
        )}
      </div>

      <label className="product-panel-label">Data sheet (PDF)</label>
      <div className="product-panel-image-field">
        {form.datasheetUrl && (
          <a href={form.datasheetUrl} target="_blank" rel="noopener noreferrer" className="product-panel-datasheet-link">
            {form.datasheetFilename || "View current file"}
          </a>
        )}
        <div className="product-panel-upload-row">
          <input
            type="text" value={form.datasheetUrl}
            onChange={(e) => setForm((f) => ({ ...f, datasheetUrl: e.target.value }))}
            placeholder="https://… (or upload a PDF)"
          />
          <label className="product-panel-upload-btn">
            {uploadingDatasheet ? "Uploading…" : "Upload"}
            <input type="file" accept="application/pdf" onChange={handleDatasheetFile} disabled={uploadingDatasheet} hidden />
          </label>
        </div>
        {form.datasheetUrl && (
          <button
            type="button" className="product-panel-clear-btn"
            onClick={() => setForm((f) => ({ ...f, datasheetUrl: "", datasheetFilename: "" }))}
          >
            Remove data sheet
          </button>
        )}
      </div>

      <label className="product-panel-check">
        <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
        Active (visible on the public products page and order form)
      </label>

      {error && <div className="product-panel-error">{error}</div>}

      <button className="product-panel-save" onClick={handleSave} disabled={saving || !form.name.trim() || !priceValid}>
        {saving ? "Saving…" : mode === "create" ? "Create product" : "Save changes"}
      </button>

      {mode === "edit" && (
        <button className="product-panel-delete" onClick={handleDelete}>Delete product</button>
      )}
    </aside>
  );
}
