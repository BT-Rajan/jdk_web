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
    tabsLabel: "Order form sections", tabDetails: "Your Details", tabDelivery: "Delivery",
    nextDelivery: "Next: Delivery →", backDetails: "← Back",
    errNameShort: "Name must be at least 2 characters.",
    errEmailRequired: "Please enter your email.",
    errPhone: "Enter a valid phone number (7–15 digits, e.g. +965 1234 5678).",
    errDateInvalid: "Please enter a valid date.", errDatePast: "The date can't be in the past.",
    errQty: "Enter a whole number from 0 to 1000.",
    fixErrors: "Please fix the highlighted fields.",
    qtyLabel: (name) => `Quantity for ${name}`,
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
    tabsLabel: "أقسام نموذج الطلب", tabDetails: "بياناتك", tabDelivery: "التسليم",
    nextDelivery: "التالي: التسليم ←", backDetails: "→ رجوع",
    errNameShort: "يجب أن يتكون الاسم من حرفين على الأقل.",
    errEmailRequired: "يرجى إدخال بريدك الإلكتروني.",
    errPhone: "أدخل رقم هاتف صالحاً (من 7 إلى 15 رقماً، مثال: ‎+965 1234 5678).",
    errDateInvalid: "يرجى إدخال تاريخ صالح.", errDatePast: "لا يمكن أن يكون التاريخ في الماضي.",
    errQty: "أدخل عدداً صحيحاً من 0 إلى 1000.",
    fixErrors: "يرجى تصحيح الحقول المحددة.",
    qtyLabel: (name) => `الكمية: ${name}`,
  },
};

// Mirrors what the backend accepts (public_orders.py) and is a little
// stricter where a typo is likely: a TLD of 2+ letters, a plausible phone.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^\+?[0-9\s\-().]+$/;
const MAX_QTY = 1000;
const TABS = ["details", "delivery"];

// Local calendar date (not toISOString(), which is UTC and can be
// "yesterday" for a visitor east of Greenwich in the early morning).
function localTodayIso() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// YYYY-MM-DD that is an actual calendar day (rejects e.g. 2026-11-31).
function isRealDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(y, mo - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === mo - 1 && dt.getDate() === d;
}

function validate({ name, email, phone, requiredDate, quantities, products }, t, todayIso) {
  const e = {};

  const n = name.trim();
  if (!n) e.name = t.errName;
  else if (n.length < 2) e.name = t.errNameShort;

  const em = email.trim();
  if (!em) e.email = t.errEmailRequired;
  else if (em.length > 254 || !EMAIL_RE.test(em)) e.email = t.errEmail;

  const ph = phone.trim();
  if (ph) {
    const digits = ph.replace(/\D/g, "");
    if (!PHONE_RE.test(ph) || digits.length < 7 || digits.length > 15) e.phone = t.errPhone;
  }

  if (!requiredDate) e.requiredDate = t.errDate;
  else if (!isRealDate(requiredDate)) e.requiredDate = t.errDateInvalid;
  else if (requiredDate < todayIso) e.requiredDate = t.errDatePast;

  const qty = {};
  let anySelected = false;
  for (const p of products) {
    const raw = quantities[p.id];
    if (raw === undefined || raw === "") continue;
    const q = Number(raw);
    if (!Number.isInteger(q) || q < 0 || q > MAX_QTY) qty[p.id] = t.errQty;
    else if (q > 0) anySelected = true;
  }
  if (Object.keys(qty).length) e.qty = qty;
  else if (!anySelected) e.items = t.errItems;

  return e;
}

// First invalid field in on-screen order, with the tab it lives on
// (null = the products column, which is always visible).
function firstInvalid(errors, products) {
  if (errors.name) return { tab: "details", id: "order-name" };
  if (errors.email) return { tab: "details", id: "order-email" };
  if (errors.phone) return { tab: "details", id: "order-phone" };
  if (errors.requiredDate) return { tab: "delivery", id: "order-date" };
  if (errors.qty) return { tab: null, id: `order-qty-${Object.keys(errors.qty)[0]}` };
  if (errors.items && products[0]) return { tab: null, id: `order-qty-${products[0].id}` };
  return null;
}

