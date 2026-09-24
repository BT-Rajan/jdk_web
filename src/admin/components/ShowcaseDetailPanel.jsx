import { useState } from "react";
import { adminApi } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import "./ShowcaseDetailPanel.css";

// Edit panel for one showcase photo. Rendered inline beside the photo
// grid (not as a modal) — including the delete confirmation, which asks
// in place rather than popping a browser dialog.
export default function ShowcaseDetailPanel({ image, index, total, busy, onClose, onMove, onUpdated, onDeleted }) {
  const { handleSessionExpired } = useAuth();
  const [caption, setCaption] = useState(image.caption);
  const [isActive, setIsActive] = useState(image.isActive);
  const [saving, setSaving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState("");

  const dirty = caption.trim() !== image.caption || isActive !== image.isActive;

  function handleApiError(e) {
    if (e.status === 401) handleSessionExpired();
    else setError(e.message);
  }

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const updated = await adminApi.updateShowcase(image.id, { caption, isActive });
      setCaption(updated.caption);
      onUpdated(updated);
    } catch (e) {
      handleApiError(e);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setError("");
    try {
      await adminApi.deleteShowcase(image.id);
      onDeleted(image.id);
    } catch (e) {
      setConfirmingDelete(false);
      handleApiError(e);
    }
  }

  return (
    <aside className="card showcase-panel">
      <div className="showcase-panel-head">
        <div className="showcase-panel-title">Photo {index + 1} of {total}</div>
        <button className="showcase-panel-close" onClick={onClose} aria-label="Close">×</button>
      </div>

      <div className="showcase-panel-preview">
        <img src={image.url} alt={image.caption || `Showcase photo ${index + 1}`} />
      </div>

      <div className="showcase-panel-move">
        <button className="row-action" onClick={() => onMove(-1)} disabled={busy || index === 0}>← Earlier</button>
        <button className="row-action" onClick={() => onMove(1)} disabled={busy || index === total - 1}>Later →</button>
      </div>

      <label className="showcase-panel-label" htmlFor="showcase-caption">Caption</label>
      <input
        id="showcase-caption"
        type="text"
        value={caption}
        maxLength={200}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="Optional — shown over the photo"
      />

      <label className="showcase-panel-check">
        <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
        Show on the home page
      </label>

      {error && <div className="showcase-panel-error">{error}</div>}

      <button className="showcase-panel-save" onClick={handleSave} disabled={saving || !dirty}>
        {saving ? "Saving…" : "Save changes"}
      </button>

      {!confirmingDelete ? (
        <button className="showcase-panel-delete" onClick={() => setConfirmingDelete(true)}>Delete photo</button>
      ) : (
        <div className="showcase-panel-confirm" role="alertdialog" aria-label="Confirm delete">
          <div>Delete this photo permanently? It will be removed from the home page.</div>
          <div className="showcase-panel-confirm-actions">
            <button className="showcase-panel-delete is-confirm" onClick={handleDelete}>Yes, delete</button>
            <button className="row-action" onClick={() => setConfirmingDelete(false)}>Cancel</button>
          </div>
        </div>
      )}
    </aside>
  );
}
