import "./LogoZoomControl.css";

const MIN_SCALE = 0.5;
const MAX_SCALE = 3.0;
const STEP = 0.1;

function clamp(v) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, v));
}

/**
 * Pairs with the branding.logoUrl field: a live preview of the logo
 * against the actual header background, plus zoom in/out controls for
 * branding.logoScale — so an admin can see and fix a logo that reads
 * too small next to the header text (a lot of source logo files carry
 * built-in whitespace padding that shrinks them at 1:1) without
 * guessing at a raw number. The preview mirrors the site's own
 * Logo.css sizing formula (40px base × scale, capped) so what's shown
 * here matches what actually renders on the live site.
 */
export default function LogoZoomControl({ logoUrl, scale, onScaleChange, glow, onGlowChange, glowColor, onGlowColorChange }) {
  const safeScale = typeof scale === "number" && !Number.isNaN(scale) ? scale : 1;
  const safeGlow = typeof glow === "number" && !Number.isNaN(glow) ? Math.min(1, Math.max(0, glow)) : 0;
  const safeGlowColor = /^#[0-9a-fA-F]{6}$/.test(glowColor || "") ? glowColor : "#ffffff";

  function step(delta) {
    onScaleChange(Math.round(clamp(safeScale + delta) * 100) / 100);
  }

  return (
    <div className="setting-field logo-zoom-field">
      <label className="setting-label">Logo zoom</label>
      <p className="setting-help">
        Adjust the logo's display size relative to the header text — useful when a logo file has a
        lot of built-in padding and looks small at its default size.
      </p>

      <div className="logo-zoom-preview-header">
        {logoUrl ? (
          <img
            className="logo-zoom-preview-img"
            style={{
              "--logo-scale": safeScale,
              "--logo-glow": safeGlow,
              "--logo-glow-color": safeGlowColor,
            }}
            src={logoUrl}
            alt="Logo preview"
          />
        ) : (
          <span className="logo-zoom-preview-empty">No logo set</span>
        )}
        <span className="logo-zoom-preview-text">JDK</span>
      </div>

      <div className="logo-zoom-controls">
        <button
          type="button"
          className="logo-zoom-btn"
          onClick={() => step(-STEP)}
          disabled={safeScale <= MIN_SCALE}
          aria-label="Zoom out"
        >
          −
        </button>
        <input
          type="range"
          className="logo-zoom-slider"
          min={MIN_SCALE}
          max={MAX_SCALE}
          step={STEP}
          value={safeScale}
          onChange={(e) => onScaleChange(parseFloat(e.target.value))}
        />
        <button
          type="button"
          className="logo-zoom-btn"
          onClick={() => step(STEP)}
          disabled={safeScale >= MAX_SCALE}
          aria-label="Zoom in"
        >
          +
        </button>
        <span className="logo-zoom-pct">{Math.round(safeScale * 100)}%</span>
      </div>

      <label className="setting-label logo-glow-label">Logo glow</label>
      <p className="setting-help">
        A soft glow around the logo, following its outline. Slide to 0 to turn it off.
      </p>
      <div className="logo-zoom-controls">
        <span className="logo-glow-off">Off</span>
        <input
          type="range"
          className="logo-zoom-slider"
          min={0}
          max={1}
          step={0.05}
          value={safeGlow}
          onChange={(e) => onGlowChange(parseFloat(e.target.value))}
          aria-label="Logo glow intensity"
        />
        <span className="logo-zoom-pct">{Math.round(safeGlow * 100)}%</span>
        <input
          type="color"
          className="logo-glow-color"
          value={safeGlowColor}
          onChange={(e) => onGlowColorChange(e.target.value)}
          aria-label="Logo glow color"
          title="Glow color"
        />
      </div>
    </div>
  );
}
