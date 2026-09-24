// ──────────────────────────────────────────────────────────
// Central content store — the bundled *fallback* content. Live
// content comes from the backend/admin panel (see src/api/ and
// src/data/siteContent.js); this module is what renders when the
// backend is unreachable or hasn't been populated yet.
//
// Nav labels, home teasers, FAQ and the home/chat copy come from
// src/content/site.json, which the backend seed
// (backend/scripts/seed_content.py) reads too — one source of truth.
// ──────────────────────────────────────────────────────────
import site from "../content/site.json";

export const BRAND = {
  name: "JDK Factory",
  wordmarkAr: "JDK Factory",
};

const LANGS = ["en", "ar"];
const perLang = (fn) => Object.fromEntries(LANGS.map((lang) => [lang, fn(lang)]));

// Top-level site sections, mirrored in the header nav menu and the
// in-chat quick-access tray so both stay in sync from one place.
export const NAV = perLang((lang) =>
  site.pageOrder.map((slug) => ({ id: slug, label: site.pages[slug][lang].navLabel }))
);

// Homepage "topic" buttons (hero-sections / hero-card-pills). Unlike
// NAV/SECTIONS these don't navigate to a page — clicking one hands its
// `question` straight to the assistant chat (see Hero.jsx
// handleTopicClick), so the button IS the entry point into a relevant
// conversation rather than a page link.
export const HOME_TOPICS = {
  en: [
    {
      id: "cement-products",
      label: "Cement Products",
      body: "Ordinary Portland and sulphate-resisting cement, in 50 kg bags and in bulk.",
      question: "Tell us about the cement products JDK Factory supplies.",
    },
    {
      id: "quality-testing",
      label: "Quality & Testing",
      body: "Controlled production and laboratory-tested batches for consistent performance.",
      question: "How does JDK Factory ensure cement quality and testing?",
    },
    {
      id: "supply-ordering",
      label: "Supply & Ordering",
      body: "Bagged and bulk supply across Kuwait — request an order and get a firm quote.",
      question: "How do I order cement from JDK Factory, in bags or in bulk?",
    },
  ],
  ar: [
    {
      id: "cement-products",
      label: "منتجات الأسمنت",
      body: "أسمنت بورتلاندي عادي ومقاوم للكبريتات، في أكياس 50 كجم وسائباً.",
      question: "أخبرنا عن منتجات الأسمنت التي تورّدها JDK Factory.",
    },
    {
      id: "quality-testing",
      label: "الجودة والفحص",
      body: "إنتاج خاضع للرقابة ودفعات مفحوصة مخبرياً لأداء متجانس.",
      question: "كيف تضمن JDK Factory جودة الأسمنت وفحوصاته؟",
    },
    {
      id: "supply-ordering",
      label: "التوريد والطلب",
      body: "توريد في أكياس وسائباً في مختلف أنحاء الكويت — قدّم طلبك واحصل على عرض سعر نهائي.",
      question: "كيف أطلب الأسمنت من JDK Factory، في أكياس أو سائباً؟",
    },
  ],
};

export const SECTIONS = perLang((lang) =>
  Object.fromEntries(
    site.pageOrder.map((slug) => [
      slug,
      { title: site.pages[slug][lang].sectionTitle, body: site.pages[slug][lang].sectionBody },
    ])
  )
);

// UI strings that exist only in the bundle (accessibility labels, voice
// input messages) and are never edited through the admin panel.
const COMMON = {
  en: {
    close: "Close", back: "Back", send: "Send", quickMenu: "Quick menu",
    primaryNav: "Primary", goHome: "Go to home", assistantTyping: "Assistant is typing",
  },
  ar: {
    close: "إغلاق", back: "رجوع", send: "إرسال", quickMenu: "قائمة سريعة",
    primaryNav: "الأساسية", goHome: "الذهاب إلى الرئيسية", assistantTyping: "المساعد يكتب",
  },
};

const CHAT_EXTRAS = {
  en: {
    poweredBy: "Powered by",
    micLabel: "Talk",
    micLabelListening: "Listening…",
    micLabelSpeaking: "Speaking…",
    micUnsupported: "Voice input isn't supported in this browser — try Chrome or Edge, or use the text box instead.",
    micDenied: "Microphone access was blocked. Allow microphone access in your browser settings to talk to the assistant.",
    muteTts: "Mute replies",
    unmuteTts: "Unmute replies",
  },
  ar: {
    poweredBy: "بدعم من",
    micLabel: "تحدث",
    micLabelListening: "جارٍ الاستماع…",
    micLabelSpeaking: "يتحدث الآن…",
    micUnsupported: "الإدخال الصوتي غير مدعوم في هذا المتصفح — جرّب Chrome أو Edge، أو استخدم مربع الكتابة بدلاً من ذلك.",
    micDenied: "تم حظر الوصول إلى الميكروفون. يرجى السماح بالوصول إليه من إعدادات المتصفح للتحدث مع المساعد.",
    muteTts: "كتم الردود الصوتية",
    unmuteTts: "تفعيل الردود الصوتية",
  },
};

export const COPY = perLang((lang) => ({
  dir: lang === "ar" ? "rtl" : "ltr",
  common: COMMON[lang],
  home: site.copyHome[lang],
  chat: { ...CHAT_EXTRAS[lang], ...site.copyChat[lang] },
}));

export const FAQ = perLang((lang) => site.faq.map((item) => item[lang]));

// Bundled copy of the product range, shown on the Products page only
// when the live catalog (Admin → Products) can't be loaded or is empty.
export const FALLBACK_PRODUCTS = site.products;
