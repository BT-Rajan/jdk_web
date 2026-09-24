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
 * The public Products page — same header/tagline shell as ContentPage
 * (and still shows the admin's own Markdown intro from Settings >
 * Pages > Products, if they've written one), but the body is the live
 * product catalog (Settings > Products) instead of static text: one
 * card per active product, with its image, description, price, an
 * optional data-sheet download, and an Order CTA. New products show up
 * here the moment an admin adds them — no code change, no redeploy.
 */
export default function ProductsPage({ onBack, onNavigate, onOrder }) {
  const { pages, copy } = useLang();
  const meta = pages.products;
  const t = copy.products || {};

  const [products, setProducts] = useState(null); // null = loading

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
              <GlassPanel key={p.id} className="products-page-card" as="article">
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
                  <div className="products-page-card-actions">
                    {p.datasheetUrl && (
                      <a
                        href={p.datasheetUrl} target="_blank" rel="noopener noreferrer"
                        className="products-page-card-datasheet"
                      >
                        {t.datasheetLabel}
                      </a>
                    )}
                    <Button variant="ghost" onClick={() => onOrder?.()}>{t.orderCta}</Button>
                  </div>
                </div>
              </GlassPanel>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
