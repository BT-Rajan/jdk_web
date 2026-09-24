import { useEffect, useState } from "react";
import { useLang } from "../../context/LangContext.jsx";
import { api } from "../../api/client.js";
import TopBar from "../layout/TopBar.jsx";
import GlassPanel from "../ui/GlassPanel.jsx";
import Button from "../ui/Button.jsx";
import Markdown from "../ui/Markdown.jsx";
import "./ContentPage.css";
import "./ProductsPage.css";

/**
 * Product detail modal, opened by clicking any card in the grid below.
 * Every field — image, name, description, price, unit, data sheet —
 * comes straight off the clicked product object (the same live catalog
 * row the grid and the admin panel both read), nothing here is
 * hardcoded. "Order now" opens the same order form every other Order
 * CTA on the site does.
 */
function ProductDetailModal({ product, onClose, onOrder, t, closeLabel }) {
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="product-modal-backdrop" onClick={onClose}>
      <GlassPanel
        className="product-modal" as="section" role="dialog" aria-modal="true" aria-label={product.name}
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="product-modal-close" onClick={onClose} aria-label={closeLabel}>×</button>

        {product.imageUrl ? (
          <img src={product.imageUrl} alt="" className="product-modal-image" />
        ) : (
          <div className="product-modal-image product-modal-image-empty" aria-hidden="true" />
        )}

        <div className="product-modal-body">
          <h3 className="product-modal-name">{product.name}</h3>
          {product.description && <p className="product-modal-desc">{product.description}</p>}
          <p className="product-modal-price">
            {product.price.toFixed(2)} {t.currency} <span>/ {product.unit}</span>
          </p>
          {product.datasheetUrl && (
            <a href={product.datasheetUrl} target="_blank" rel="noopener noreferrer" className="product-modal-datasheet">
              {t.datasheetLabel}
            </a>
          )}
          <Button variant="primary" fullWidth onClick={onOrder}>{t.orderCta}</Button>
        </div>
      </GlassPanel>
    </div>
  );
}

/**
 * The public Products page — same header/tagline shell as ContentPage
 * (and still shows the admin's own Markdown intro from Settings >
 * Pages > Products, if they've written one), but the body is the live
 * product catalog (Settings > Products) instead of static text: one
 * card per active product. Clicking a card opens its detail view
 * (ProductDetailModal above) — image, price, and an Order now button.
 * New products show up here the moment an admin adds them — no code
 * change, no redeploy.
 */
export default function ProductsPage({ onBack, onNavigate, onOrder }) {
  const { pages, copy } = useLang();
  const meta = pages.products;
  const t = copy.products || {};

  const [products, setProducts] = useState(null); // null = loading
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.getProducts().then((list) => {
      if (!cancelled) setProducts(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!meta) return null;

  const selectedProduct = products?.find((p) => p.id === selectedId) ?? null;

  function handleOrderNow() {
    setSelectedId(null);
    onOrder?.();
  }

  return (
    <div className="content-page">
      <TopBar onNavigate={onNavigate} onLogoClick={onBack} />

      <main className="content-main">
        <div className="content-tagline">
          <div className="content-tagline-main">
            <span>{meta.line1}</span>
            <span className="gold">{meta.line2}</span>
          </div>
          <div className="content-tagline-divider" />
          <div className="content-tagline-sub">{meta.sub}</div>
        </div>

        {meta.body && (
          <GlassPanel className="content-shell" as="section">
            <Markdown source={meta.body} />
          </GlassPanel>
        )}

        {products === null ? (
          <p className="products-page-status">…</p>
        ) : products.length === 0 ? (
          <p className="products-page-status">{t.emptyState}</p>
        ) : (
          <div className="products-page-grid">
            {products.map((p) => (
              <GlassPanel
                key={p.id} className="products-page-card" as="button" type="button"
                onClick={() => setSelectedId(p.id)}
              >
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt="" className="products-page-card-image" />
                ) : (
                  <div className="products-page-card-image products-page-card-image-empty" aria-hidden="true" />
                )}
                <div className="products-page-card-body">
                  <h3 className="products-page-card-name">{p.name}</h3>
                  {p.description && <p className="products-page-card-desc">{p.description}</p>}
                  <p className="products-page-card-price">
                    {p.price.toFixed(2)} {t.currency} <span>/ {p.unit}</span>
                  </p>
                </div>
              </GlassPanel>
            ))}
          </div>
        )}
      </main>

      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct} onClose={() => setSelectedId(null)} onOrder={handleOrderNow}
          t={t} closeLabel={copy.common?.close || "Close"}
        />
      )}
    </div>
  );
}
