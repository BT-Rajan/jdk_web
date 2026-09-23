import { useCallback, useEffect, useState } from "react";
import { useLang } from "../../context/LangContext.jsx";
import { fetchShowcase } from "../../api/publicContent.js";
import "./HomeShowcase.css";

// A photo is held fully visible for HOLD_MS, then dissolves into the next
// over FADE_MS. The timer runs on the whole cycle (hold + dissolve), so
// "10 seconds" is how long a photo is actually on screen at full
// strength — the dissolve doesn't eat into it.
export const HOLD_MS = 10_000;
export const FADE_MS = 2_000;

const TITLE = { en: "Showcase", ar: "معرض الصور" };

/**
 * Home-page photo showcase: a looping slideshow of the photos an admin
 * uploads under Admin > Home Showcase. Renders nothing at all until
 * there is at least one active photo, so a fresh install (or an
 * unreachable backend) shows no empty box.
 *
 * Sits beside the hero's chat/nav content (see Hero.jsx/Hero.css) and
 * carries no background or title of its own — just the photo, a soft
 * top-down light, and (in RTL) the mirrored position — so it reads as
 * part of the page rather than a separate boxed panel.
 *
 * Crossfade technique: the incoming photo fades 0 -> 1 *on top of* the
 * outgoing one, which stays fully opaque underneath until the fade is
 * done. Fading both at once would dip through the page background at
 * the midpoint (two half-transparent layers don't add up to opaque).
 *
 * Only the current, previous, and next photos are mounted, so a large
 * gallery never downloads every photo at once — the "next" one is
 * mounted (hidden) a full cycle ahead so it's already loaded when its
 * turn comes.
 */
export default function HomeShowcase() {
  const { lang, theme } = useLang();
  const [images, setImages] = useState([]);
  // `prev` is the photo currently dissolving out (null when idle).
  const [pos, setPos] = useState({ current: 0, prev: null });
  const [pageVisible, setPageVisible] = useState(
    () => typeof document === "undefined" || document.visibilityState !== "hidden"
  );

  useEffect(() => {
    let cancelled = false;
    fetchShowcase().then((data) => {
      if (cancelled || !Array.isArray(data)) return;
      setImages(data);
      setPos({ current: 0, prev: null });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Background tabs throttle timers unpredictably; pausing while hidden
  // means the visitor comes back to a photo that's had a full, fresh
  // hold rather than one that's mid-flip.
  useEffect(() => {
    const onVisibility = () => setPageVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  const count = images.length;
  const current = count ? pos.current % count : 0;
  const prev = pos.prev !== null && count ? pos.prev % count : null;

  const goTo = useCallback((next) => {
    setPos((p) => (p.current === next ? p : { current: next, prev: p.current }));
  }, []);

  // One timer, re-armed every time the photo changes (automatically or
  // via a dot), so a photo always gets its full hold before the next dissolve.
  useEffect(() => {
    if (count < 2 || !pageVisible) return undefined;
    const timer = setTimeout(() => goTo((current + 1) % count), HOLD_MS + FADE_MS);
    return () => clearTimeout(timer);
  }, [count, current, pageVisible, goTo]);

  // Once the dissolve has finished the outgoing photo is fully covered,
  // so it can be dropped to hidden.
  useEffect(() => {
    if (pos.prev === null) return undefined;
    const timer = setTimeout(() => setPos((p) => ({ ...p, prev: null })), FADE_MS + 60);
    return () => clearTimeout(timer);
  }, [pos.current, pos.prev]);

  if (count === 0) return null;

  const title = TITLE[lang] ?? TITLE.en;
  const next = count > 1 ? (current + 1) % count : null;
  const mounted = new Set([current, prev, next].filter((i) => i !== null));
  const fading = prev !== null;

  return (
    <section
      className="home-showcase"
      aria-label={title}
      style={{
        "--showcase-fade-ms": `${FADE_MS}ms`,
        // Admin slider (Settings > Theme > Showcase image size).
        "--showcase-scale": theme?.showcaseScale ?? 1,
      }}
    >
      {/* A physical bulb hanging on a cord above the photo, with the
          cone of light it throws down over it. Both purely decorative
          (aria-hidden). */}
      <div className="home-showcase-bulb" aria-hidden="true">
        <svg viewBox="0 0 64 120" width="56" height="105" focusable="false">
          <defs>
            <radialGradient id="hs-bulb-glass" cx="50%" cy="55%" r="55%">
              <stop offset="0%" stopColor="#fffdf0" />
              <stop offset="55%" stopColor="#ffe9a8" />
              <stop offset="100%" stopColor="#f2c14e" />
            </radialGradient>
            <linearGradient id="hs-bulb-cap" x1="0" x2="1">
              <stop offset="0%" stopColor="#5b5b5b" />
              <stop offset="50%" stopColor="#b9b9b9" />
              <stop offset="100%" stopColor="#4a4a4a" />
            </linearGradient>
          </defs>
          <line x1="32" y1="0" x2="32" y2="50" stroke="#2b2b2b" strokeWidth="2" />
          <rect x="24" y="48" width="16" height="20" rx="3" fill="url(#hs-bulb-cap)" />
          <line x1="24" y1="55" x2="40" y2="55" stroke="#2a2a2a" strokeWidth="1.2" />
          <line x1="24" y1="61" x2="40" y2="61" stroke="#2a2a2a" strokeWidth="1.2" />
          <path
            d="M32 116c-12 0-22-9-22-21 0-8 4-13 9-18 3-3 4-6 4-9h18c0 3 1 6 4 9 5 5 9 10 9 18 0 12-10 21-22 21z"
            fill="url(#hs-bulb-glass)"
            className="home-showcase-bulb-glass"
          />
          <path d="M26 96c2-8 4-8 6-14 2 6 4 6 6 14" fill="none" stroke="#c98a1a" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <span className="home-showcase-bulb-halo" />
      </div>
      <div className="home-showcase-light" />

      <div className="home-showcase-frame">
        {images.map((img, i) => {
          if (!mounted.has(i)) return null;
          const state = i === current ? "is-active" : i === prev ? "is-prev" : "";
          return (
            <figure
              key={img.id}
              className={`home-showcase-slide ${state}`.trim()}
              aria-hidden={i !== current}
            >
              <img
                className="home-showcase-img"
                src={img.url}
                // A caption already names the photo (and is read via the
                // figcaption), so alt is left empty rather than repeating it.
                alt={img.caption ? "" : `${title} ${i + 1} / ${count}`}
                decoding="async"
                draggable="false"
              />
              {img.caption && <figcaption className="home-showcase-caption">{img.caption}</figcaption>}
            </figure>
          );
        })}

        {count > 1 && (
          <div className="home-showcase-dots" role="group" aria-label={title}>
            {images.map((img, i) => (
              <button
                key={img.id}
                type="button"
                className={`home-showcase-dot ${i === current ? "is-active" : ""}`.trim()}
                aria-label={`${i + 1} / ${count}`}
                aria-current={i === current ? "true" : undefined}
                // Ignored mid-dissolve: switching again before the last
                // fade finishes would drop the layer that's still holding
                // the frame up, flashing the background through. Uses
                // aria-disabled rather than `disabled` so a keyboard user's
                // focus stays on the dot they just pressed.
                aria-disabled={fading ? "true" : undefined}
                onClick={() => { if (!fading) goTo(i); }}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
