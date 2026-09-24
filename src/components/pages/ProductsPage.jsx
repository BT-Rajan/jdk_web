import { useEffect, useState } from "react";
import { useLang } from "../../context/LangContext.jsx";
import { api } from "../../api/client.js";
import { FALLBACK_PRODUCTS } from "../../data/content.js";
import TopBar from "../layout/TopBar.jsx";
import GlassPanel from "../ui/GlassPanel.jsx";
import Markdown from "../ui/Markdown.jsx";
import Button from "../ui/Button.jsx";
import "./ContentPage.css";
import "./ProductsPage.css";

const TEXT = {
  en: {
    range: "Our range",
    loading: "Loading products…",
    priceOnRequest: "Price on request",
    order: "Request an Order",
    contact: "Contact us for a quote",
    orderHint: "Choose products and quantities and we'll reply with a firm quote.",
    contactHint: "Get in touch and our team will help you choose and quote.",
  },
  ar: {
    range: "منتجاتنا",
    loading: "جارٍ تحميل المنتجات…",
    priceOnRequest: "السعر عند الطلب",
    order: "قدّم طلب شراء",
    contact: "تواصل معنا لعرض سعر",
    orderHint: "اختر المنتجات والكميات وسنردّ عليك بعرض سعر نهائي.",
    contactHint: "تواصل معنا وسيساعدك فريقنا في الاختيار وعرض السعر.",
  },
};

/**
 * The Products page: the admin-editable intro/guidance (Markdown, same as
 * every other content page) followed by the live product catalog — the
 * exact list managed under Admin → Products and used by the Order form
 * (GET /api/products), so a product added, edited, deactivated or
 * re-priced in the admin panel shows up here with no code change.
 *
 * If the catalog can't be loaded or is empty, the bundled range from
 * site.json is shown instead (display only — ordering needs live
 * products, so the call to action becomes "contact us" in that case).
 */
export default function ProductsPage({ onBack, onNavigate, onOrder }) {
  const { lang, pages, branding } = useLang();
  const t = TEXT[lang] || TEXT.en;
  const meta = pages.products;

  const [products, setProducts] = useState(null); // null = still loading

  useEffect(() => {
    window.scrollTo(0, 0);
    let cancelled = false;
    api.getProducts().then((list) => {
      if (!cancelled) setProducts(Array.isArray(list) ? list : []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!meta) return null; // page removed/hidden in the admin panel

  const hasLiveProducts = Array.isArray(products) && products.length > 0;
  const list = products === null ? null : hasLiveProducts ? products : FALLBACK_PRODUCTS;

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

        <GlassPanel className="content-shell" as="section">
          <Markdown source={meta.body || ""} />

          <h2 className="products-range-title">{t.range}</h2>

          {list === null ? (
            <p className="products-loading">{t.loading}</p>
          ) : (
            <ul className="products-grid">
              {list.map((p) => (
                <li key={p.id || p.name} className="product-card">
                  <h3 className="product-card-name">{p.name}</h3>
                  {p.description && <p className="product-card-desc">{p.description}</p>}
                  <div className="product-card-meta">
                    {p.unit && <span className="product-card-unit">{p.unit}</span>}
                    <span className="product-card-price">
                      {p.price > 0 ? `${Number(p.price).toFixed(2)} / ${p.unit}` : t.priceOnRequest}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {list !== null && (
            <div className="products-cta">
              <p className="products-cta-hint">{hasLiveProducts ? t.orderHint : t.contactHint}</p>
              {hasLiveProducts ? (
                <Button variant="primary" onClick={onOrder}>{t.order}</Button>
              ) : (
                <Button variant="primary" onClick={() => onNavigate?.("contact")}>{t.contact}</Button>
              )}
            </div>
          )}
        </GlassPanel>
      </main>

      <footer className="content-footer">© {new Date().getFullYear()} {branding.siteName}. All rights reserved.</footer>
    </div>
  );
}
