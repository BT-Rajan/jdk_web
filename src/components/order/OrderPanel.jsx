import { useEffect, useMemo, useState } from "react";
import { useLang } from "../../context/LangContext.jsx";
import { api } from "../../api/client.js";
import GlassPanel from "../ui/GlassPanel.jsx";
import Button from "../ui/Button.jsx";
import "./OrderPanel.css";

const TEXT = {
  en: {
    title: "Request an Order",
    subtitle: "Pick your products, tell us when you need them, and we'll follow up with a firm quote.",
    sectionContact: "Your Details", sectionProducts: "Your Order", sectionDelivery: "Delivery",
    name: "Name", email: "Email", phone: "Phone (optional)",
    products: "Products", qty: "Qty", noProducts: "No products are available to order right now.",
    requiredDate: "Required by", notes: "Notes (optional)",
    estimatedTotal: "Estimated total", submit: "Submit order", submitting: "Submitting…",
    errName: "Please enter your name.", errEmail: "Please enter a valid email.",
    errItems: "Please select at least one product.", errDate: "Please pick a required date.",
    successTitle: "Request received!", successBody: "Thanks — we'll be in touch shortly with a firm quote.",
    close: "Close", newOrder: "Start a new order",
    itemsOne: "1 item selected", itemsMany: (n) => `${n} items selected`,
  },
  ar: {
    title: "طلب شراء",
    subtitle: "اختر المنتجات، وأخبرنا متى تحتاجها، وسنتابع معك بعرض سعر نهائي.",
    sectionContact: "بياناتك", sectionProducts: "طلبك", sectionDelivery: "التسليم",
    name: "الاسم", email: "البريد الإلكتروني", phone: "الهاتف (اختياري)",
    products: "المنتجات", qty: "الكمية", noProducts: "لا توجد منتجات متاحة للطلب حالياً.",
    requiredDate: "التاريخ المطلوب", notes: "ملاحظات (اختياري)",
    estimatedTotal: "الإجمالي التقديري", submit: "إرسال الطلب", submitting: "جارٍ الإرسال…",
    errName: "يرجى إدخال اسمك.", errEmail: "يرجى إدخال بريد إلكتروني صالح.",
    errItems: "يرجى اختيار منتج واحد على الأقل.", errDate: "يرجى اختيار التاريخ المطلوب.",
    successTitle: "تم استلام طلبك!", successBody: "شكراً لك — سنتواصل معك قريباً بعرض سعر نهائي.",
    close: "إغلاق", newOrder: "طلب جديد",
    itemsOne: "تم اختيار عنصر واحد", itemsMany: (n) => `تم اختيار ${n} عناصر`,
  },
};

const SIMPLE_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Floating order-request popover, docked bottom-right — the cart-icon
 * equivalent of ChatWidget. Not a real checkout/payment flow: every
 * submission becomes a Lead (source="cart") for the team to follow up
 * with a firm quote, same spirit as the old "Talk to Us" booking form.
 * Prices shown here are always a live-computed estimate; the backend
 * (public_orders.py) recomputes the total itself from the current
 * catalog rather than trusting anything this component sends.
 */
