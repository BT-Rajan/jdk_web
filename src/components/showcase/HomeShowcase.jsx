import { useCallback, useEffect, useState } from "react";
import { useLang } from "../../context/LangContext.jsx";
import { fetchShowcase } from "../../api/publicContent.js";
import "./HomeShowcase.css";

// One photo at a time, never two overlapping: a photo is held fully
// visible for HOLD_MS, fades out over FADE_MS, the stage stays empty for
// GAP_MS, then the next photo fades in over FADE_MS. (With transparent
// PNGs like the cement bag, a crossfade would show both at once.)
export const HOLD_MS = 10_000;
export const FADE_MS = 2_000;
export const GAP_MS = 1_000;

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
 * Transition: fade out -> GAP_MS of empty stage -> fade in. Only one
 * photo is ever visible, so transparent images never overlap.
 *
 * Only the current, target, and following photos are mounted, so a large
 * gallery never downloads every photo at once — the "next" one is
 * mounted (hidden) a full cycle ahead so it's already loaded when its
 * turn comes.
 */
export default function HomeShowcase() {
  const { lang, theme } = useLang();
  const [images, setImages] = useState([]);
  // `visible` false = current photo is fading out / the stage is in its
  // gap; `target` is the photo that fades in next.
  const [pos, setPos] = useState({ current: 0, visible: true, target: 0 });
  const [pageVisible, setPageVisible] = useState(
    () => typeof document === "undefined" || document.visibilityState !== "hidden"
  );

  useEffect(() => {
    let cancelled = false;
    fetchShowcase().then((data) => {
      if (cancelled || !Array.isArray(data)) return;
      setImages(data);
      setPos({ current: 0, visible: true, target: 0 });
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
  const target = count ? pos.target % count : 0;
  const fading = !pos.visible;

  // Start a transition to `next`. Ignored while one is already running.
  const goTo = useCallback((next) => {
    setPos((p) => (!p.visible || p.current === next ? p : { ...p, visible: false, target: next }));
  }, []);

  // Photo on screen: hold it (its own fade-in + HOLD_MS), then start
  // fading it out towards the next one.
  useEffect(() => {
    if (count < 2 || !pageVisible || !pos.visible) return undefined;
    const timer = setTimeout(() => goTo((current + 1) % count), HOLD_MS + FADE_MS);
    return () => clearTimeout(timer);
  }, [count, current, pos.visible, pageVisible, goTo]);

  // Fading out: once it's gone, wait GAP_MS of empty stage, then bring
  // in the target photo.
  useEffect(() => {
    if (pos.visible || !pageVisible) return undefined;
    const timer = setTimeout(
      () => setPos((p) => ({ current: p.target, visible: true, target: p.target })),
      FADE_MS + GAP_MS,
    );
    return () => clearTimeout(timer);
  }, [pos.visible, pos.target, pageVisible]);

  if (count === 0) return null;

  const title = TITLE[lang] ?? TITLE.en;
  const following = count > 1 ? (current + 1) % count : null;
  // Current, the one fading in next, and the one after — mounted (hidden)
  // ahead of time so they're already loaded when their turn comes.
  const mounted = new Set([current, target, following].filter((i) => i !== null));

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
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="60%" stopColor="#fffaf0" />
              <stop offset="100%" stopColor="#ffeecb" />
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
          <path d="M26 96c2-8 4-8 6-14 2 6 4 6 6 14" fill="none" stroke="#e6c27a" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <span className="home-showcase-bulb-halo" />
      </div>
      <div className="home-showcase-light" />

      <div className="home-showcase-frame">
        {images.map((img, i) => {
          if (!mounted.has(i)) return null;
          const state = i === current && pos.visible ? "is-active" : "";
          return (
            <figure
              key={img.id}
              className={`home-showcase-slide ${state}`.trim()}
              aria-hidden={i !== current || !pos.visible}
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
                // Ignored mid-transition (fade out / gap), so photos can't
                // be skipped into overlapping. Uses
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
