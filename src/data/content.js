// ──────────────────────────────────────────────────────────
// Central content store. In the original app this is admin-
// editable and served from the backend; here it's a plain data
// module so the same shape can later be swapped for an API call
// (see src/api/client.js) without touching any component.
// ──────────────────────────────────────────────────────────

export const BRAND = {
  name: "JDK Factory",
  wordmarkAr: "JDK Factory",
};

// Top-level site sections, mirrored in the header nav menu and the
// in-chat quick-access tray so both stay in sync from one place.
export const NAV = {
  en: [
    { id: "about", label: "About" },
    { id: "products", label: "Products" },
    { id: "services", label: "Services" },
    { id: "contact", label: "Contact Us" },
  ],
  ar: [
    { id: "about", label: "من نحن" },
    { id: "products", label: "المنتجات" },
    { id: "services", label: "الخدمات" },
    { id: "contact", label: "تواصل معنا" },
  ],
};

// Homepage "topic" buttons (hero-sections / hero-card-pills). Unlike
// NAV/SECTIONS above these don't navigate to a page — clicking one
// hands its `question` straight to the AI Assistant chat (see
// Hero.jsx handleTopicClick), so the button IS the entry point into
// a relevant conversation rather than a page link.
export const HOME_TOPICS = {
  en: [
    {
      id: "artificial-intelligence",
      label: "Artificial Intelligence",
      body: "AI assistants, automation, and intelligent workflows tailored to your business.",
      question: "Tell us about Artificial Intelligence at JDK Factory.",
    },
    {
      id: "software-development",
      label: "Software Development",
      body: "Custom web, mobile, and enterprise software built around how your team actually works.",
      question: "Tell us about Software Development at JDK Factory.",
    },
    {
      id: "digital-transformation",
      label: "Digital Transformation",
      body: "Modernizing processes and systems to help your organization move faster.",
      question: "Tell us about Digital Transformation at JDK Factory.",
    },
  ],
  ar: [
    {
      id: "artificial-intelligence",
      label: "الذكاء الاصطناعي",
      body: "مساعدون بالذكاء الاصطناعي وأتمتة وسير عمل ذكي مصمم خصيصًا لعملك.",
      question: "أخبرنا عن الذكاء الاصطناعي في JDK Factory.",
    },
    {
      id: "software-development",
      label: "تطوير البرمجيات",
      body: "برمجيات وتطبيقات ويب وجوال وحلول مؤسسية مصممة وفق طريقة عمل فريقك.",
      question: "أخبرنا عن تطوير البرمجيات في JDK Factory.",
    },
    {
      id: "digital-transformation",
      label: "التحول الرقمي",
      body: "تحديث الأنظمة والعمليات لمساعدة مؤسستك على العمل بشكل أسرع.",
      question: "أخبرنا عن التحول الرقمي في JDK Factory.",
    },
  ],
};

export const SECTIONS = {
  en: {
    about: {
      title: "About JDK Factory",
      body: "JDK Factory is an AI-powered technology and innovation company. We partner with businesses to design, build, and operate intelligent products — from first concept through to production support.",
    },
    products: {
      title: "Products",
      body: "AI assistants, automation workflows, and custom digital platforms — built on modern stacks and tuned to how your team actually works.",
    },
    services: {
      title: "Services",
      body: "Consulting, product design, and full-cycle engineering. We embed with your team or run the build end-to-end, whichever fits your roadmap.",
    },
    contact: {
      title: "Contact Us",
      body: "Ready to talk? Start a chat below and our assistant will connect you with the right person.",
    },
  },
  ar: {
    about: {
      title: "عن JDK Factory",
      body: "JDK Factory شركة تقنية وابتكار مدعومة بالذكاء الاصطناعي. نتعاون مع الشركات لتصميم وبناء وتشغيل منتجات ذكية — من الفكرة الأولى وحتى الدعم الإنتاجي.",
    },
    products: {
      title: "المنتجات",
      body: "مساعدون بالذكاء الاصطناعي، وأتمتة سير العمل، ومنصات رقمية مخصصة — مبنية على تقنيات حديثة ومصممة لتناسب طريقة عمل فريقك.",
    },
    services: {
      title: "الخدمات",
      body: "استشارات، وتصميم منتجات، وهندسة متكاملة. نندمج مع فريقك أو ننفذ المشروع بالكامل، وفق ما يناسب خطتك.",
    },
    contact: {
      title: "تواصل معنا",
      body: "جاهز للتحدث؟ ابدأ محادثة أدناه وسيقوم مساعدنا بتوصيلك بالشخص المناسب.",
    },
  },
};

