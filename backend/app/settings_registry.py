"""
The settings registry: THE single source of truth for "everything
configurable" on the site.

Why a registry instead of a settings table with real columns, or a
hand-written admin endpoint per field (the reference app's approach)?
Because both of those force you to touch N places — a migration, a
Pydantic model, a route handler, an admin form — every single time you
add one configurable field. That's exactly the repetition this project
was asked to avoid, and it's how a 57KB main.py happens.

Here, adding a new configurable field is ONE line: a `SettingDef` entry
below. Everything downstream — DB storage, validation, the generic
admin CRUD API (routers/admin_settings.py), the public config API
(routers/public_config.py), and (Pass 8) the generic admin settings
form — reads this registry and needs no per-field code.

Categories map directly to admin panel sections. Each pass adds entries
to existing or new categories; no pass should need to add a new *code
path*, only new *entries*.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable


class SettingType(str, Enum):
    STRING = "string"        # short single-line text
    TEXT = "text"             # multi-line text / markdown
    INT = "int"
    FLOAT = "float"
    BOOL = "bool"
    COLOR = "color"           # hex color, admin renders a color picker
    URL = "url"
    EMAIL = "email"
    IMAGE = "image"           # URL to an uploaded image (Pass 3 adds upload)
    ENUM = "enum"              # one of `choices`
    LIST = "list"              # JSON list of strings
    JSON = "json"              # arbitrary JSON blob (structured content, Pass 2+)


@dataclass(frozen=True)
class SettingDef:
    key: str                      # dotted path, e.g. "branding.siteName"
    category: str                 # admin panel section, e.g. "branding"
    label: str                    # human label shown in admin UI
    type: SettingType
    default: Any
    help_text: str = ""
    secret: bool = False          # encrypted at rest, never in public config API
    choices: tuple[str, ...] | None = None   # required for ENUM
    i18n: bool = False            # if true, value is {lang_code: value} JSON
    validator: Callable[[Any], None] | None = field(default=None, repr=False)

    def validate(self, value: Any) -> None:
        if self.i18n:
            if not isinstance(value, dict):
                raise ValueError(f"{self.key}: expected an object keyed by language code")
            for lang, v in value.items():
                self._validate_single(v)
            return
        self._validate_single(value)

    def _validate_single(self, value: Any) -> None:
        t = self.type
        if t == SettingType.BOOL and not isinstance(value, bool):
            raise ValueError(f"{self.key}: expected bool")
        if t == SettingType.INT and not isinstance(value, int):
            raise ValueError(f"{self.key}: expected int")
        if t == SettingType.FLOAT and not isinstance(value, (int, float)):
            raise ValueError(f"{self.key}: expected number")
        if t == SettingType.COLOR:
            if not (isinstance(value, str) and _is_hex_color(value)):
                raise ValueError(f"{self.key}: expected hex color like #RRGGBB")
        if t == SettingType.ENUM:
            if value not in (self.choices or ()):
                raise ValueError(f"{self.key}: must be one of {self.choices}")
        if t == SettingType.LIST and not isinstance(value, list):
            raise ValueError(f"{self.key}: expected a list")
        if t == SettingType.JSON and not isinstance(value, (dict, list)):
            raise ValueError(f"{self.key}: expected an object or array")
        if t in (SettingType.STRING, SettingType.TEXT, SettingType.URL, SettingType.EMAIL, SettingType.IMAGE):
            if not isinstance(value, str):
                raise ValueError(f"{self.key}: expected string")
        if self.validator:
            self.validator(value)


def _is_hex_color(v: str) -> bool:
    import re
    return bool(re.match(r"^#(?:[0-9a-fA-F]{3}){1,2}$", v))


def _url_or_empty(v: str) -> None:
    if v and not (v.startswith("http://") or v.startswith("https://") or v.startswith("/")):
        raise ValueError("must be an absolute URL or a root-relative path")


def _px_range(lo: int, hi: int):
    def _check(v: int) -> None:
        if not (lo <= v <= hi):
            raise ValueError(f"must be between {lo} and {hi}")
    return _check


def _int_range(lo: int, hi: int):
    def _check(v: int) -> None:
        if not (lo <= v <= hi):
            raise ValueError(f"must be between {lo} and {hi}")
    return _check


def _float_range(lo: float, hi: float):
    def _check(v: float) -> None:
        if not (lo <= v <= hi):
            raise ValueError(f"must be between {lo} and {hi}")
    return _check


def _hero_buttons(v: list) -> None:
    if not isinstance(v, list):
        raise ValueError("expected a list of {label, url} objects")
    if len(v) > 8:
        raise ValueError("at most 8 buttons")
    for i, btn in enumerate(v):
        if not isinstance(btn, dict):
            raise ValueError(f"button {i}: expected an object")
        label = btn.get("label")
        if not isinstance(label, dict) or not any(str(t).strip() for t in label.values()):
            raise ValueError(f"button {i}: label must be a non-empty {{lang: text}} object")
        url = btn.get("url", "")
        if not isinstance(url, str) or not url.strip():
            raise ValueError(f"button {i}: url is required")
        if not (url.startswith("http://") or url.startswith("https://") or url.startswith("/")):
            raise ValueError(f"button {i}: url must be absolute http(s) or a root-relative path")


# ── Registry ──────────────────────────────────────────────────────────
# Grouped by category purely for readability; the flat dict below is
# what code actually consumes.

_DEFS: list[SettingDef] = [
    # branding ------------------------------------------------------
    SettingDef("branding.siteName", "branding", "Site name", SettingType.STRING,
               {"en": "Perennia", "ar": "بيرينيا"}, i18n=True,
               help_text="Shown in the header, browser tab, and emails. Per-language, since a wordmark "
                          "often isn't a literal translation."),
    SettingDef("branding.tagline", "branding", "Tagline", SettingType.STRING, {"en": "", "ar": ""}, i18n=True),
    SettingDef("branding.logoUrl", "branding", "Logo", SettingType.IMAGE, "/static/logo.svg"),
    SettingDef("branding.logoScale", "branding", "Logo zoom", SettingType.FLOAT, 1.0,
               help_text="Display size of the logo image relative to its default — logos with a lot "
                          "of built-in padding often look small next to the header text at 1.0x.",
               validator=_float_range(0.5, 3.0)),
    SettingDef("branding.faviconUrl", "branding", "Favicon", SettingType.IMAGE, "/favicon.svg"),
    SettingDef("branding.metaDescription", "branding", "Search/share description", SettingType.TEXT,
               {"en": "Perennia — AI-powered technology & innovation.", "ar": ""}, i18n=True,
               help_text="Shown in search results and link previews (og:description)."),

    # locale ----------------------------------------------------------
    SettingDef("locale.defaultLanguage", "locale", "Default language", SettingType.ENUM, "en",
               choices=("en", "ar")),
    SettingDef("locale.supportedLanguages", "locale", "Supported languages", SettingType.LIST, ["en", "ar"]),

    # contact -----------------------------------------------------------
    SettingDef("contact.email", "contact", "Contact email", SettingType.EMAIL, ""),
    SettingDef("contact.phone", "contact", "Contact phone", SettingType.STRING, ""),
    SettingDef("contact.whatsappNumber", "contact", "WhatsApp number", SettingType.STRING, "",
               help_text="Include country code, digits only, e.g. 96599999999."),
    SettingDef("contact.address", "contact", "Address", SettingType.TEXT, {"en": "", "ar": ""}, i18n=True),

    # theme — brand identity. Deliberately a SMALL set of base tokens
    # (colors, fonts, a few layout metrics) rather than every CSS custom
    # property in tokens.css: the frontend derives the full palette
    # (navy scale, glass surfaces, gold gradient shades, etc.) from
    # these few values using CSS color-mix(), so a full re-theme only
    # ever requires changing what's here — see src/styles/tokens.css
    # and PASS3_NOTES.md for the derivation.
    SettingDef("theme.primaryColor", "theme", "Primary color", SettingType.COLOR, "#c9a84c",
               help_text="Main accent — buttons, links, highlights."),
    SettingDef("theme.accentColor", "theme", "Accent color", SettingType.COLOR, "#e8c96a",
               help_text="Secondary accent, used alongside the primary color in gradients."),
    SettingDef("theme.backgroundColor", "theme", "Background color", SettingType.COLOR, "#07060a",
               help_text="Base dark surface color the whole app is built on."),
    SettingDef("theme.textColor", "theme", "Text color", SettingType.COLOR, "#f5f0e8",
               help_text="Primary light text color against the background."),
    SettingDef("theme.fontDisplay", "theme", "Display font (headings)", SettingType.STRING,
               '"Cormorant Garamond", Georgia, serif'),
    SettingDef("theme.fontBody", "theme", "Body font", SettingType.STRING,
               '"Syne", system-ui, -apple-system, sans-serif'),
    SettingDef("theme.fontAr", "theme", "Arabic font", SettingType.STRING,
               '"Noto Kufi Arabic", "Arial Unicode MS", sans-serif'),
    SettingDef("theme.googleFontsUrl", "theme", "Google Fonts stylesheet URL", SettingType.URL,
               "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600;700"
               "&family=Syne:wght@500;600;700;800&family=Noto+Kufi+Arabic:wght@300;400;500;600;700"
               "&display=swap",
               help_text="Must include every font family referenced above, or those fonts won't load."),
    SettingDef("theme.headerHeightPx", "theme", "Header height (px)", SettingType.INT, 64,
               validator=_px_range(40, 160)),
    SettingDef("theme.contentMaxWidthPx", "theme", "Content max width (px)", SettingType.INT, 1180,
               validator=_px_range(600, 2400)),
    SettingDef("theme.cornerRadiusPx", "theme", "Corner radius (px)", SettingType.INT, 10,
               help_text="Base radius — smaller and larger UI elements scale proportionally from this.",
               validator=_px_range(0, 48)),
    SettingDef("theme.heroAutoAdvanceSeconds", "theme", "Home auto-advance (seconds)", SettingType.INT, 7,
               help_text="How long the home screen waits before auto-continuing into chat.",
               validator=_int_range(2, 60)),
    # Which homepage layout arrangement to render — purely a client-side
    # choice of *structure* (how the same headline/tagline/quick-chat/nav
    # pieces are composed on the page), never colors/fonts (those stay
    # theme.primaryColor etc. above) and never which features exist.
    # "classic" is both the default and the site's original/only layout
    # before this setting existed, so an unset or unrecognized value here
    # can never regress an existing deployment — the frontend falls back
    # to it (see src/components/hero/Hero.jsx).
    SettingDef("theme.layoutTemplate", "theme", "Homepage layout", SettingType.ENUM, "classic",
               choices=("classic", "split", "centered-card", "editorial"),
               help_text="How the homepage headline, quick-chat box, and page-navigation cards are arranged. "
                          "Colors and fonts are unaffected — set those above."),
    # Purely the headline's text *treatment* (fill/animation) — never
    # its content (that's copy.home.welcome) and never layout (that's
    # theme.layoutTemplate above). "ripple-gradient" is both the
    # default and the site's original/only headline style before this
    # setting existed, so it's the safe fallback for any unset or
    # unrecognized value (see src/components/hero/HeroShared.jsx).
    SettingDef("theme.headlineStyle", "theme", "Headline style", SettingType.ENUM, "ripple-gradient",
               choices=("ripple-gradient", "solid-gold", "solid-white", "two-tone", "outline"),
               help_text="Visual treatment of the homepage headline text. Uses the theme colors above — "
                          "changing the theme preset changes how each of these looks too."),
    # Homepage headline pacing — how fast copy.home.heroStatement types
    # out, and how slowly it dissolves into the permanent tagline once
    # done. Split into two settings (rather than one "speed" enum)
    # because they're genuinely independent: an admin might want a slow,
    # dramatic type-out with a snappy handoff, or vice versa. 5 cps is a
    # deliberately unhurried default (the site's original hardcoded rate
    # was ~45 cps); admins with a short statement may want it faster.
    SettingDef("theme.headlineTypingSpeedCps", "theme", "Headline typing speed (characters/second)",
               SettingType.INT, 5,
               help_text="How fast the homepage headline types itself out. Lower = slower, more dramatic. "
                          "Only affects copy.home.heroStatement — the permanent tagline beneath it is never "
                          "animated.",
               validator=_int_range(1, 40)),
    SettingDef("theme.headlineDissolveMs", "theme", "Headline dissolve transition (ms)",
               SettingType.INT, 2500,
               help_text="How long the crossfade from the typed statement to the permanent tagline "
                          "(taglineLine1/taglineLine2) takes, in milliseconds.",
               validator=_int_range(200, 8000)),
    # ── Pass 1 of the whole-page style system (surfaces + buttons).
    # Both are unified, cross-component toggles — one setting changes
    # every covered element at once, not per-component overrides. See
    # src/styles/themeVariants.css for exactly what each value does.
    #
    # "glass" / "default" reproduce today's actual appearance byte-for-
    # byte (glass is a real style choice that happens to already be
    # what's live; "default" for buttons means "each button keeps its
    # own current look" since today's buttons are NOT visually
    # uniform — the CTA pills are outlined/glass, the sticky buttons
    # are solid-filled). Either is always the safe fallback for an
    # unset or unrecognized value, so no existing deployment regresses.
    SettingDef("theme.surfaceStyle", "theme", "Card & panel surface", SettingType.ENUM, "glass",
               choices=("glass", "solid", "outline", "elevated"),
               help_text="Fill treatment for cards and panels site-wide: the chat widget "
                          "and homepage nav/content cards. 'glass' is today's blurred, translucent look."),
    SettingDef("theme.buttonStyle", "theme", "Buttons & pills", SettingType.ENUM, "default",
               choices=("default", "solid", "outline", "ghost", "gradient"),
               help_text="Fill treatment for call-to-action buttons and pills site-wide: homepage quick-"
                          "link buttons, the centered-card pills, and the sticky Appointments/AI Assistant "
                          "buttons. 'default' keeps each button's current individual look; every other "
                          "choice makes them all match one unified style."),
    # ── Pass 2 of the whole-page style system (typography). "standard"
    # / "as-is" reproduce today's actual font sizes and heading
    # casing exactly, so they're the safe fallback for any unset or
    # unrecognized value. See src/styles/themeVariants.css.
    SettingDef("theme.typeScale", "theme", "Text size scale", SettingType.ENUM, "standard",
               choices=("standard", "compact", "comfortable", "large"),
               help_text="Global size for body text, small text, and section-card headings site-wide. "
                          "Doesn't affect the homepage headline, which sizes itself to fit the page."),
    SettingDef("theme.headingCase", "theme", "Section heading style", SettingType.ENUM, "as-is",
               choices=("as-is", "uppercase-tracked", "sentence-case"),
               help_text="Casing and letter-spacing for section/card titles (e.g. the homepage nav "
                          "cards). 'as-is' keeps today's normal-case headings."),
    # ── Pass 3 of the whole-page style system (background & texture).
    # "grid" / "subtle" reproduce today's actual background exactly —
    # a solid fill plus a faint grid-mesh overlay — so they're the
    # safe fallback for any unset or unrecognized value.
    SettingDef("theme.backgroundStyle", "theme", "Background pattern", SettingType.ENUM, "grid",
               choices=("grid", "dot-grid", "radial-glow", "solid"),
               help_text="Texture behind all page content. 'grid' is today's faint line-mesh overlay; "
                          "'solid' removes the overlay entirely."),
    SettingDef("theme.backgroundIntensity", "theme", "Background intensity", SettingType.ENUM, "subtle",
               choices=("subtle", "soft", "bold", "off"),
               help_text="How strong the background pattern above is. 'off' hides it regardless of "
                          "which pattern is selected."),
    # ── Pass 4 of the whole-page style system (spacing & density).
    # "comfortable" / "standard" reproduce today's actual spacing and
    # section rhythm exactly, so they're the safe fallback for any
    # unset or unrecognized value.
    SettingDef("theme.density", "theme", "Spacing density", SettingType.ENUM, "comfortable",
               choices=("compact", "comfortable", "spacious"),
               help_text="Padding, gaps, and prose line-height site-wide — every card, button, and "
                          "text block scales together. 'comfortable' is today's spacing."),
    SettingDef("theme.sectionRhythm", "theme", "Section rhythm", SettingType.ENUM, "standard",
               choices=("tight", "standard", "loose"),
               help_text="Breathing room specifically between major page sections (e.g. the gap before "
                          "the homepage's nav-card grid) — independent of the density setting above, "
                          "so you can pair tight card spacing with generous section gaps, or vice versa."),

    # features (toggles for capabilities landing in later passes,
    # declared now so the admin can already see what's coming and
    # nothing needs a hardcoded `if` for "is this feature on") --------
    SettingDef("features.chatEnabled", "features", "Enable AI chat widget", SettingType.BOOL, True),
    SettingDef("features.whatsappWidgetEnabled", "features", "Enable WhatsApp widget", SettingType.BOOL, False),

    # chat — LLM-powered assistant configuration. The API key is the
    # only secret setting in the app so far (Fernet-encrypted at rest
    # by settings_service.py, never returned by any read endpoint).
    # Everything else here — provider, model, prompt, sampling
    # parameters, and the fallback message shown when no key is
    # configured — is ordinary admin-editable config, so the whole
    # assistant's behavior and persona can be retuned without a deploy.
    SettingDef("chat.llmProvider", "chat", "LLM provider", SettingType.ENUM, "none",
               choices=("none", "anthropic", "openai", "deepseek"),
               help_text="'none' disables real LLM calls; the assistant uses the fallback message below."),
    SettingDef("chat.llmModel", "chat", "Model", SettingType.STRING, "claude-sonnet-4-6"),
    SettingDef("chat.llmApiKey", "chat", "API key", SettingType.STRING, "", secret=True),
    SettingDef("chat.maxTokens", "chat", "Max response tokens", SettingType.INT, 512,
               validator=_int_range(16, 4096)),
    SettingDef("chat.temperature", "chat", "Temperature", SettingType.FLOAT, 0.7,
               validator=_float_range(0.0, 1.0)),
    # Shown next to the assistant in both the sticky widget (ChatWidget)
    # and the homepage quick-chat box (Hero) — the same image in both
    # places, so the two entry points read as one assistant rather than
    # two different ones. Blank falls back to a plain initial-letter
    # avatar (see src/components/chat/ChatWidget.jsx).
    SettingDef("chat.avatarUrl", "chat", "Assistant avatar", SettingType.IMAGE, "",
               help_text="Shown next to the assistant in the AI Assistant widget and the homepage "
                          "quick-chat box. Leave blank to use a plain initial-letter avatar instead."),
    SettingDef("chat.systemPrompt", "chat", "System prompt", SettingType.TEXT, {
        "en": "You are Perennia's AI assistant. Be warm, concise, and professional. Early in the "
              "conversation, ask the visitor's name so you can personalize the chat and so the team can "
              "follow up. Help visitors understand Perennia's AI products and services.",
        "ar": "أنت المساعد الذكي لشركة بيرينيا. كن ودودًا ومختصرًا ومحترفًا. في وقت مبكر من المحادثة، اسأل "
              "الزائر عن اسمه حتى تتمكن من تخصيص المحادثة ومتابعة الطلب. ساعد الزوار على فهم منتجات وخدمات "
              "بيرينيا.",
    }, i18n=True),
    SettingDef("chat.unavailableMessage", "chat", "Fallback message (LLM unavailable)", SettingType.TEXT, {
        "en": "Thanks for sharing that! Someone from our team will follow up shortly.",
        "ar": "شكرًا لك! سيقوم أحد أعضاء فريقنا بمتابعة رسالتك قريبًا.",
    }, i18n=True, help_text="Shown when no LLM provider is configured, or if a request to it fails."),
    SettingDef("chat.maxTurns", "chat", "Max exchanges per session", SettingType.INT, 15,
               help_text="Once a visitor's user-turn count in one session passes this, the turn-limit "
                          "message below is shown instead of calling the LLM again.",
               validator=_int_range(3, 100)),
    SettingDef("chat.turnLimitMessage", "chat", "Turn-limit message", SettingType.TEXT, {
        "en": "You've reached the message limit for this session. We'd love to keep the conversation "
              "going directly — please reach out to our team.",
        "ar": "لقد وصلت إلى الحد الأقصى لعدد الرسائل في هذه الجلسة. يسعدنا مواصلة الحديث مباشرة — "
              "تواصل مع فريقنا.",
    }, i18n=True, help_text="Shown once a visitor exceeds the max exchanges above, in place of a real reply."),

    # notifications — outbound email/WhatsApp for internal staff alerts.
    # Every send is best-effort: a notification failure (bad SMTP
    # creds, provider down) never fails the chat request that
    # triggered it — see notification_service.py. Both channels
    # default fully OFF so an admin opts in deliberately rather than
    # the app silently trying (and failing) to send mail with no
    # configuration.
    SettingDef("notifications.emailEnabled", "notifications", "Enable email notifications", SettingType.BOOL, False),
    SettingDef("notifications.smtpHost", "notifications", "SMTP host", SettingType.STRING, ""),
    SettingDef("notifications.smtpPort", "notifications", "SMTP port", SettingType.INT, 587,
               validator=_int_range(1, 65535)),
    SettingDef("notifications.smtpUsername", "notifications", "SMTP username", SettingType.STRING, ""),
    SettingDef("notifications.smtpPassword", "notifications", "SMTP password", SettingType.STRING, "", secret=True),
    SettingDef("notifications.smtpUseTls", "notifications", "Use STARTTLS", SettingType.BOOL, True),
    SettingDef("notifications.fromEmail", "notifications", "From address", SettingType.EMAIL, ""),
    SettingDef("notifications.fromName", "notifications", "From name", SettingType.STRING, "",
               help_text="Falls back to the site name if left blank."),
    SettingDef("notifications.adminAlertEmail", "notifications", "Internal alert email", SettingType.EMAIL, "",
               help_text="Where new-lead alerts are sent. Leave blank to disable."),
    SettingDef("notifications.whatsappEnabled", "notifications", "Enable WhatsApp notifications", SettingType.BOOL, False),
    SettingDef("notifications.whatsappProvider", "notifications", "WhatsApp provider", SettingType.ENUM, "none",
               choices=("none", "twilio", "meta_cloud")),
    SettingDef("notifications.whatsappAccountId", "notifications", "Account ID", SettingType.STRING, "",
               help_text="Twilio Account SID, or Meta phone number ID."),
    SettingDef("notifications.whatsappApiKey", "notifications", "API key / auth token", SettingType.STRING, "",
               secret=True),
    SettingDef("notifications.whatsappFromNumber", "notifications", "Sender number", SettingType.STRING, "",
               help_text="Required for Twilio; unused for Meta Cloud API (the account ID identifies the sender)."),

    # templates — editable, bilingual notification content. Every
    # send in notification_service.py renders one of these rather than
    # having any wording hardcoded in Python, so the exact phrasing of
    # an alert is an admin edit like everything else. {email}/{message}
    # placeholders are filled in at send time — see notification_service.render().
    SettingDef("templates.newLeadAdminAlert", "templates", "New lead — internal alert", SettingType.JSON, {
        "en": {"subject": "New lead from chat: {email}",
               "body": "A new lead came in via chat.\nEmail: {email}\nMessage: {message}"},
    }, help_text="Internal alert, English only by default — this is for staff, not visitors."),

    # copy — free-form UI microcopy blobs, grouped by the screen that
    # uses them (home / chat). Kept as JSON blobs rather than
    # exploded into one registry entry per string: these ~10-15 strings
    # per screen are always edited together, so one admin form per
    # screen (Pass 8) makes more sense than fifteen tiny form fields.
    # Structured content that's genuinely record-shaped (pages, FAQ)
    # lives in content_schema.py / content_service.py instead — see
    # PASS2_NOTES.md for why the split.
    SettingDef("copy.home", "copy", "Home screen text", SettingType.JSON, {
        "en": {
            "welcome": "Welcome to Perennia",
            "tagline": "Visit our V-Lounge for more",
            "heroStatement": "Practical AI\nBuilt for Businesses",
            "taglineLine1": "Solving Today.",
            "taglineLine2": "Shaping Tomorrow.",
            "supportingText": "Digital products for businesses across India and the GCC.",
            "examplePrompts": ["What does Perennia build?", "How can Perennia help my business?",
                                 "Explore our products"],
            "hint": "Start chatting",
            "langSwitch": "AR | عربي",
        },
        "ar": {
            "welcome": "مرحبا بك في بيرينيا",
            "tagline": "زوروا V-Lounge الخاص بنا لمزيد من المعلومات",
            "heroStatement": "حلول ذكاء اصطناعي عملية ومنتجات رقمية للأعمال",
            "taglineLine1": "حلول اليوم.",
            "taglineLine2": "لصناعة الغد.",
            "supportingText": "منتجات رقمية للشركات في الهند ودول الخليج.",
            "examplePrompts": ["ما الذي تبنيه بيرينيا؟", "كيف يمكن لبيرينيا مساعدة أعمالي؟", "استكشف منتجاتنا"],
            "hint": "ابدأ المحادثة",
            "langSwitch": "EN | English",
        },
    }, i18n=True,
               help_text="welcome, tagline, hint, langSwitch, heroStatement, taglineLine1, taglineLine2, "
                          "supportingText, examplePrompts. heroStatement types itself out on the homepage "
                          "before handing off to taglineLine1/2 (see theme.headlineTypingSpeedCps and "
                          "theme.headlineDissolveMs above) — include a literal newline in the string to "
                          "have it type across two lines instead of one."),
    SettingDef("copy.chat", "copy", "Chat screen text", SettingType.JSON, {"en": {}, "ar": {}}, i18n=True,
               help_text="taglineLine1, taglineLine2, sub, header, faqTitle, inputPlaceholder, welcomeMsg, langSwitch"),
    SettingDef("copy.common", "copy", "Shared accessibility labels", SettingType.JSON, {
        "en": {"close": "Close", "back": "Back", "send": "Send", "quickMenu": "Quick menu",
               "primaryNav": "Primary", "goHome": "Go to home", "assistantTyping": "Assistant is typing"},
        "ar": {"close": "إغلاق", "back": "رجوع", "send": "إرسال", "quickMenu": "قائمة سريعة",
               "primaryNav": "الأساسية", "goHome": "الذهاب إلى الرئيسية", "assistantTyping": "المساعد يكتب"},
    }, i18n=True,
               help_text="Screen-reader labels used across multiple screens (close/back/send buttons, nav "
                          "landmarks) — not visible text, but still shown to assistive-technology users in "
                          "whichever language they're browsing in."),
    SettingDef("copy.homeHeroButtons", "copy", "Home hero buttons", SettingType.JSON, [],
               help_text="Slim buttons shown on the home screen in place of the tagline. List of "
                          "objects: {\"label\": {\"en\": \"...\", \"ar\": \"...\"}, \"url\": \"...\"}. "
                          "Empty list falls back to the tagline text. URL must be absolute http(s) "
                          "or a root-relative path.",
               validator=_hero_buttons),

    # knowledge — the chat assistant's grounding documents (uploaded
    # files and fetched web pages). No embeddings/vector search: every
    # active source's (capped) text is concatenated straight into the
    # system prompt on each reply — see chat_service.py and
    # knowledge_service.py. These settings bound how much that can
    # grow, since prompt size directly affects LLM cost and latency.
    SettingDef("knowledge.enabled", "knowledge", "Use knowledge base in chat replies", SettingType.BOOL, True),
    SettingDef("knowledge.maxTotalSources", "knowledge", "Max sources", SettingType.INT, 20,
               help_text="Uploads/URLs beyond this must be removed before adding another.",
               validator=_int_range(1, 200)),
    SettingDef("knowledge.maxCharsPerSource", "knowledge", "Max characters per source", SettingType.INT, 8000,
               help_text="Longer documents are truncated at upload/fetch time.",
               validator=_int_range(500, 50000)),
    SettingDef("knowledge.maxLinesInPrompt", "knowledge", "Max lines per source sent to the LLM",
               SettingType.INT, 50,
               help_text="Defense-in-depth against prompt injection via an uploaded document: caps how much "
                          "of any one source can reach the model, so a huge or adversarial upload can't crowd "
                          "out the assistant's actual instructions.",
               validator=_int_range(5, 500)),
]

for _d in _DEFS:
    if _d.type == SettingType.URL or _d.type == SettingType.IMAGE:
        object.__setattr__(_d, "validator", _url_or_empty)

REGISTRY: dict[str, SettingDef] = {d.key: d for d in _DEFS}

CATEGORIES: list[str] = sorted({d.category for d in _DEFS})


def defs_for_category(category: str) -> list[SettingDef]:
    return [d for d in _DEFS if d.category == category]


def get_def(key: str) -> SettingDef:
    d = REGISTRY.get(key)
    if d is None:
        raise KeyError(f"Unknown setting key: {key!r} (not in settings_registry.REGISTRY)")
    return d
