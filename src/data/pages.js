// ──────────────────────────────────────────────────────────
// Bundled content for the standalone pages (About / Products /
// Quality / Contact). This is the *fallback* shown when the backend
// is unreachable or has no pages yet — the live source of truth is
// the admin panel (Pages), seeded from these same files by
// backend/scripts/seed_content.py.
//
// - Page bodies: src/content/<lang>/<slug>.md (imported as raw text).
// - Nav labels, taglines, home teasers: src/content/site.json
//   (shared with the backend seed so the two can't drift apart).
// ──────────────────────────────────────────────────────────
import site from "../content/site.json";
import aboutEn from "../content/en/about.md?raw";
import productsEn from "../content/en/products.md?raw";
import qualityEn from "../content/en/quality.md?raw";
import contactEn from "../content/en/contact.md?raw";
import aboutAr from "../content/ar/about.md?raw";
import productsAr from "../content/ar/products.md?raw";
import qualityAr from "../content/ar/quality.md?raw";
import contactAr from "../content/ar/contact.md?raw";

export const PAGE_CONTENT = {
  en: { about: aboutEn, products: productsEn, quality: qualityEn, contact: contactEn },
  ar: { about: aboutAr, products: productsAr, quality: qualityAr, contact: contactAr },
};

// Header tagline shown above each page's content shell (line1 + accent
// line2 + subtitle), derived from site.json.
export const PAGE_META = Object.fromEntries(
  ["en", "ar"].map((lang) => [
    lang,
    Object.fromEntries(
      site.pageOrder.map((slug) => {
        const p = site.pages[slug][lang];
        return [slug, { line1: p.taglineLine1, line2: p.taglineLine2, sub: p.taglineSub }];
      })
    ),
  ])
);
