import { useEffect } from "react";
import { useLang } from "../../context/LangContext.jsx";
import TopBar from "../layout/TopBar.jsx";
import GlassPanel from "../ui/GlassPanel.jsx";
import Markdown from "../ui/Markdown.jsx";
import "./ContentPage.css";

/**
 * Standalone page for any page an admin has configured (About /
 * Products / Services / anything added later) — same header, tagline,
 * glass-panel shell, and footer treatment as the chat page, so every
 * page in the app feels like one family. `pageId` selects which
 * content record (fetched from the backend, see src/data/siteContent.js)
 * renders inside the shell.
 *
 * A page with no uploaded photos (Settings > Pages > that page) stays
 * exactly the single centered text column it always was. One or more
 * photos (About's factory shot, Quality's certification scans, ...)
 * splits the body into two columns, same "showcase beside the main
 * content" pattern the home page already uses (see HomeShowcase) —
 * the photos take the start side, the text column fills the rest.
 */
export default function ContentPage({ pageId, onBack, onNavigate }) {
  const { pages } = useLang();
  const meta = pages[pageId];

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pageId]);

  if (!meta) return null; // an admin-removed or not-yet-loaded page id; nothing to render

  const hasImages = meta.images?.length > 0;

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

        <div className={`content-body-row ${hasImages ? "" : "content-body-row-solo"}`.trim()}>
          {hasImages && (
            <div className="content-images">
              {meta.images.map((img, i) => (
                <img key={i} src={img.url} alt={img.caption || ""} className="content-images-photo" />
              ))}
            </div>
          )}

          <GlassPanel className="content-shell" as="section">
            <Markdown source={meta.body} />
          </GlassPanel>
        </div>
      </main>
    </div>
  );
}
