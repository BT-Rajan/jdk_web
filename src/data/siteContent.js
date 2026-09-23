// ──────────────────────────────────────────────────────────
// Single place that knows how to turn (a) the backend's public config
// + content API responses, or (b) the bundled fallback data, into the
// exact shape LangContext hands to every component: { copy, nav,
// sections, faq, pages }, each keyed by language.
//
// Components never import COPY/FAQ/NAV/SECTIONS or PAGE_META/
// PAGE_CONTENT directly anymore — only useLang() — so swapping how
// content is sourced never touches component code again.
// ──────────────────────────────────────────────────────────
import { BRAND, COPY, FAQ, NAV, SECTIONS } from "./content.js";
import { PAGE_CONTENT, PAGE_META } from "./pages.js";
import { fetchContentPages, fetchFaqItems, fetchPublicConfig } from "../api/publicContent.js";

const RTL_LANGS = new Set(["ar", "he", "fa", "ur"]);

function dirFor(lang) {
  return RTL_LANGS.has(lang) ? "rtl" : "ltr";
}

// Backend copy blobs use snake_case (matches Python convention);
// components use camelCase (matches this codebase's JS convention).
// One small recursive converter keeps both sides idiomatic instead of
// forcing one language's naming convention onto the other.
function toCamel(value) {
  if (Array.isArray(value)) return value.map(toCamel);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()), toCamel(v)])
    );
  }
  return value;
}

// ---- Building the unified shape from the BUNDLED FALLBACK ----------

function localCopyForLang(lang) {
  const c = COPY[lang];
  return {
    home: c.home,
    chat: c.chat,
    common: c.common,
  };
}

function buildFromLocalFallback(supportedLanguages) {
  const copy = {}, nav = {}, sections = {}, faq = {}, pages = {};
  for (const lang of supportedLanguages) {
    copy[lang] = localCopyForLang(lang);
    nav[lang] = NAV[lang];
    sections[lang] = SECTIONS[lang];
    faq[lang] = FAQ[lang];
    pages[lang] = Object.fromEntries(
      Object.keys(PAGE_META[lang]).map((slug) => [
        slug,
        { ...PAGE_META[lang][slug], body: PAGE_CONTENT[lang][slug] },
      ])
    );
  }
  // No bundled fallback buttons — the fallback tagline string covers
  // that spot until the admin configures real buttons via the API.
  return { copy, nav, sections, faq, pages, heroButtons: [] };
}

// ---- Building the unified shape from the BACKEND API ----------------

function apiCopyForLang(copyBlobs, lang) {
  // copy.chat defaults to a genuinely empty {} on the backend (see
  // settings_registry.py) until an admin fills it in via Settings >
  // On-screen text — unlike copy.home (merged per-field in Hero.jsx's
  // withHomeFallbacks), nothing filled that gap, so an unconfigured
  // instance rendered a blank sticky-chat button label, widget header,
  // starter chips, etc. Falling back to the bundled COPY text per-field
  // (only for keys the admin hasn't set at all) keeps the widget usable
  // out of the box, same as the home page already is.
  const localFallback = COPY[lang] ?? COPY.en;
  const home = toCamel(copyBlobs["copy.home"]?.[lang] ?? {});
  const chat = { ...localFallback.chat, ...toCamel(copyBlobs["copy.chat"]?.[lang] ?? {}) };
  const common = toCamel(copyBlobs["copy.common"]?.[lang] ?? {});

  return { home, chat, common };
}

function buildFromApi(publicConfig, contentPages, faqItems, supportedLanguages) {
  const visiblePages = [...contentPages].sort((a, b) => a.order - b.order);
  const navPages = visiblePages.filter((p) => p.showInNav);

  const copy = {}, nav = {}, sections = {}, faq = {}, pages = {};
  for (const lang of supportedLanguages) {
    copy[lang] = apiCopyForLang(publicConfig, lang);

    nav[lang] = navPages.map((p) => ({ id: p.slug, label: p.translations[lang]?.navLabel ?? p.slug }));

    sections[lang] = Object.fromEntries(
      navPages.map((p) => [p.slug, {
        title: p.translations[lang]?.sectionTitle ?? "",
        body: p.translations[lang]?.sectionBody ?? "",
      }])
    );

    pages[lang] = Object.fromEntries(
      visiblePages.map((p) => [p.slug, {
        line1: p.translations[lang]?.taglineLine1 ?? "",
        line2: p.translations[lang]?.taglineLine2 ?? "",
        sub: p.translations[lang]?.taglineSub ?? "",
        body: p.translations[lang]?.bodyMarkdown ?? "",
      }])
    );

    faq[lang] = faqItems.map((item) => ({
      q: item.translations[lang]?.q ?? "",
      a: item.translations[lang]?.a ?? "",
    }));
  }

  // Admin-provisioned home hero buttons — shared across languages (only
  // each button's label is per-language); validated again on the way in
  // since this is rendered straight into <a href>.
  const heroButtons = (toCamel(publicConfig["copy.homeHeroButtons"]) ?? [])
    .filter((b) => b && typeof b.url === "string" && isSafeHref(b.url) && b.label && typeof b.label === "object")
    .slice(0, 8);

  return { copy, nav, sections, faq, pages, heroButtons };
}

