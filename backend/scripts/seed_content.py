#!/usr/bin/env python3
"""
One-time content seed: reads the frontend's existing content (the
former source of truth, in ../src/content/*.md and the strings that
used to live in src/data/content.js / pages.js) and writes it into the
DB as the initial admin-editable content. After this runs, the DB rows
are authoritative — this script is what performs the migration, not
something the running app depends on.

Safe to re-run: skips any page/FAQ item/setting that already has a DB
override, so it never clobbers an admin's edits.

Requires the schema to already exist — run `alembic upgrade head`
first. This script no longer creates tables itself.

    alembic upgrade head
    python scripts/seed_content.py
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db import session_scope
from app.models import ContentPage, FaqItem, SiteSetting
from app import content_service
from app.settings_service import set_many

FRONTEND_CONTENT_DIR = Path(__file__).resolve().parent.parent.parent / "src" / "content"

# navLabel / sectionTitle / sectionBody / tagline_* hand-ported once
# here from the JS structures that used to hold them (NAV, SECTIONS,
# PAGE_META in src/data/content.js and pages.js). Full body copy is read
# directly from the .md files below rather than duplicated inline.
PAGE_META = {
    "about": {
        "en": {"navLabel": "About", "sectionTitle": "About Perennia",
               "sectionBody": "Perennia is an AI-powered technology and innovation company. We partner with businesses to design, build, and operate intelligent products — from first concept through to production support.",
               "taglineLine1": "Who We ", "taglineLine2": "Are", "taglineSub": "AI-POWERED TECHNOLOGY & INNOVATION"},
        "ar": {"navLabel": "من نحن", "sectionTitle": "عن بيرينيا",
               "sectionBody": "بيرينيا شركة تقنية وابتكار مدعومة بالذكاء الاصطناعي. نتعاون مع الشركات لتصميم وبناء وتشغيل منتجات ذكية — من الفكرة الأولى وحتى الدعم الإنتاجي.",
               "taglineLine1": "من ", "taglineLine2": "نحن", "taglineSub": "تقنية وابتكار مدعومان بالذكاء الاصطناعي"},
    },
    "products": {
        "en": {"navLabel": "Products", "sectionTitle": "Products",
               "sectionBody": "AI assistants, automation workflows, and custom digital platforms — built on modern stacks and tuned to how your team actually works.",
               "taglineLine1": "What We ", "taglineLine2": "Build", "taglineSub": "PRODUCTS & PLATFORMS"},
        "ar": {"navLabel": "المنتجات", "sectionTitle": "المنتجات",
               "sectionBody": "مساعدون بالذكاء الاصطناعي، وأتمتة سير العمل، ومنصات رقمية مخصصة — مبنية على تقنيات حديثة ومصممة لتناسب طريقة عمل فريقك.",
               "taglineLine1": "ماذا ", "taglineLine2": "نبني", "taglineSub": "المنتجات والمنصات"},
    },
    "services": {
        "en": {"navLabel": "Services", "sectionTitle": "Services",
               "sectionBody": "Consulting, product design, and full-cycle engineering. We embed with your team or run the build end-to-end, whichever fits your roadmap.",
               "taglineLine1": "How We ", "taglineLine2": "Work", "taglineSub": "CONSULTING & ENGINEERING"},
        "ar": {"navLabel": "الخدمات", "sectionTitle": "الخدمات",
               "sectionBody": "استشارات، وتصميم منتجات، وهندسة متكاملة. نندمج مع فريقك أو ننفذ المشروع بالكامل، وفق ما يناسب خطتك.",
               "taglineLine1": "كيف ", "taglineLine2": "نعمل", "taglineSub": "استشارات وهندسة"},
    },
    "contact": {
        "en": {"navLabel": "Contact Us", "sectionTitle": "Contact Us",
               "sectionBody": "Ready to talk? Use \"Talk to Us\" to book time directly, or start a chat below and our assistant will connect you with the right person.",
               "taglineLine1": "Let's ", "taglineLine2": "Talk", "taglineSub": "GET IN TOUCH"},
        "ar": {"navLabel": "تواصل معنا", "sectionTitle": "تواصل معنا",
               "sectionBody": "جاهز للتحدث؟ استخدم \"تحدث إلينا\" لحجز موعد مباشرة، أو ابدأ محادثة أدناه وسيقوم مساعدنا بتوصيلك بالشخص المناسب.",
               "taglineLine1": "لنتحدث", "taglineLine2": "", "taglineSub": "تواصل معنا"},
    },
}

FAQ_SEED = [
    {"en": {"q": "What services does Perennia offer?",
            "a": "We build AI-powered assistants, automation, and digital products tailored to your business — from concept through to production support."},
     "ar": {"q": "ما هي الخدمات التي تقدمها بيرينيا؟",
            "a": "نصمم مساعدين مدعومين بالذكاء الاصطناعي وحلول أتمتة ومنتجات رقمية مخصصة لعملك — من الفكرة وحتى الدعم الإنتاجي."}},
    {"en": {"q": "How can I book a consultation?",
            "a": "Tap \"Talk to Us\" above, choose a free slot, and you'll get an instant confirmation by email — no back-and-forth required."},
     "ar": {"q": "كيف يمكنني حجز استشارة؟",
            "a": "اضغط على \"تحدث إلينا\" أعلاه، اختر موعدًا متاحًا، وستحصل على تأكيد فوري عبر البريد الإلكتروني."}},
    {"en": {"q": "Do you support Arabic and English?",
            "a": "Yes — the whole experience, including this assistant, works fully in both English and Arabic with proper right-to-left layout."},
     "ar": {"q": "هل تدعمون اللغتين العربية والإنجليزية؟",
            "a": "نعم — التجربة بأكملها، بما في ذلك هذا المساعد، تعمل بالكامل باللغتين مع تخطيط صحيح من اليمين إلى اليسار."}},
    {"en": {"q": "Where are you located?",
            "a": "We work with clients globally and meet either virtually or in person — ask during booking and we'll accommodate you."},
     "ar": {"q": "أين يقع مقركم؟",
            "a": "نعمل مع عملاء حول العالم ونلتقي افتراضيًا أو شخصيًا — أخبرنا أثناء الحجز وسنوفر لك ما يناسبك."}},
]

# Must stay in sync with copy.home's default in settings_registry.py —
# get_setting() only merges copy.home at the top level (per-language,
# not per-field), so a DB row missing a field here would silently drop
# that field out of the live response rather than falling through to
# the registry default. See withHomeFallbacks in Hero.jsx for the
# frontend-side safety net this is meant to make unnecessary.
COPY_HOME = {
    "en": {"welcome": "Welcome to Perennia", "tagline": "Visit our V-Lounge for more",
           "heroStatement": "Practical AI\nBuilt for Businesses",
           "taglineLine1": "Solving Today.", "taglineLine2": "Shaping Tomorrow.",
           "supportingText": "Digital products for businesses across India and the GCC.",
           "examplePrompts": ["What does Perennia build?", "How can Perennia help my business?",
                                "Explore our products"],
           "hint": "Start chatting", "langSwitch": "AR | عربي"},
    "ar": {"welcome": "مرحبا بك في بيرينيا", "tagline": "زوروا V-Lounge الخاص بنا لمزيد من المعلومات",
           "heroStatement": "حلول ذكاء اصطناعي عملية ومنتجات رقمية للأعمال",
           "taglineLine1": "حلول اليوم.", "taglineLine2": "لصناعة الغد.",
           "supportingText": "منتجات رقمية للشركات في الهند ودول الخليج.",
           "examplePrompts": ["ما الذي تبنيه بيرينيا؟", "كيف يمكن لبيرينيا مساعدة أعمالي؟", "استكشف منتجاتنا"],
           "hint": "ابدأ المحادثة", "langSwitch": "EN | English"},
}

COPY_CHAT = {
    "en": {"taglineLine1": "Solving Today. ", "taglineLine2": "Shaping Tomorrow.",
           "sub": "AI-POWERED TECHNOLOGY & INNOVATION", "header": "Perennia Assistant",
           "bookBtn": "Talk to Us", "faqTitle": "Quick Questions",
           "inputPlaceholder": "Type your message…",
           "welcomeMsg": "Hello! I'm Perennia's AI assistant. Before we get started, may I know your name? "
                          "It helps us build a good relationship with you and follow up properly.",
           "langSwitch": "AR | عربي"},
    "ar": {"taglineLine1": "حلول اليوم. ", "taglineLine2": "لصناعة الغد.",
           "sub": "تقنية وابتكار مدعومان بالذكاء الاصطناعي", "header": "مساعد بيرينيا",
           "bookBtn": "تحدث إلينا", "faqTitle": "أسئلة سريعة",
           "inputPlaceholder": "اكتب رسالتك…",
           "welcomeMsg": "مرحباً! أنا المساعد الذكي لبيرينيا. قبل أن نبدأ، هل لي أن أعرف اسمك؟ "
                          "هذا يساعدنا على بناء علاقة أفضل معك ومتابعة طلبك بشكل صحيح.",
           "langSwitch": "EN | English"},
}

COPY_BOOKING = {
    "en": {"title": "Talk to Us", "subtitle": "Pick a time that works for you — we'll confirm by email.",
           "tab_new": "New Appointment", "tab_manage": "Manage Booking", "date": "Date",
           "slot": "Available times", "slot_empty": "Pick a date to see available times",
           "name": "Name", "email": "Email", "phone": "Phone (optional)",
           "service": "What are you interested in? (optional)", "notes": "Notes (optional)",
           "cancel": "Cancel", "confirm": "Confirm Booking", "lookup_id": "Appointment ID",
           "lookup_email": "Email used to book", "find_btn": "Find My Appointment",
           "cancel_appt": "Cancel Appointment", "reschedule": "Reschedule",
           "lookup_different": "Look up a different appointment", "new_date": "New date",
           "back": "Back", "confirm_new_time": "Confirm New Time",
           "success_new": "You're booked! Confirmation code: {id}. A confirmation email is on its way.",
           "success_cancel": "Your appointment has been cancelled.",
           "success_reschedule": "All set — your appointment is now on {date} at {time}.",
           "id_placeholder": "PRN-XXXXXXXX",
           "no_availability": "No availability that day — try another date.",
           "err_pick_date_slot": "Please pick a date and time.",
           "err_name": "Please enter your name.",
           "err_email": "Please enter a valid email.",
           "err_lookup_both": "Enter both the appointment ID and email.",
           "err_pick_new_date_slot": "Pick a new date and time.",
           "errors": {
               "slot_unavailable": "That time is no longer available — please pick another.",
               "notice_window_passed": "This is too close to the appointment time to make that change.",
               "not_found": "We couldn't find a matching appointment.",
               "invalid_email": "Please enter a valid email.",
               "invalid_name": "Please enter your name.",
               "invalid_date": "That date isn't valid.",
               "already_cancelled": "This appointment has already been cancelled.",
               "booking_disabled": "Booking is currently unavailable — please check back soon.",
               "generic": "Something went wrong — please try again.",
           }},
    "ar": {"title": "تحدث إلينا", "subtitle": "اختر الوقت المناسب لك — سنؤكد ذلك عبر البريد الإلكتروني.",
           "tab_new": "موعد جديد", "tab_manage": "إدارة الحجز", "date": "التاريخ",
           "slot": "الأوقات المتاحة", "slot_empty": "اختر تاريخًا لرؤية الأوقات المتاحة",
           "name": "الاسم", "email": "البريد الإلكتروني", "phone": "الهاتف (اختياري)",
           "service": "ما الذي يهمك؟ (اختياري)", "notes": "ملاحظات (اختياري)",
           "cancel": "إلغاء", "confirm": "تأكيد الحجز", "lookup_id": "رقم الموعد",
           "lookup_email": "البريد الإلكتروني المستخدم للحجز", "find_btn": "ابحث عن موعدي",
           "cancel_appt": "إلغاء الموعد", "reschedule": "إعادة الجدولة",
           "lookup_different": "البحث عن موعد آخر", "new_date": "تاريخ جديد",
           "back": "رجوع", "confirm_new_time": "تأكيد الوقت الجديد",
           "success_new": "تم الحجز! رمز التأكيد: {id}. بريد التأكيد في طريقه إليك.",
           "success_cancel": "تم إلغاء موعدك.",
           "success_reschedule": "تم! موعدك الآن في {date} الساعة {time}.",
           "id_placeholder": "PRN-XXXXXXXX",
           "no_availability": "لا توجد مواعيد متاحة في هذا اليوم — جرّب تاريخًا آخر.",
           "err_pick_date_slot": "يرجى اختيار تاريخ ووقت.",
           "err_name": "يرجى إدخال اسمك.",
           "err_email": "يرجى إدخال بريد إلكتروني صالح.",
           "err_lookup_both": "أدخل رقم الموعد والبريد الإلكتروني معًا.",
           "err_pick_new_date_slot": "اختر تاريخًا ووقتًا جديدين.",
           "errors": {
               "slot_unavailable": "لم يعد هذا الوقت متاحًا — يرجى اختيار وقت آخر.",
               "notice_window_passed": "الوقت المتبقي غير كافٍ لإجراء هذا التغيير.",
               "not_found": "لم نتمكن من العثور على موعد مطابق.",
               "invalid_email": "يرجى إدخال بريد إلكتروني صالح.",
               "invalid_name": "يرجى إدخال اسمك.",
               "invalid_date": "هذا التاريخ غير صالح.",
               "already_cancelled": "تم إلغاء هذا الموعد بالفعل.",
               "booking_disabled": "الحجز غير متاح حاليًا — يرجى المحاولة لاحقًا.",
               "generic": "حدث خطأ ما — يرجى المحاولة مرة أخرى.",
           }},
}


def _read_md(lang: str, slug: str) -> str:
    path = FRONTEND_CONTENT_DIR / lang / f"{slug}.md"
    if not path.exists():
        print(f"  WARNING: {path} not found, leaving bodyMarkdown empty for {slug}/{lang}")
        return ""
    return path.read_text(encoding="utf-8").strip()


def main() -> None:
    # Schema is owned by Alembic (see alembic/versions/). Run
    # `alembic upgrade head` before this script. This used to call
    # Base.metadata.create_all(bind=engine) here, which created tables
    # directly and left alembic_version unset — the next `alembic
    # upgrade head` would then fail with "table already exists".
    with session_scope() as db:
        # --- pages ---
        for order, (slug, per_lang) in enumerate(PAGE_META.items()):
            if db.get(ContentPage, slug) is not None:
                print(f"Page '{slug}' already exists — skipping.")
                continue
            translations = {
                lang: {**fields, "bodyMarkdown": _read_md(lang, slug)}
                for lang, fields in per_lang.items()
            }
            content_service.upsert_page(db, slug, translations=translations, order=order,
                                         actor_id=None, actor_username="seed_script")
            print(f"Seeded page '{slug}'.")

        # --- FAQ ---
        if db.query(FaqItem).count() == 0:
            for order, translations in enumerate(FAQ_SEED):
                content_service.create_faq(db, translations=translations, order=order,
                                            actor_id=None, actor_username="seed_script")
            print(f"Seeded {len(FAQ_SEED)} FAQ items.")
        else:
            print("FAQ items already exist — skipping.")

        # --- copy blobs ---
        to_set = {}
        for key, value in (("copy.home", COPY_HOME), ("copy.chat", COPY_CHAT), ("copy.booking", COPY_BOOKING)):
            if db.get(SiteSetting, key) is None:
                to_set[key] = value
            else:
                print(f"Setting '{key}' already overridden — skipping.")
        if to_set:
            set_many(db, to_set, actor_id=None, actor_username="seed_script")
            print(f"Seeded copy blobs: {list(to_set)}.")


if __name__ == "__main__":
    main()