/**
 * Floating order-request popover, docked bottom-right (bottom-left in
 * Arabic) — the cart-icon equivalent of ChatWidget. Not a real
 * checkout/payment flow: every submission becomes a Lead (source="cart")
 * for the team to follow up with a firm quote.
 *
 * Layout: two columns — left is a tabbed form (Your Details | Delivery),
 * right is the product list — with the estimated total and Submit button
 * pinned in a bar along the bottom of the panel, so Submit is always
 * visible (never scrolled away) and the panel is docked above the
 * floating Close/AI buttons instead of underneath them. Below 640px the
 * columns stack.
 *
 * Validation: every field is checked as you leave it and again on
 * Submit; errors show inline (aria-invalid + aria-describedby), the
 * tab holding an error gets a marker, and a failed Submit jumps to and
 * focuses the first bad field. The backend re-validates and recomputes
 * the total itself (public_orders.py) — nothing here is trusted.
 */
export default function OrderPanel({ open, onClose }) {
  const { lang, dir, branding } = useLang();
  const t = TEXT[lang] || TEXT.en;

  const [products, setProducts] = useState([]);
  const [quantities, setQuantities] = useState({}); // productId -> quantity (string while typing)
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [requiredDate, setRequiredDate] = useState("");
  const [notes, setNotes] = useState("");
  const [tab, setTab] = useState("details");
  const [touched, setTouched] = useState({});
  const [attempted, setAttempted] = useState(false);
  const [focusId, setFocusId] = useState(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null); // { estimatedTotal } once submitted

  useEffect(() => {
    if (open) api.getProducts().then(setProducts);
  }, [open]);

  // Land on the first field when the panel opens (it's a modal dialog).
  useEffect(() => {
    if (open && !result) setFocusId("order-name");
  }, [open, result]);

  // Focus is requested by id and applied after the render that made the
  // target visible (e.g. after switching tabs).
  useEffect(() => {
    if (!focusId) return;
    document.getElementById(focusId)?.focus();
    setFocusId(null);
  }, [focusId, tab]);

  const todayIso = useMemo(() => localTodayIso(), [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const errors = useMemo(
    () => validate({ name, email, phone, requiredDate, quantities, products }, t, todayIso),
    [name, email, phone, requiredDate, quantities, products, t, todayIso]
  );

  const touch = (key) => setTouched((prev) => (prev[key] ? prev : { ...prev, [key]: true }));
  const shown = (key) => (touched[key] || attempted ? errors[key] : undefined);
  const shownQty = (id) => (touched[`qty-${id}`] || attempted ? errors.qty?.[id] : undefined);
  const shownItems = attempted ? errors.items : undefined;

  const tabHasError = {
    details: Boolean(shown("name") || shown("email") || shown("phone")),
    delivery: Boolean(shown("requiredDate")),
  };

  const lineItems = useMemo(
    () => products
      .map((p) => ({ product: p, quantity: Number(quantities[p.id]) }))
      .filter((li) => Number.isInteger(li.quantity) && li.quantity > 0 && li.quantity <= MAX_QTY),
    [products, quantities]
  );

  const estimatedTotal = useMemo(
    () => lineItems.reduce((sum, li) => sum + li.product.price * li.quantity, 0),
    [lineItems]
  );

  function stepQty(productId, delta) {
    touch(`qty-${productId}`);
    setQuantities((q) => {
      const raw = Number(q[productId]);
      const current = Number.isFinite(raw) ? Math.round(raw) : 0;
      const next = Math.max(0, Math.min(MAX_QTY, current + delta));
      return { ...q, [productId]: String(next) };
    });
  }

  function resetForCreate() {
    setQuantities({});
    setName("");
    setEmail("");
    setPhone("");
    setRequiredDate("");
    setNotes("");
    setTab("details");
    setTouched({});
    setAttempted(false);
    setError("");
    setResult(null);
  }

  // Tabs: roving tabindex + arrow keys (Left/Right swap in RTL), Home/End.
  function handleTabKeyDown(e) {
    const forwardKey = dir === "rtl" ? "ArrowLeft" : "ArrowRight";
    const backKey = dir === "rtl" ? "ArrowRight" : "ArrowLeft";
    let next = null;
    if (e.key === forwardKey) next = TABS[(TABS.indexOf(tab) + 1) % TABS.length];
    else if (e.key === backKey) next = TABS[(TABS.indexOf(tab) - 1 + TABS.length) % TABS.length];
    else if (e.key === "Home") next = TABS[0];
    else if (e.key === "End") next = TABS[TABS.length - 1];
    if (!next) return;
    e.preventDefault();
    setTab(next);
    setFocusId(`order-tab-${next}`);
  }

  // "Next" on the Details tab checks that tab's fields first.
  function goNext() {
    setTouched((prev) => ({ ...prev, name: true, email: true, phone: true }));
    const bad = firstInvalid({ name: errors.name, email: errors.email, phone: errors.phone }, products);
    if (bad) {
      setFocusId(bad.id);
      return;
    }
    setTab("delivery");
    setFocusId("order-date");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setAttempted(true);
    const bad = firstInvalid(errors, products);
    if (bad) {
      setError(t.fixErrors);
      if (bad.tab) setTab(bad.tab);
      setFocusId(bad.id);
      return;
    }

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

  function handlePanelKeyDown(e) {
    if (e.key === "Escape") onClose();
  }

  if (!open) return null;

  const errId = (key) => `order-${key}-err`;
  const fieldProps = (key, id) => ({
    id,
    "aria-invalid": shown(key) ? "true" : undefined,
    "aria-describedby": shown(key) ? errId(key) : undefined,
    onBlur: () => touch(key),
  });
  const fieldError = (k) => (shown(k) ? <p id={errId(k)} className="order-panel-field-error">{errors[k]}</p> : null);

  return (
    <GlassPanel
      className="order-panel" as="section" role="dialog" aria-modal="true"
      aria-label={t.title} onKeyDown={handlePanelKeyDown}
    >
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
        <button type="button" className="order-panel-close" onClick={onClose} aria-label={t.close}>✕</button>
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
          <form onSubmit={handleSubmit} noValidate>
            <div className="order-panel-cols">
              {/* ── Left column: tabbed details / delivery ── */}
              <div className="order-panel-col">
                <div className="order-panel-tabs" role="tablist" aria-label={t.tabsLabel} onKeyDown={handleTabKeyDown}>
                  {TABS.map((key) => (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      id={`order-tab-${key}`}
                      aria-selected={tab === key}
                      aria-controls={`order-tabpanel-${key}`}
                      tabIndex={tab === key ? 0 : -1}
                      className="order-panel-tab"
                      onClick={() => setTab(key)}
                    >
                      {key === "details" ? t.tabDetails : t.tabDelivery}
                      {tabHasError[key] && (
                        <span className="order-panel-tab-dot" role="img" aria-label={t.fixErrors} />
                      )}
                    </button>
                  ))}
                </div>

                <div
                  role="tabpanel" id="order-tabpanel-details" aria-labelledby="order-tab-details"
                  hidden={tab !== "details"}
                >
                  <label className="order-panel-label" htmlFor="order-name">{t.name}</label>
                  <input
                    type="text" autoComplete="name" value={name} maxLength={120} required
                    onChange={(e) => setName(e.target.value)} {...fieldProps("name", "order-name")}
                  />
                  {fieldError("name")}

                  <label className="order-panel-label" htmlFor="order-email">{t.email}</label>
                  <input
                    type="email" autoComplete="email" value={email} maxLength={254} required
                    onChange={(e) => setEmail(e.target.value)} {...fieldProps("email", "order-email")}
                  />
                  {fieldError("email")}

                  <label className="order-panel-label" htmlFor="order-phone">{t.phone}</label>
                  <input
                    type="tel" autoComplete="tel" inputMode="tel" value={phone} maxLength={40}
                    onChange={(e) => setPhone(e.target.value)} {...fieldProps("phone", "order-phone")}
                  />
                  {fieldError("phone")}

                  <div className="order-panel-tab-nav">
                    <Button variant="ghost" onClick={goNext}>{t.nextDelivery}</Button>
                  </div>
                </div>

                <div
                  role="tabpanel" id="order-tabpanel-delivery" aria-labelledby="order-tab-delivery"
                  hidden={tab !== "delivery"}
                >
                  <label className="order-panel-label" htmlFor="order-date">{t.requiredDate}</label>
                  <input
                    type="date" min={todayIso} value={requiredDate} required
                    onChange={(e) => setRequiredDate(e.target.value)} {...fieldProps("requiredDate", "order-date")}
                  />
                  {fieldError("requiredDate")}

                  <label className="order-panel-label" htmlFor="order-notes">{t.notes}</label>
                  <textarea
                    id="order-notes" rows={4} value={notes} maxLength={1000}
                    onChange={(e) => setNotes(e.target.value)}
                  />

                  <div className="order-panel-tab-nav">
                    <Button variant="ghost" onClick={() => { setTab("details"); setFocusId("order-name"); }}>
                      {t.backDetails}
                    </Button>
                  </div>
                </div>
              </div>

              {/* ── Right column: products ── */}
              <div className="order-panel-col">
                <p className="order-panel-section-title">{t.sectionProducts}</p>
                {products.length === 0 ? (
                  <p className="order-panel-empty">{t.noProducts}</p>
                ) : (
                  <div className="order-panel-products">
                    {products.map((p) => {
                      const qty = Number(quantities[p.id]);
                      const selected = Number.isInteger(qty) && qty > 0;
                      const qtyError = shownQty(p.id);
                      return (
                        <div key={p.id}>
                          <div className={`order-panel-product-row${selected ? " selected" : ""}`}>
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
                                disabled={!selected}
                                aria-label={`-1 ${p.name}`}
                              >
                                −
                              </button>
                              <input
                                id={`order-qty-${p.id}`}
                                className="order-panel-qty-input"
                                type="number" inputMode="numeric" min={0} max={MAX_QTY} step={1}
                                placeholder="0"
                                value={quantities[p.id] ?? ""}
                                onChange={(e) => setQuantities((q) => ({ ...q, [p.id]: e.target.value }))}
                                onBlur={() => touch(`qty-${p.id}`)}
                                aria-label={t.qtyLabel(p.name)}
                                aria-invalid={qtyError ? "true" : undefined}
                                aria-describedby={qtyError ? `order-qty-${p.id}-err` : undefined}
                              />
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
                          {qtyError && <p id={`order-qty-${p.id}-err`} className="order-panel-field-error">{qtyError}</p>}
                        </div>
                      );
                    })}
                  </div>
                )}
                {shownItems && <p className="order-panel-field-error">{shownItems}</p>}
              </div>
            </div>

            {/* Pinned bar: total + Submit are always on screen. */}
            <div className="order-panel-actions">
              {error && <p className="order-panel-error" role="alert">{error}</p>}
              <div className="order-panel-total">
                <span className="order-panel-total-label">{t.estimatedTotal}</span>
                <span className="order-panel-total-value">{estimatedTotal.toFixed(2)}</span>
              </div>
              <Button type="submit" variant="primary" disabled={submitting}>
                {submitting ? t.submitting : t.submit}
              </Button>
            </div>
          </form>
        )}
      </div>

      <footer className="order-panel-footer">{branding.siteName}</footer>
    </GlassPanel>
  );
}