// Only allow schemes/paths an <a href> can safely carry — blocks
// `javascript:`/`data:` etc. even though the value comes from an
// authenticated admin, since it's still rendered straight into the DOM.
export function isSafeHref(url) {
  return typeof url === "string" && /^(https?:\/\/|\/(?!\/))/.test(url.trim());
}

// Fallback theme — mirrors tokens.css's own literal defaults exactly,
// so there's no visual "pop" if these get overridden a moment later
// once the live backend theme arrives.
const FALLBACK_THEME = {
  backgroundColor: "#0c0a16",
  primaryColor: "#ff7a45",
  accentColor: "#a855f7",
  textColor: "#f4f0fa",
  fontDisplay: '"Space Grotesk", system-ui, -apple-system, sans-serif',
  fontBody: '"Inter", system-ui, -apple-system, sans-serif',
  fontAr: '"Noto Kufi Arabic", "Arial Unicode MS", sans-serif',
  googleFontsUrl:
    "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700" +
    "&family=Space+Grotesk:wght@500;600;700&family=Noto+Kufi+Arabic:wght@300;400;500;600;700&display=swap",
  headerHeightPx: 64,
  contentMaxWidthPx: 1180,
  cornerRadiusPx: 16,
  heroAutoAdvanceSeconds: 7,
  // Falls back to "classic"/"ripple-gradient" — the site's original/
  // only homepage layout and headline treatment before these settings
  // existed — so an unset or unrecognized value here can never
  // regress an existing deployment. See Hero.jsx / HeroShared.jsx.
  layoutTemplate: "classic",
  headlineStyle: "ripple-gradient",
  // Homepage headline pacing — see theme.headlineTypingSpeedCps /
  // theme.headlineDissolveMs in backend/app/settings_registry.py.
  // 5 cps matches the site's original (pre-setting) hardcoded speed.
  headlineTypingSpeedCps: 5,
  headlineDissolveMs: 2500,
  showcaseScale: 1,
  surfaceStyle: "glass",
  buttonStyle: "default",
  typeScale: "standard",
  headingCase: "as-is",
  backgroundStyle: "grid",
  backgroundIntensity: "subtle",
  density: "comfortable",
  sectionRhythm: "standard",
};

export function buildFallbackSite() {
  const supportedLanguages = Object.keys(COPY);
  return {
    source: "fallback",
    supportedLanguages,
    defaultLanguage: "en",
    theme: FALLBACK_THEME,
    features: { chatEnabled: true, whatsappWidgetEnabled: false },
    contact: FALLBACK_CONTACT,
    branding: {
      siteNameByLang: { en: BRAND.name, ar: BRAND.wordmarkAr },
      logoUrl: "/static/logo.svg",
      logoScale: 1,
      faviconUrl: "/favicon.svg",
      metaDescriptionByLang: { en: "JDK Factory — AI-powered technology & innovation.", ar: "" },
      chatAvatarUrl: "",
    },
    ...buildFromLocalFallback(supportedLanguages),
  };
}

function apiFeatures(publicConfig) {
  return {
    chatEnabled: publicConfig["features.chatEnabled"],
    whatsappWidgetEnabled: publicConfig["features.whatsappWidgetEnabled"],
  };
}

// contact.address is i18n ({en, ar}); email/phone/whatsapp_number are
// plain scalars in the settings registry (see settings_registry.py).
function apiContact(publicConfig) {
  return {
    email: publicConfig["contact.email"] ?? "",
    phone: publicConfig["contact.phone"] ?? "",
    whatsappNumber: publicConfig["contact.whatsappNumber"] ?? "",
    addressByLang: publicConfig["contact.address"] ?? { en: "", ar: "" },
  };
}

