import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { adminApi } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import PageHeader from "../components/PageHeader.jsx";
import ShowcaseDetailPanel from "../components/ShowcaseDetailPanel.jsx";
import "./ShowcasePage.css";

// Photos are sent to the server in batches of this size — it caps one
// request at 20 (MAX_FILES_PER_UPLOAD in backend/app/routers/admin_showcase.py),
// so picking more than that at once still just works.
const UPLOAD_BATCH_SIZE = 20;
const ACCEPT = "image/png,image/jpeg,image/webp";

export default function ShowcasePage() {
  const { handleSessionExpired } = useAuth();
  const navigate = useNavigate();
  const { id: selectedId } = useParams();
  const fileInput = useRef(null);

  const [images, setImages] = useState(null);
  const [error, setError] = useState("");
  const [uploadingCount, setUploadingCount] = useState(0); // 0 = idle
  const [uploadErrors, setUploadErrors] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [reordering, setReordering] = useState(false);
  // Thumbnail quick-delete: which photo is asking "sure?", and which is mid-request.
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const handleApiError = useCallback(
    (e) => (e.status === 401 ? handleSessionExpired() : setError(e.message)),
    [handleSessionExpired]
  );

  useEffect(() => {
    adminApi.listShowcase().then(setImages).catch(handleApiError);
  }, [handleApiError]);

  async function upload(fileList) {
    const files = Array.from(fileList ?? []);
    if (files.length === 0 || uploadingCount > 0) return;

    setError("");
    setUploadErrors([]);
    setUploadingCount(files.length);
    const rejected = [];
    try {
      for (let i = 0; i < files.length; i += UPLOAD_BATCH_SIZE) {
        const { created, errors } = await adminApi.uploadShowcase(files.slice(i, i + UPLOAD_BATCH_SIZE));
        // Added as each batch lands, so a long upload fills in progressively.
        setImages((prev) => [...(prev ?? []), ...created]);
        rejected.push(...errors);
      }
    } catch (e) {
      handleApiError(e);
    } finally {
      setUploadingCount(0);
      setUploadErrors(rejected);
    }
  }

  function handleFileInput(e) {
    upload(e.target.files);
    // Cleared so picking the same file again still fires onChange.
    e.target.value = "";
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    upload(e.dataTransfer.files);
  }

  async function handleMove(id, delta) {
    const from = images.findIndex((i) => i.id === id);
    const to = from + delta;
    if (from < 0 || to < 0 || to >= images.length) return;

    const orderedIds = images.map((i) => i.id);
    [orderedIds[from], orderedIds[to]] = [orderedIds[to], orderedIds[from]];

    setReordering(true);
    setError("");
    try {
      // The response is the full list in its new order.
      setImages(await adminApi.reorderShowcase(orderedIds));
    } catch (e) {
      handleApiError(e);
    } finally {
      setReordering(false);
    }
  }

  function handleUpdated(updated) {
    setImages((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  }

  function handleDeleted(id) {
    setImages((prev) => prev.filter((i) => i.id !== id));
    navigate("/admin/showcase");
  }

  async function handleQuickDelete(id) {
    setDeletingId(id);
    setError("");
    try {
      await adminApi.deleteShowcase(id);
      setImages((prev) => prev.filter((i) => i.id !== id));
      if (selectedId === id) navigate("/admin/showcase");
    } catch (e) {
      handleApiError(e);
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  }

  const selectedIndex = images?.findIndex((i) => i.id === selectedId) ?? -1;
  const selectedImage = selectedIndex >= 0 ? images[selectedIndex] : null;
  const uploading = uploadingCount > 0;

  return (
    <div>
      <PageHeader
        title="Home Showcase"
        subtitle="Photos shown in a looping slideshow on the home page — each one is held for 10 seconds, then dissolves into the next."
        actions={
          <button className="row-action primary" onClick={() => fileInput.current?.click()} disabled={uploading}>
            + Upload photos
          </button>
        }
      />

      {error && <div className="page-error">{error}</div>}

      <input
        ref={fileInput}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        onChange={handleFileInput}
      />

      <div className="showcase-layout">
        <div className="card showcase-main">
          <div
            className={`showcase-drop ${dragging ? "is-dragging" : ""}`.trim()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            {uploading ? (
              <span>Uploading {uploadingCount} photo{uploadingCount === 1 ? "" : "s"}…</span>
            ) : (
              <span>
                Drop photos here or{" "}
                <button type="button" className="showcase-drop-link" onClick={() => fileInput.current?.click()}>
                  choose files
                </button>
                <span className="showcase-drop-hint"> · PNG, JPEG or WEBP</span>
              </span>
            )}
          </div>

          {uploadErrors.length > 0 && (
            <div className="showcase-upload-errors" role="alert">
              <div className="showcase-upload-errors-head">
                <strong>
                  {uploadErrors.length} photo{uploadErrors.length === 1 ? " was" : "s were"} not added
                </strong>
                <button type="button" className="showcase-dismiss" onClick={() => setUploadErrors([])} aria-label="Dismiss">×</button>
              </div>
              <ul>
                {uploadErrors.map((err, i) => (
                  <li key={`${err.filename}-${i}`}>
                    <span className="showcase-upload-errors-name">{err.filename}</span> — {err.detail}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {images === null && <div className="showcase-empty">Loading…</div>}
          {images?.length === 0 && (
            <div className="showcase-empty">No photos yet — upload your first one and it will appear on the home page.</div>
          )}

          {images?.length > 0 && (
            <div className="showcase-grid">
              {images.map((img, i) => (
                <div key={img.id} className="showcase-thumb-cell">
                  <button
                    type="button"
                    className={[
                      "showcase-thumb",
                      selectedId === img.id ? "is-selected" : "",
                      img.isActive ? "" : "is-inactive",
                    ].join(" ").trim()}
                    aria-pressed={selectedId === img.id}
                    aria-label={`Photo ${i + 1}${img.caption ? `: ${img.caption}` : ""}${img.isActive ? "" : " (hidden)"}`}
                    onClick={() => navigate(`/admin/showcase/${img.id}`)}
                  >
                    <img src={img.url} alt="" loading="lazy" draggable="false" />
                    <span className="showcase-thumb-order">{i + 1}</span>
                    {!img.isActive && <span className="showcase-thumb-flag">Hidden</span>}
                    {img.caption && <span className="showcase-thumb-caption">{img.caption}</span>}
                  </button>

                  {/* Sibling of the thumb button, not a child — a button
                      inside a button is invalid HTML and clicks misfire. */}
                  {confirmDeleteId === img.id ? (
                    <div className="showcase-thumb-confirm" role="alertdialog" aria-label="Confirm delete">
                      <span>Delete this photo?</span>
                      <div className="showcase-thumb-confirm-actions">
                        <button
                          type="button"
                          className="showcase-thumb-yes"
                          disabled={deletingId === img.id}
                          onClick={() => handleQuickDelete(img.id)}
                        >
                          {deletingId === img.id ? "Deleting…" : "Yes, delete"}
                        </button>
                        <button
                          type="button"
                          className="showcase-thumb-no"
                          disabled={deletingId === img.id}
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="showcase-thumb-delete"
                      aria-label={`Delete photo ${i + 1}`}
                      title="Delete photo"
                      onClick={() => setConfirmDeleteId(img.id)}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedImage && (
          <ShowcaseDetailPanel
            key={selectedImage.id}
            image={selectedImage}
            index={selectedIndex}
            total={images.length}
            busy={reordering}
            onClose={() => navigate("/admin/showcase")}
            onMove={(delta) => handleMove(selectedImage.id, delta)}
            onUpdated={handleUpdated}
            onDeleted={handleDeleted}
          />
        )}
      </div>
    </div>
  );
}
