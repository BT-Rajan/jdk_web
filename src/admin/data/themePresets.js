// Curated theme presets for the admin "Theme" settings page.
//
// The whole site derives its entire look — surfaces, glass cards,
// gradients, borders, glow effects — from just a handful of base
// tokens via color-mix() (see src/styles/tokens.css). Every preset
// here works within that system rather than fighting it: all three
// keep a dark base surface, because the shared component CSS uses
// light-on-dark glassmorphism (translucent white overlays for cards,
// faded-white tokens for secondary text) that only reads correctly
// against a dark background — a light preset would wash out every
// card border and mute every secondary label. Luxury and variety come
// from hue, gold tone, and type pairing instead, each still validated
// for contrast in both directions (as body text on the background,
// and as button text via --on-gold-text, which resolves to the
// background color placed on top of the primary color).
//
// Keys here match the `theme.*` setting keys exactly, so a preset's
// `values` object can be merged straight into SettingsPage's form
// state.

export const THEME_PRESETS = [
  {
    id: "midnight-gold",
    name: "Midnight Gold",
    description: "Deep navy with a warm gold signature — the original JDK look.",
    values: {
      "theme.backgroundColor": "#0a0e27",
      "theme.primaryColor": "#fbbf24",
      "theme.accentColor": "#3b82f6",
      "theme.textColor": "#f0f5ff",
      "theme.fontDisplay": '"Cormorant Garamond", Georgia, serif',
      "theme.fontBody": '"Inter", system-ui, -apple-system, sans-serif',
      "theme.fontAr": '"Noto Kufi Arabic", "Arial Unicode MS", sans-serif',
      "theme.googleFontsUrl":
        "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700" +
        "&family=Cormorant+Garamond:wght@500;600;700&family=Noto+Kufi+Arabic:wght@300;400;500;600;700" +
        "&display=swap",
      "theme.headerHeightPx": 64,
      "theme.contentMaxWidthPx": 1180,
      "theme.cornerRadiusPx": 16,
    },
  },
  {
    id: "emerald-noir",
    name: "Emerald Noir",
    description: "Near-black emerald with antique gold and a crisp, architectural edge.",
    values: {
      "theme.backgroundColor": "#071a16",
      "theme.primaryColor": "#d4af37",
      "theme.accentColor": "#10b981",
      "theme.textColor": "#f2ede1",
      "theme.fontDisplay": '"Playfair Display", Georgia, serif',
      "theme.fontBody": '"Manrope", system-ui, -apple-system, sans-serif',
      "theme.fontAr": '"Noto Kufi Arabic", "Arial Unicode MS", sans-serif',
      "theme.googleFontsUrl":
        "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700" +
        "&family=Playfair+Display:wght@500;600;700&family=Noto+Kufi+Arabic:wght@300;400;500;600;700" +
        "&display=swap",
      "theme.headerHeightPx": 68,
      "theme.contentMaxWidthPx": 1180,
      "theme.cornerRadiusPx": 10,
    },
  },
  {
    id: "onyx-rose-gold",
    name: "Onyx & Rose Gold",
    description: "Near-black onyx, soft rose gold, and a hint of amethyst — softer, boutique feel.",
    values: {
      "theme.backgroundColor": "#120d14",
      "theme.primaryColor": "#e0b0a3",
      "theme.accentColor": "#a78bfa",
      "theme.textColor": "#f5eef0",
      "theme.fontDisplay": '"Bodoni Moda", Georgia, serif',
      "theme.fontBody": '"Inter", system-ui, -apple-system, sans-serif',
      "theme.fontAr": '"Noto Kufi Arabic", "Arial Unicode MS", sans-serif',
      "theme.googleFontsUrl":
        "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700" +
        "&family=Bodoni+Moda:wght@500;600;700&family=Noto+Kufi+Arabic:wght@300;400;500;600;700" +
        "&display=swap",
      "theme.headerHeightPx": 64,
      "theme.contentMaxWidthPx": 1180,
      "theme.cornerRadiusPx": 20,
    },
  },
  {
    id: "ember-pulse",
    name: "Ember Pulse",
    description: "Deep violet-black with a warm coral signature and an electric violet accent — bold, modern, voice-tech energy.",
    values: {
      "theme.backgroundColor": "#0c0a16",
      "theme.primaryColor": "#ff7a45",
      "theme.accentColor": "#a855f7",
      "theme.textColor": "#f4f0fa",
      "theme.fontDisplay": '"Space Grotesk", system-ui, -apple-system, sans-serif',
      "theme.fontBody": '"Inter", system-ui, -apple-system, sans-serif',
      "theme.fontAr": '"Noto Kufi Arabic", "Arial Unicode MS", sans-serif',
      "theme.googleFontsUrl":
        "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700" +
        "&family=Space+Grotesk:wght@500;600;700&family=Noto+Kufi+Arabic:wght@300;400;500;600;700" +
        "&display=swap",
      "theme.headerHeightPx": 64,
      "theme.contentMaxWidthPx": 1180,
      "theme.cornerRadiusPx": 18,
    },
  },
];

// Which of the 4 signature color fields identify a preset — used to
// detect whether the current form values match a known preset (so the
// dropdown reflects reality) or have been hand-edited since.
const SIGNATURE_KEYS = [
  "theme.backgroundColor",
  "theme.primaryColor",
  "theme.accentColor",
  "theme.textColor",
];

export function detectActivePreset(values) {
  for (const preset of THEME_PRESETS) {
    if (SIGNATURE_KEYS.every((k) => (values[k] || "").toLowerCase() === preset.values[k].toLowerCase())) {
      return preset.id;
    }
  }
  return null;
}
