import { useLang } from "../../context/LangContext.jsx";
import "./Footer.css";

/**
 * Site-wide footer, rendered once (see SiteApp.jsx) beneath whichever
 * page is active — replaces the copyright-only `<footer>` previously
 * duplicated in Hero/ContentPage/ContactPage. Every column is sourced
 * from admin-managed data, never hardcoded:
 *  - Explore: the same admin-configured page list (Pages, showInNav)
 *    that drives the header nav — Products/Quality/Contact Us/etc.
 *    appear here automatically as pages are added, renamed, reordered,
 *    or shown/hidden.
 *  - Contact: contact.email/phone/whatsappNumber/address (Settings >
 *    Contact), same fields ContactPage.jsx already renders.
 *  - Column headings and the "rights" line are copy.footer (Settings >
 *    On-screen text), so even the labels are admin-editable/i18n, not
 *    just the data plugged into them.
 */
export default function Footer({ onNavigate }) {
  const { copy, nav, contact, branding } = useLang();
  const t = copy.footer || {};

  const hasContactDetails = contact && (contact.email || contact.phone || contact.whatsappNumber || contact.address);
  const whatsappDigits = (contact?.whatsappNumber || "").replace(/\D/g, "");

  return (
    <footer className="site-footer">
      <div className="site-footer-cols">
        <div className="site-footer-col site-footer-brand">
          <span className="site-footer-brand-name">{branding.siteName}</span>
        </div>

        {nav.length > 0 && (
          <div className="site-footer-col">
            <p className="site-footer-col-title">{t.linksTitle}</p>
            <ul className="site-footer-links">
              {nav.map((item) => (
                <li key={item.id}>
                  <button type="button" onClick={() => onNavigate?.(item.id)}>{item.label}</button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {hasContactDetails && (
          <div className="site-footer-col">
            <p className="site-footer-col-title">{t.contactTitle}</p>
            <ul className="site-footer-links">
              {contact.email && (
                <li><a href={`mailto:${contact.email}`}>{contact.email}</a></li>
              )}
              {contact.phone && (
                <li><a href={`tel:${contact.phone}`}>{contact.phone}</a></li>
              )}
              {whatsappDigits && (
                <li><a href={`https://wa.me/${whatsappDigits}`} target="_blank" rel="noopener noreferrer">WhatsApp: {contact.whatsappNumber}</a></li>
              )}
              {contact.address && <li className="site-footer-address">{contact.address}</li>}
            </ul>
          </div>
        )}
      </div>

      <div className="site-footer-bottom">
        © {new Date().getFullYear()} {branding.siteName}. {t.rights}
      </div>
    </footer>
  );
}
