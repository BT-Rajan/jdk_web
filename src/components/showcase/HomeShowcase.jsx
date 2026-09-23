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
 * It sits in normal page flow below the hero, entirely separate from the
 * chat: it doesn't touch the quick-chat composer, the floating chat
 * widget, or the sticky buttons.
 *
 * Crossfade technique: the incoming photo fades 0 -> 1 *on top of* the
 * outgoing one, which stays fully opaque underneath until the fade is
 * done. Fading both at once would dip through the dark background at the
 * midpoint (two half-transparent layers don't add up to opaque).
 *
 * Only the current, previous, and next photos are mounted, so a large
 * gallery never downloads every photo at once — the "next" one is
 * mounted (hidden) a full cycle ahead so it's already loaded when its
 * turn comes.
 */
export default function HomeShowcase() {
  const { lang } = useLang();
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
      style={{ "--showcase-fade-ms": `${FADE_MS}ms` }}
    >
      <h2 className="home-showcase-title">{title}</h2>

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
              {/* Blurred copy of the same photo fills the frame, so any
                  aspect ratio (a tall phone photo, a wide panorama) sits
                  in a full, tasteful frame instead of hard letterbox bars.
                  Same URL as the <img>, so the browser fetches it once. */}
              <div className="home-showcase-backdrop" style={{ backgroundImage: `url("${img.url}")` }} />
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
