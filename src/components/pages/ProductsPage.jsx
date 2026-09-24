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

// Page-local strings. Shared product strings (currency, data sheet
// label, Order CTA, empty state) live in COPY.products (content.js) so
// the order form and chat use the same wording.
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

function formatPrice(product, currency, priceOnRequest) {
  const price = Number(product.price);
  return price > 0 ? `${price.toFixed(2)} ${currency}` : priceOnRequest;
}

/**
 * Product detail modal, opened by clicking any card in the grid below.
 * Every field — image, name, description, price, unit, data sheet —
 * comes straight off the clicked product object (the same live catalog
 * row the grid and the admin panel both read), nothing here is
 * hardcoded. The primary action opens the same order form every other
 * Order CTA on the site does — or, for bundled fallback products that
 * can't be ordered online, sends the visitor to the Contact page.
 */
function ProductDetailModal({ product, onClose, primaryLabel, onPrimary, t, pageText, closeLabel }) {
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
            {formatPrice(product, t.currency || "KWD", pageText.priceOnRequest)}
            {product.unit && <span> / {product.unit}</span>}
          </p>
          {product.datasheetUrl && (
            <a href={product.datasheetUrl} target="_blank" rel="noopener noreferrer" className="product-modal-datasheet">
              {t.datasheetLabel}
            </a>
          )}
          <Button variant="primary" fullWidth onClick={onPrimary}>{primaryLabel}</Button>
        </div>
      </GlassPanel>
    </div>
  );
}

/**
 * The Products page: the admin-editable intro/guidance (Markdown, same as
 * every other content page) followed by the live product catalog — the
 * exact list managed under Admin → Products and used by the Order form
 * (GET /api/products), so a product added, edited, deactivated or
 * re-priced in the admin panel shows up here with no code change.
 * Clicking a card opens its detail view (ProductDetailModal above).
 *
 * If the catalog can't be loaded or is empty, the bundled range from
 * site.json is shown instead (display only — ordering needs live
 * products, so the call to action becomes "contact us" in that case).
 */
export default function ProductsPage({ onBack, onNavigate, onOrder }) {
  const { lang, pages, copy } = useLang();
  const pageText = TEXT[lang] || TEXT.en;
  const t = copy.products || {};
  const currency = t.currency || "KWD";
  const meta = pages.products;

  const [products, setProducts] = useState(null); // null = still loading
  const [selected, setSelected] = useState(null);

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

  const primaryLabel = hasLiveProducts ? (t.orderCta || pageText.order) : pageText.contact;
  function handlePrimary() {
    setSelected(null);
    if (hasLiveProducts) onOrder?.();
    else onNavigate?.("contact");
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

        <GlassPanel className="content-shell" as="section">
          <Markdown source={meta.body || ""} />

          <h2 className="products-range-title">{pageText.range}</h2>

          {list === null ? (
            <p className="products-loading">{pageText.loading}</p>
          ) : list.length === 0 ? (
            <p className="products-loading">{t.emptyState}</p>
          ) : (
            <ul className="products-grid">
              {list.map((p) => (
                <li key={p.id || p.name}>
                  {/* A real <button> so the whole card is one clickable,
                      keyboard-reachable target that opens the detail modal. */}
                  <button type="button" className="product-card" onClick={() => setSelected(p)}>
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt="" className="product-card-image" />
                    ) : (
                      <div className="product-card-image product-card-image-empty" aria-hidden="true" />
                    )}
                    <div className="product-card-body">
                      <h3 className="product-card-name">{p.name}</h3>
                      {p.description && <p className="product-card-desc">{p.description}</p>}
                      <div className="product-card-meta">
                        {p.unit && <span className="product-card-unit">{p.unit}</span>}
                        <span className="product-card-price">
                          {formatPrice(p, currency, pageText.priceOnRequest)}
                        </span>
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {list !== null && (
            <div className="products-cta">
              <p className="products-cta-hint">{hasLiveProducts ? pageText.orderHint : pageText.contactHint}</p>
              {hasLiveProducts ? (
                <Button variant="primary" onClick={onOrder}>{pageText.order}</Button>
              ) : (
                <Button variant="primary" onClick={() => onNavigate?.("contact")}>{pageText.contact}</Button>
              )}
            </div>
          )}
        </GlassPanel>
      </main>

      {selected && (
        <ProductDetailModal
          product={selected} onClose={() => setSelected(null)}
          primaryLabel={primaryLabel} onPrimary={handlePrimary}
          t={t} pageText={pageText} closeLabel={copy.common?.close || "Close"}
        />
      )}
    </div>
  );
}