export const COPY = {
  en: {
    dir: "ltr",
    common: {
      close: "Close", back: "Back", send: "Send", quickMenu: "Quick menu",
      primaryNav: "Primary", goHome: "Go to home", assistantTyping: "Assistant is typing",
    },
    footer: {
      linksTitle: "Explore", contactTitle: "Contact", rights: "All rights reserved.",
    },
    products: {
      emptyState: "No products yet — check back soon.", datasheetLabel: "Data sheet", orderCta: "Order",
      currency: "KWD",
    },
    contact: {
      cardTitle: "Get in touch", chatCta: "Chat with us",
    },
    home: {
      welcome: "Welcome to JDK Factory",
      tagline: "Visit our V-Lounge for more",
      heroStatement: "Practical AI\nBuilt for Businesses",
      taglineLine1: "Solving Today.",
      taglineLine2: "Shaping Tomorrow.",
      supportingText: "Digital products for businesses across India and the GCC.",
      examplePrompts: ["What does JDK Factory build?", "How can JDK Factory help my business?", "Explore our products"],
      hint: "Start chatting",
      langSwitch: "AR | عربي",
    },
    chat: {
      taglineLine1: "Solving Today. ",
      taglineLine2: "Shaping Tomorrow.",
      sub: "AI-POWERED TECHNOLOGY & INNOVATION",
      header: "AI Assistant",
      onlineStatus: "Online · AI Assistant",
      poweredBy: "Powered by",
      faqTitle: "Quick Questions",
      inputPlaceholder: "Ask JDK Factory AI anything…",
      welcomeMsg:
        "Hello! I'm JDK Factory's AI assistant. Before we get started, may I know your name? It helps us build a good relationship with you and follow up properly.",
      langSwitch: "AR | عربي",
      viewProductsCta: "View Products",
      placeOrderCta: "Place an Order",
    },
  },
  ar: {
    dir: "rtl",
    common: {
      close: "إغلاق", back: "رجوع", send: "إرسال", quickMenu: "قائمة سريعة",
      primaryNav: "الأساسية", goHome: "الذهاب إلى الرئيسية", assistantTyping: "المساعد يكتب",
    },
    footer: {
      linksTitle: "استكشف", contactTitle: "تواصل معنا", rights: "جميع الحقوق محفوظة.",
    },
    products: {
      emptyState: "لا توجد منتجات حالياً — تفقد الصفحة لاحقاً.", datasheetLabel: "ورقة البيانات", orderCta: "اطلب",
      currency: "KWD",
    },
    contact: {
      cardTitle: "تواصل معنا", chatCta: "تحدث معنا",
    },
    home: {
      welcome: "مرحبا بك في JDK Factory",
      tagline: "زوروا V-Lounge الخاص بنا لمزيد من المعلومات",
      heroStatement: "حلول ذكاء اصطناعي عملية ومنتجات رقمية للأعمال",
      taglineLine1: "حلول اليوم.",
      taglineLine2: "لصناعة الغد.",
      supportingText: "منتجات رقمية للشركات في الهند ودول الخليج.",
      examplePrompts: ["ما الذي تبنيه JDK Factory؟", "كيف يمكن لـ JDK Factory مساعدة أعمالي؟", "استكشف منتجاتنا"],
      hint: "ابدأ المحادثة",
      langSwitch: "EN | English",
    },
    chat: {
      taglineLine1: "حلول اليوم. ",
      taglineLine2: "لصناعة الغد.",
      sub: "تقنية وابتكار مدعومان بالذكاء الاصطناعي",
      header: "المساعد الذكي",
      onlineStatus: "متصل الآن · مساعد ذكي",
      poweredBy: "بدعم من",
      faqTitle: "أسئلة سريعة",
      inputPlaceholder: "اسأل مساعد JDK Factory أي شيء…",
      welcomeMsg:
        "مرحباً! أنا المساعد الذكي لـ JDK Factory. قبل أن نبدأ، هل لي أن أعرف اسمك؟ هذا يساعدنا على بناء علاقة أفضل معك ومتابعة طلبك بشكل صحيح.",
      langSwitch: "EN | English",
      viewProductsCta: "عرض المنتجات",
      placeOrderCta: "تقديم طلب",
    },
  },
};

export const FAQ = {
  en: [
    { q: "What services does JDK Factory offer?", a: "We build AI-powered assistants, automation, and digital products tailored to your business — from concept through to production support." },
    { q: "How can I get in touch?", a: "Chat with our AI assistant above, or reach out via the contact details on our Contact page — we'll get back to you quickly." },
    { q: "Do you support Arabic and English?", a: "Yes — the whole experience, including this assistant, works fully in both English and Arabic with proper right-to-left layout." },
    { q: "Where are you located?", a: "We work with clients globally and meet either virtually or in person — just ask and we'll accommodate you." },
  ],
  ar: [
    { q: "ما هي الخدمات التي تقدمها JDK Factory؟", a: "نصمم مساعدين مدعومين بالذكاء الاصطناعي وحلول أتمتة ومنتجات رقمية مخصصة لعملك — من الفكرة وحتى الدعم الإنتاجي." },
    { q: "كيف يمكنني التواصل معكم؟", a: "تحدث مع مساعدنا الذكي أعلاه، أو تواصل معنا عبر بيانات التواصل في صفحة اتصل بنا — سنرد عليك بسرعة." },
    { q: "هل تدعمون اللغتين العربية والإنجليزية؟", a: "نعم — التجربة بأكملها، بما في ذلك هذا المساعد، تعمل بالكامل باللغتين مع تخطيط صحيح من اليمين إلى اليسار." },
    { q: "أين يقع مقركم؟", a: "نعمل مع عملاء حول العالم ونلتقي افتراضيًا أو شخصيًا — فقط أخبرنا وسنوفر لك ما يناسبك." },
  ],
};
