import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { adminApi } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import PageHeader from "../components/PageHeader.jsx";
import ProductDetailPanel from "../components/ProductDetailPanel.jsx";
import "./ProductsPage.css";

export default function ProductsPage() {
  const { handleSessionExpired } = useAuth();
  const navigate = useNavigate();
  const { id: selectedId } = useParams();
  const [products, setProducts] = useState(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => {
    adminApi
      .listProducts()
      .then(setProducts)
      .catch((e) => (e.status === 401 ? handleSessionExpired() : setError(e.message)));
  }, [handleSessionExpired]);

  useEffect(() => {
    load();
  }, [load]);

  function handleCreated(product) {
    setProducts((prev) => [...(prev ?? []), product]);
    setCreating(false);
    navigate(`/admin/products/${product.id}`);
  }

  function handleUpdated(updated) {
    setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }

  function handleDeleted() {
    setProducts((prev) => prev.filter((p) => p.id !== selectedId));
    navigate("/admin/products");
  }

  const selectedProduct = products?.find((p) => p.id === selectedId) ?? null;

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle="The catalog visitors pick from on the public order form."
        actions={
          <button className="row-action primary" onClick={() => { setCreating(true); navigate("/admin/products"); }}>
            + New product
          </button>
        }
      />

      {error && <div className="page-error">{error}</div>}

      <div className="products-layout">
        <div className="card products-table-wrap">
          <table>
            <thead>
              <tr>
                <th></th>
                <th>Name</th>
                <th>Price</th>
                <th>Unit</th>
                <th>Datasheet</th>
                <th>Active</th>
              </tr>
            </thead>
            <tbody>
              {products === null && (
                <tr><td colSpan={6} className="table-empty">Loading…</td></tr>
              )}
              {products?.length === 0 && (
                <tr><td colSpan={6} className="table-empty">No products yet — add your first one.</td></tr>
              )}
              {products?.map((p) => (
                <tr
                  key={p.id}
                  className={selectedId === p.id ? "row-selected" : ""}
                  onClick={() => { setCreating(false); navigate(`/admin/products/${p.id}`); }}
                  style={{ cursor: "pointer" }}
                >
                  <td>
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt="" className="products-table-thumb" />
                    ) : (
                      <div className="products-table-thumb products-table-thumb-empty" aria-hidden="true" />
                    )}
                  </td>
                  <td>
                    <div>{p.name}</div>
                    {p.description && <div className="table-subtext">{p.description}</div>}
                  </td>
                  <td>{p.price.toFixed(2)} KWD</td>
                  <td>{p.unit}</td>
                  <td>{p.datasheetUrl ? "Yes" : "—"}</td>
                  <td>{p.isActive ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {creating && (
          <ProductDetailPanel mode="create" onClose={() => setCreating(false)} onCreated={handleCreated} />
        )}

        {!creating && selectedProduct && (
          <ProductDetailPanel
            key={selectedProduct.id}
            mode="edit"
            product={selectedProduct}
            onClose={() => navigate("/admin/products")}
            onUpdated={handleUpdated}
            onDeleted={handleDeleted}
          />
        )}
      </div>
    </div>
  );
}