export default function OrderPanel({ open, onClose }) {
  const { lang, dir, branding } = useLang();
  const t = TEXT[lang] || TEXT.en;

  const [products, setProducts] = useState([]);
  const [quantities, setQuantities] = useState({}); // productId -> quantity
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [requiredDate, setRequiredDate] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { estimatedTotal } once submitted

  useEffect(() => {
    if (open) api.getProducts().then(setProducts);
  }, [open]);

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const lineItems = useMemo(
    () => products
      .map((p) => ({ product: p, quantity: Number(quantities[p.id]) || 0 }))
      .filter((li) => li.quantity > 0),
    [products, quantities]
  );

  const estimatedTotal = useMemo(
    () => lineItems.reduce((sum, li) => sum + li.product.price * li.quantity, 0),
    [lineItems]
  );

  function stepQty(productId, delta) {
    setQuantities((q) => {
      const current = Number(q[productId]) || 0;
      const next = Math.max(0, Math.min(1000, current + delta));
      return { ...q, [productId]: next };
    });
  }

  function resetForCreate() {
    setQuantities({});
    setName("");
    setEmail("");
    setPhone("");
    setRequiredDate("");
    setNotes("");
    setError("");
    setResult(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return setError(t.errName);
    if (!SIMPLE_EMAIL_RE.test(email.trim())) return setError(t.errEmail);
    if (lineItems.length === 0) return setError(t.errItems);
    if (!requiredDate) return setError(t.errDate);

    setError("");
    setSubmitting(true);
    try {
      const res = await api.submitOrder({
        name: name.trim(), email: email.trim(), phone: phone.trim(),
        items: lineItems.map((li) => ({ productId: li.product.id, quantity: li.quantity })),
        requiredDate, notes: notes.trim(),
      });
      setResult(res);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <GlassPanel className="order-panel" as="section" role="dialog" aria-modal="true" aria-label={t.title}>
      <div className="order-panel-header">
        <div>
          <p className="order-panel-title">{t.title}</p>
          {!result && (
            lineItems.length > 0 ? (
              <p className="order-panel-cart-badge">
                {lineItems.length === 1 ? t.itemsOne : t.itemsMany(lineItems.length)}
                {" · "}{estimatedTotal.toFixed(2)}
              </p>
            ) : (
              <p className="order-panel-subtitle">{t.subtitle}</p>
            )
          )}
        </div>
        <button className="order-panel-close" onClick={onClose} aria-label={t.close}>✕</button>
      </div>

      <div className="order-panel-body" dir={dir}>
        {result ? (
          <div className="order-panel-success">
            <p className="order-panel-success-title">{t.successTitle}</p>
            <p>{t.successBody}</p>
            <p className="order-panel-success-total">
              {t.estimatedTotal}: {result.estimatedTotal.toFixed(2)}
            </p>
            <Button variant="ghost" onClick={resetForCreate}>{t.newOrder}</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="order-panel-section">
              <p className="order-panel-section-title">{t.sectionContact}</p>
              <label className="order-panel-label">{t.name}</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />

              <label className="order-panel-label">{t.email}</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} />

              <label className="order-panel-label">{t.phone}</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} />
            </div>

            <div className="order-panel-section">
              <p className="order-panel-section-title">{t.sectionProducts}</p>
              {products.length === 0 ? (
                <p className="order-panel-empty">{t.noProducts}</p>
              ) : (
                <div className="order-panel-products">
                  {products.map((p) => {
                    const qty = Number(quantities[p.id]) || 0;
                    return (
                      <div
                        key={p.id}
                        className={`order-panel-product-row${qty > 0 ? " selected" : ""}`}
                      >
                        <div className="order-panel-product-info">
                          <span className="order-panel-product-name">{p.name}</span>
                          {p.description && <span className="order-panel-product-desc">{p.description}</span>}
                          <span className="order-panel-product-price">{p.price.toFixed(2)} / {p.unit}</span>
                        </div>
                        <div className="order-panel-stepper">
                          <button
                            type="button"
                            className="order-panel-stepper-btn"
                            onClick={() => stepQty(p.id, -1)}
                            disabled={qty === 0}
                            aria-label={`-1 ${p.name}`}
                          >
                            −
                          </button>
                          <span className="order-panel-stepper-value">{qty}</span>
                          <button
                            type="button"
                            className="order-panel-stepper-btn"
                            onClick={() => stepQty(p.id, 1)}
                            aria-label={`+1 ${p.name}`}
                          >
                            +
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="order-panel-section">
              <p className="order-panel-section-title">{t.sectionDelivery}</p>
              <label className="order-panel-label">{t.requiredDate}</label>
              <input
                type="date" min={todayIso} value={requiredDate}
                onChange={(e) => setRequiredDate(e.target.value)}
              />

              <label className="order-panel-label">{t.notes}</label>
              <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} />
            </div>

            {error && <p className="order-panel-error">{error}</p>}

            <div className="order-panel-total-row">
              <span>{t.estimatedTotal}</span>
              <span className="order-panel-total-value">{estimatedTotal.toFixed(2)}</span>
            </div>

            <Button type="submit" variant="primary" fullWidth disabled={submitting}>
              {submitting ? t.submitting : t.submit}
            </Button>
          </form>
        )}
      </div>

      <footer className="order-panel-footer">{branding.siteName}</footer>
    </GlassPanel>
  );
}
