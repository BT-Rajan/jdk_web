import { useState } from "react";
import { adminApi } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import "./ProductDetailPanel.css";

const EMPTY_FORM = { name: "", description: "", price: "", unit: "unit", isActive: true };

export default function ProductDetailPanel({ mode, product, onClose, onCreated, onUpdated, onDeleted }) {
  const { handleSessionExpired } = useAuth();
  const [form, setForm] = useState(
    mode === "edit"
      ? { name: product.name, description: product.description, price: String(product.price), unit: product.unit, isActive: product.isActive }
      : EMPTY_FORM
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function handleApiError(e) {
    if (e.status === 401) handleSessionExpired();
    else setError(e.message);
  }

  const priceNumber = Number(form.price);
  const priceValid = form.price !== "" && !Number.isNaN(priceNumber) && priceNumber >= 0;

  async function handleSave() {
    setSaving(true);
    setError("");
    const body = { name: form.name, description: form.description, price: priceNumber, unit: form.unit, isActive: form.isActive };
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
    if (!confirm(`Delete "${product.name}"? It will no longer show up on the public order form.`)) return;
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
        placeholder="Shown under the name on the order form"
      />

      <div className="product-panel-row-2">
        <div>
          <label className="product-panel-label">Price</label>
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

      <label className="product-panel-check">
        <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
        Active (visible on the public order form)
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
