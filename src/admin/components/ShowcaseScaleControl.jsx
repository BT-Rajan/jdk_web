import { useEffect, useState } from "react";
import { adminApi } from "../api/client.js";
import "./ShowcaseScaleControl.css";

const MIN_SCALE = 0.3;
const MAX_SCALE = 1.2;
const STEP = 0.05;

function clamp(v) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, v));
}

/**
 * Slider for theme.showcaseScale — how large the homepage showcase
 * photo (the cement bag) renders inside its frame. Lower = smaller /
 * zoomed out. The preview uses the first uploaded showcase photo so the
 * admin sees the effect before saving; it mirrors HomeShowcase.css
 * (image box = frame × scale, aligned to the start side).
 */
export default function ShowcaseScaleControl({ scale, onScaleChange }) {
  const safe = typeof scale === "number" && !Number.isNaN(scale) ? scale : 1;
  const [photoUrl, setPhotoUrl] = useState("");

  useEffect(() => {
    let cancelled = false;
    adminApi
      .listShowcase()
      .then((list) => {
        if (cancelled || !Array.isArray(list)) return;
        const first = list.find((i) => i.is_active !== false) || list[0];
        if (first?.url) setPhotoUrl(first.url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  function step(delta) {
    onScaleChange(Math.round(clamp(safe + delta) * 100) / 100);
  }

  return (
    <div className="setting-field showcase-scale-field">
      <label className="setting-label">Showcase image size</label>
      <p className="setting-help">
        Makes the homepage showcase photo (the cement bag) smaller or larger. Slide left to zoom out.
      </p>

      <div className="showcase-scale-preview">
        {photoUrl ? (
          <img
            className="showcase-scale-img"
            style={{ "--showcase-scale": safe }}
            src={photoUrl}
            alt="Showcase preview"
          />
        ) : (
          <span className="showcase-scale-empty">Upload a photo under Home Showcase to preview</span>
        )}
      </div>

      <div className="logo-zoom-controls">
        <button type="button" className="logo-zoom-btn" onClick={() => step(-STEP)}
          disabled={safe <= MIN_SCALE} aria-label="Smaller">−</button>
        <input
          type="range"
          className="logo-zoom-slider"
          min={MIN_SCALE}
          max={MAX_SCALE}
          step={STEP}
          value={safe}
          onChange={(e) => onScaleChange(parseFloat(e.target.value))}
        />
        <button type="button" className="logo-zoom-btn" onClick={() => step(STEP)}
          disabled={safe >= MAX_SCALE} aria-label="Larger">+</button>
        <span className="logo-zoom-pct">{Math.round(safe * 100)}%</span>
      </div>
    </div>
  );
}