const FALLBACK_CONTACT = { email: "", phone: "", whatsappNumber: "", addressByLang: { en: "", ar: "" } };

function apiTheme(publicConfig) {
  return {
    backgroundColor: publicConfig["theme.backgroundColor"],
    primaryColor: publicConfig["theme.primaryColor"],
    accentColor: publicConfig["theme.accentColor"],
    textColor: publicConfig["theme.textColor"],
    fontDisplay: publicConfig["theme.fontDisplay"],
    fontBody: publicConfig["theme.fontBody"],
    fontAr: publicConfig["theme.fontAr"],
    googleFontsUrl: publicConfig["theme.googleFontsUrl"],
    headerHeightPx: publicConfig["theme.headerHeightPx"],
    contentMaxWidthPx: publicConfig["theme.contentMaxWidthPx"],
    cornerRadiusPx: publicConfig["theme.cornerRadiusPx"],
    heroAutoAdvanceSeconds: publicConfig["theme.heroAutoAdvanceSeconds"],
    // See FALLBACK_THEME above on why these fallbacks are safe.
    layoutTemplate: publicConfig["theme.layoutTemplate"] || "classic",
    headlineStyle: publicConfig["theme.headlineStyle"] || "ripple-gradient",
    headlineTypingSpeedCps: publicConfig["theme.headlineTypingSpeedCps"] || 5,
    headlineDissolveMs: publicConfig["theme.headlineDissolveMs"] || 2500,
    showcaseScale: publicConfig["theme.showcaseScale"] ?? 1,
    surfaceStyle: publicConfig["theme.surfaceStyle"] || "glass",
    buttonStyle: publicConfig["theme.buttonStyle"] || "default",
    typeScale: publicConfig["theme.typeScale"] || "standard",
    headingCase: publicConfig["theme.headingCase"] || "as-is",
    backgroundStyle: publicConfig["theme.backgroundStyle"] || "grid",
    backgroundIntensity: publicConfig["theme.backgroundIntensity"] || "subtle",
    density: publicConfig["theme.density"] || "comfortable",
    sectionRhythm: publicConfig["theme.sectionRhythm"] || "standard",
  };
}

/**
 * Loads everything needed to render the site, preferring the live
 * backend and falling back to bundled content per-piece if the
 * backend (or a specific call) is unreachable — so a partial outage
 * degrades gracefully instead of blanking the whole site.
 */
export async function loadSiteContent() {
  const [publicConfig, contentPages, faqItems] = await Promise.all([
    fetchPublicConfig(),
    fetchContentPages(),
    fetchFaqItems(),
  ]);

  const supportedLanguages = publicConfig?.["locale.supportedLanguages"] ?? Object.keys(COPY);
  const defaultLanguage = publicConfig?.["locale.defaultLanguage"] ?? "en";

  const haveFullApiData = publicConfig && contentPages && faqItems;
  const site = haveFullApiData
    ? buildFromApi(publicConfig, contentPages, faqItems, supportedLanguages)
    : buildFromLocalFallback(supportedLanguages);

  return {
    source: haveFullApiData ? "api" : "fallback",
    supportedLanguages,
    defaultLanguage,
    theme: haveFullApiData ? apiTheme(publicConfig) : FALLBACK_THEME,
    features: haveFullApiData
      ? apiFeatures(publicConfig)
      : { chatEnabled: true, whatsappWidgetEnabled: false },
    contact: haveFullApiData ? apiContact(publicConfig) : FALLBACK_CONTACT,
    branding: {
      siteNameByLang: publicConfig?.["branding.siteName"] ?? { en: BRAND.name, ar: BRAND.wordmarkAr },
      logoUrl: publicConfig?.["branding.logoUrl"] ?? "/static/logo.svg",
      logoScale: publicConfig?.["branding.logoScale"] ?? 1,
      faviconUrl: publicConfig?.["branding.faviconUrl"] ?? "/favicon.svg",
      metaDescriptionByLang: publicConfig?.["branding.metaDescription"] ?? { en: "", ar: "" },
      chatAvatarUrl: publicConfig?.["chat.avatarUrl"] ?? "",
    },
    ...site,
  };
}

export { dirFor };
