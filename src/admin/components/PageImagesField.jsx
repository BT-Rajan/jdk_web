import { useEffect, useRef, useState } from "react";
import { adminApi } from "../api/client.js";
import "./PageImagesField.css";

const ACCEPT = "image/png,image/jpeg,image/webp";

/**
 * Embedded in PageDetailPanel.jsx (edit mode only — a brand-new page
 * has no slug to attach images to yet). One photo (About's factory
 * shot) or several (Quality's certification scans) both go through
 * this same small gallery: upload, reorder with up/down, delete.
 * Rendered on the public site as a side column next to the page's
 * text — see ContentPage.jsx.
 */
export default function PageImagesField({ pageSlug, onApiError }) {
  const fileInput = useRef(null);
  const [images, setImages] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    adminApi.listPageImages(pageSlug).then(setImages).catch(onApiError);
    // Deliberately only re-fetches when the page changes, not on every
    // parent re-render (onApiError is a plain function, not memoized).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSlug]);

  async function handleFiles(e) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setUploading(true);
    setError("");
    try {
      const { created, errors } = await adminApi.uploadPageImages(pageSlug, files);
      setImages((prev) => [...(prev ?? []), ...created]);
      if (errors.length) setError(errors.map((er) => `${er.filename}: ${er.detail}`).join("; "));
    } catch (err) {
      onApiError(err);
    } finally {
      setUploading(false);
    }
  }

  async function move(id, delta) {
    const from = images.findIndex((i) => i.id === id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= images.length) return;
    const orderedIds = images.map((i) => i.id);
    [orderedIds[from], orderedIds[to]] = [orderedIds[to], orderedIds[from]];
    setBusyId(id);
    try {
      setImages(await adminApi.reorderPageImages(pageSlug, orderedIds));
    } catch (err) {
      onApiError(err);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id) {
    if (!confirm("Delete this photo?")) return;
    setBusyId(id);
    try {
      await adminApi.deletePageImage(pageSlug, id);
      setImages((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      onApiError(err);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="page-images-field">
      <div className="page-images-grid">
        {images?.map((img, i) => (
          <div key={img.id} className="page-images-cell">
            <img src={img.url} alt="" />
            <div className="page-images-cell-actions">
              <button type="button" onClick={() => move(img.id, -1)} disabled={busyId === img.id || i === 0} aria-label="Move earlier">↑</button>
              <button type="button" onClick={() => move(img.id, 1)} disabled={busyId === img.id || i === images.length - 1} aria-label="Move later">↓</button>
              <button type="button" onClick={() => remove(img.id)} disabled={busyId === img.id} aria-label="Delete" className="page-images-cell-delete">×</button>
            </div>
          </div>
        ))}
      </div>

      <label className="page-images-upload-btn">
        {uploading ? "Uploading…" : "+ Upload photo(s)"}
        <input ref={fileInput} type="file" accept={ACCEPT} multiple onChange={handleFiles} disabled={uploading} hidden />
      </label>

      {error && <div className="service-panel-error">{error}</div>}
    </div>
  );
}
