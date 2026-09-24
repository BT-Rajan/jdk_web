import { useEffect } from "react";
import { useLang } from "../../context/LangContext.jsx";
import TopBar from "../layout/TopBar.jsx";
import GlassPanel from "../ui/GlassPanel.jsx";
import Markdown from "../ui/Markdown.jsx";
import "./ContentPage.css";
import "./ContactPage.css";

/**
 * The Contact Us page: the same shell as ContentPage, plus the site's
 * contact details.
 */
export default function ContactPage({ onBack, onNavigate }) {
  const { pages, contact } = useLang();
  const meta = pages.contact;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  if (!meta) return null;

  const hasContactDetails = contact && (contact.email || contact.phone || contact.whatsappNumber || contact.address);
  const whatsappDigits = (contact?.whatsappNumber || "").replace(/\D/g, "");

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

        <GlassPanel className="content-shell contact-shell" as="section">
          <Markdown source={meta.body} />

          {hasContactDetails && (
            <ul className="contact-details-list">
              {contact.email && (
                <li><a href={`mailto:${contact.email}`}>{contact.email}</a></li>
              )}
              {contact.phone && (
                <li><a href={`tel:${contact.phone}`}>{contact.phone}</a></li>
              )}
              {whatsappDigits && (
                <li><a href={`https://wa.me/${whatsappDigits}`} target="_blank" rel="noopener noreferrer">WhatsApp: {contact.whatsappNumber}</a></li>
              )}
              {contact.address && <li>{contact.address}</li>}
            </ul>
          )}
        </GlassPanel>
      </main>
    </div>
  );
}
