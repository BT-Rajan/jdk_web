import { useLang } from "../../context/LangContext.jsx";
import Logo from "../ui/Logo.jsx";
import "./Footer.css";

/**
 * Site-wide footer, rendered once (see SiteApp.jsx) beneath whichever
 * page is active. Every column is sourced from admin-managed data,
 * never hardcoded:
 *  - Brand: the same Logo lockup as the header (branding.logoUrl /
 *    siteName) plus branding.metaDescription as a one-line intro.
 *  - Explore: the same admin-configured page list (Pages, showInNav)
 *    that drives the header nav.
 *  - Contact: contact.email/phone/whatsappNumber/address (Settings >
 *    Contact), same fields ContactPage.jsx renders.
 *  - Column headings and the "rights" line are copy.footer.
 *
 * Visually it bookends the header: same brushed surface, same fading
 * gold hairline (with the page headings' diamond ornament at its
 * centre), same tracked-caps treatment for labels as the nav links.
 */
export default function Footer({ onNavigate }) {
  const { copy, nav, contact, branding } = useLang();
  const t = copy.footer || {};

  const hasContactDetails = contact && (contact.email || contact.phone || contact.whatsappNumber || contact.address);
  const whatsappDigits = (contact?.whatsappNumber || "").replace(/\D/g, "");

  // The admin description usually opens with "<Site name> — …", which
  // just repeats the logo sitting directly above it — drop that lead-in.
  const siteName = branding.siteName || "";
  let intro = (branding.metaDescription || "").trim();
  for (const sep of [" — ", " - ", ": "]) {
    if (siteName && intro.startsWith(siteName + sep)) {
      intro = intro.slice(siteName.length + sep.length);
      break;
    }
  }

  return (
    <footer className="site-footer">
      <div className="site-footer-ornament" aria-hidden="true" />

      <div className="site-footer-inner">
        <div className="site-footer-brand">
          <button type="button" className="site-footer-logo" onClick={() => onNavigate?.("home")} aria-label={copy.common?.goHome}>
            <Logo />
          </button>
          {intro && <p className="site-footer-intro">{intro}</p>}
        </div>

        {nav.length > 0 && (
          <nav className="site-footer-col" aria-label={t.linksTitle}>
            <h2 className="site-footer-col-title">{t.linksTitle}</h2>
            <ul className="site-footer-links">
              {nav.map((item) => (
                <li key={item.id}>
                  <button type="button" className="site-footer-link" onClick={() => onNavigate?.(item.id)}>
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {hasContactDetails && (
          <div className="site-footer-col">
            <h2 className="site-footer-col-title">{t.contactTitle}</h2>
            <ul className="site-footer-links">
              {contact.email && (
                <li><a className="site-footer-link" href={`mailto:${contact.email}`}>{contact.email}</a></li>
              )}
              {contact.phone && (
                <li><a className="site-footer-link" href={`tel:${contact.phone}`} dir="ltr">{contact.phone}</a></li>
              )}
              {whatsappDigits && (
                <li>
                  <a className="site-footer-link" href={`https://wa.me/${whatsappDigits}`} target="_blank" rel="noopener noreferrer">
                    WhatsApp <span dir="ltr">{contact.whatsappNumber}</span>
                  </a>
                </li>
              )}
              {contact.address && <li className="site-footer-address">{contact.address}</li>}
            </ul>
          </div>
        )}
      </div>

      <p className="site-footer-bottom">
        © {new Date().getFullYear()} {siteName}. {t.rights}
      </p>
    </footer>
  );
}
