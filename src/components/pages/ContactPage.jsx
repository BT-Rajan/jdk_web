import { useEffect } from "react";
import { useLang } from "../../context/LangContext.jsx";
import TopBar from "../layout/TopBar.jsx";
import GlassPanel from "../ui/GlassPanel.jsx";
import Markdown from "../ui/Markdown.jsx";
import Button from "../ui/Button.jsx";
import "./ContentPage.css";
import "./ContactPage.css";

/**
 * Contact details + a "chat with us" shortcut, in a card on the
 * opposite side from the page's own text — same "extra content beside
 * the markdown" placement ContentPage.jsx uses for a page's photos
 * (About's factory shot, Quality's certifications), just a data card
 * here instead of images since there's nothing to upload: every field
 * already comes from Settings > Contact.
 */
function ContactCard({ contact, onOpenChat, t }) {
  const whatsappDigits = (contact?.whatsappNumber || "").replace(/\D/g, "");
  const hasDetails = contact && (contact.email || contact.phone || contact.whatsappNumber || contact.address);
  if (!hasDetails && !onOpenChat) return null;

  return (
    <GlassPanel className="contact-card" as="aside">
      <p className="contact-card-title">{t.cardTitle}</p>
      {contact?.address && <p className="contact-card-address">{contact.address}</p>}
      <ul className="contact-details-list">
        {contact?.email && <li><a href={`mailto:${contact.email}`}>{contact.email}</a></li>}
        {contact?.phone && <li><a href={`tel:${contact.phone}`}>{contact.phone}</a></li>}
        {whatsappDigits && (
          <li><a href={`https://wa.me/${whatsappDigits}`} target="_blank" rel="noopener noreferrer">WhatsApp: {contact.whatsappNumber}</a></li>
        )}
      </ul>
      {onOpenChat && (
        <Button variant="primary" fullWidth onClick={onOpenChat}>{t.chatCta}</Button>
      )}
    </GlassPanel>
  );
}

export default function ContactPage({ onBack, onNavigate, onOpenChat }) {
  const { pages, contact, copy } = useLang();
  const meta = pages.contact;
  const t = copy.contact || {};

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  if (!meta) return null;

  const hasCard = Boolean(onOpenChat || (contact && (contact.email || contact.phone || contact.whatsappNumber || contact.address)));

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

        <div className={`content-body-row ${hasCard ? "" : "content-body-row-solo"}`.trim()}>
          <ContactCard contact={contact} onOpenChat={onOpenChat} t={t} />

          <GlassPanel className="content-shell" as="section">
            <Markdown source={meta.body} />
          </GlassPanel>
        </div>
      </main>
    </div>
  );
}
