#!/usr/bin/env python3
"""
Populates the admin-editable content (Pages, FAQ, on-screen text, chat
prompt, Products catalog) with JDK Factory's cement content, and rewrites
any leftover legacy brand text already stored in the database.

Content comes from the repo, so the website's bundled fallback and the
database can never drift apart:

  * src/content/site.json        nav labels, page taglines, FAQ, home/chat
                                 copy, chat system prompt, product range
  * src/content/<lang>/<slug>.md full page bodies (Markdown)

Modes
-----
  python scripts/seed_content.py
      Safe to re-run any time. Only fills what is MISSING — pages, FAQ
      items, settings and products that already exist are left exactly as
      an admin edited them. It ALWAYS runs the rebrand pass (below).

  python scripts/seed_content.py --force
      Overwrites the seeded pages, FAQ, and the home/chat copy, system
      prompt, meta description and address with the repo's content. Use
      once to replace old/AI-company content. Previous page text is kept
      as a version (Admin > Pages > history) so it can be rolled back.
      Products are never overwritten (an admin owns prices), and stale
      pages (e.g. the old "services" page) are hidden, not deleted.

Rebrand pass (every run)
------------------------
Replaces the legacy brand name ("Perennia" / Arabic "بيرينيا") with
"JDK Factory" everywhere text is stored: settings, pages, FAQ items,
products and knowledge-base sources. Idempotent.

Requires the schema to already exist:  alembic upgrade head
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app import content_service, products_service
from app.db import session_scope
from app.models import (
    AuditLog, ContentPage, FaqItem, KnowledgeSource, Product, SiteSetting,
)
from app.settings_service import invalidate_cache, set_many

BRAND = "JDK Factory"

FRONTEND_CONTENT_DIR = Path(__file__).resolve().parent.parent.parent / "src" / "content"
SITE_JSON = FRONTEND_CONTENT_DIR / "site.json"

# Pages the site no longer has; hidden (never deleted) under --force.
STALE_PAGE_SLUGS = ("services",)

ACTOR = "seed_script"


# ── legacy brand rewrite ─────────────────────────────────────────────

_LEGACY_EN = re.compile(r"perennia", re.IGNORECASE)


def rebrand_text(s: str) -> str:
    # "ل" (for/to) is glued to the name in Arabic; attached to a Latin
    # word it reads badly, so it becomes "لـ JDK Factory".
    s = s.replace("لبيرينيا", "لـ " + BRAND).replace("بيرينيا", BRAND)
    return _LEGACY_EN.sub(BRAND, s)


def rebrand_json(value):
    """Recursively rewrites every string inside a JSON-like value."""
    if isinstance(value, str):
        return rebrand_text(value)
    if isinstance(value, list):
        return [rebrand_json(v) for v in value]
    if isinstance(value, dict):
        return {k: rebrand_json(v) for k, v in value.items()}
    return value


def rebrand_database(db) -> dict[str, int]:
    counts = {"settings": 0, "pages": 0, "faq": 0, "products": 0, "knowledge": 0}

    for row in db.query(SiteSetting).filter(SiteSetting.is_secret.is_(False)).all():
        try:
            current = json.loads(row.value)
        except ValueError:
            continue
        updated = rebrand_json(current)
        if updated != current:
            row.value = json.dumps(updated)  # same encoding settings_service uses
            counts["settings"] += 1

    for page in db.query(ContentPage).all():
        updated = rebrand_json(page.translations)
        if updated != page.translations:
            page.translations = updated  # reassign so SQLAlchemy sees the change
            counts["pages"] += 1

    for item in db.query(FaqItem).all():
        updated = rebrand_json(item.translations)
        if updated != item.translations:
            item.translations = updated
            counts["faq"] += 1

    for product in db.query(Product).all():
        name, desc = rebrand_text(product.name), rebrand_text(product.description)
        if (name, desc) != (product.name, product.description):
            product.name, product.description = name, desc
            counts["products"] += 1

    for src in db.query(KnowledgeSource).all():
        title, text = rebrand_text(src.title), rebrand_text(src.text or "")
        if (title, text) != (src.title, src.text or ""):
            src.title, src.text, src.chars = title, text, len(text)
            counts["knowledge"] += 1

    if any(counts.values()):
        db.add(AuditLog(actor_id=None, actor_username=ACTOR, action="content.rebrand",
                        detail=json.dumps(counts)))
    db.flush()
    invalidate_cache()
    return counts


# ── seeding ──────────────────────────────────────────────────────────

def _load_site() -> dict:
    return json.loads(SITE_JSON.read_text(encoding="utf-8"))


def _read_md(lang: str, slug: str) -> str:
    path = FRONTEND_CONTENT_DIR / lang / f"{slug}.md"
    if not path.exists():
        print(f"  WARNING: {path} not found, leaving bodyMarkdown empty for {slug}/{lang}")
        return ""
    return path.read_text(encoding="utf-8").strip()


def seed_pages(db, site: dict, force: bool) -> None:
    for order, slug in enumerate(site["pageOrder"]):
        exists = db.get(ContentPage, slug) is not None
        if exists and not force:
            print(f"Page '{slug}' already exists — skipping (use --force to overwrite).")
            continue
        translations = {
            lang: {**fields, "bodyMarkdown": _read_md(lang, slug)}
            for lang, fields in site["pages"][slug].items()
        }
        content_service.upsert_page(
            db, slug, translations=translations, order=order,
            is_visible=True, show_in_nav=True, actor_id=None, actor_username=ACTOR,
        )
        print(f"{'Updated' if exists else 'Seeded'} page '{slug}'.")

    if force:
        for slug in STALE_PAGE_SLUGS:
            page = db.get(ContentPage, slug)
            if page is not None and (page.is_visible or page.show_in_nav):
                content_service.upsert_page(
                    db, slug, translations=page.translations,
                    is_visible=False, show_in_nav=False, actor_id=None, actor_username=ACTOR,
                )
                print(f"Hid stale page '{slug}'.")


def seed_faq(db, site: dict, force: bool) -> None:
    existing = content_service.list_faq(db, active_only=False)
    if existing and not force:
        print("FAQ items already exist — skipping (use --force to replace).")
        return
    for item in existing:
        content_service.delete_faq(db, item.id, actor_id=None, actor_username=ACTOR)
    for order, translations in enumerate(site["faq"]):
        content_service.create_faq(db, translations=translations, order=order,
                                   actor_id=None, actor_username=ACTOR)
    print(f"Seeded {len(site['faq'])} FAQ items.")


def seed_settings(db, site: dict, force: bool) -> None:
    wanted = {
        "copy.home": site["copyHome"],
        "copy.chat": site["copyChat"],
        "chat.systemPrompt": site["settings"]["chat.systemPrompt"],
        "branding.metaDescription": site["settings"]["branding.metaDescription"],
        "contact.address": site["settings"]["contact.address"],
    }
    to_set = {}
    for key, value in wanted.items():
        if db.get(SiteSetting, key) is None or force:
            to_set[key] = value
        else:
            print(f"Setting '{key}' already set — skipping (use --force to overwrite).")
    if to_set:
        set_many(db, to_set, actor_id=None, actor_username=ACTOR)
        print(f"Set: {sorted(to_set)}.")


def seed_products(db, site: dict) -> None:
    """Adds any catalog product that doesn't exist yet (matched by slug).
    Never edits or removes an existing product — prices belong to the admin."""
    existing = {p.slug for p in products_service.list_products(db)}
    added = 0
    for prod in site["products"]:
        if products_service.slugify(prod["name"]) in existing:
            continue
        products_service.create_product(
            db, name=prod["name"], description=prod["description"], price=float(prod["price"]),
            unit=prod["unit"], is_active=True, actor_id=None, actor_username=ACTOR,
        )
        added += 1
    print(f"Added {added} product(s) to the catalog." if added else "Products already present — skipping.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--force", action="store_true",
                        help="overwrite seeded pages, FAQ, home/chat copy, system prompt, meta description and address")
    args = parser.parse_args()

    site = _load_site()

    # One transaction: either everything below lands, or nothing does.
    with session_scope() as db:
        seed_pages(db, site, args.force)
        seed_faq(db, site, args.force)
        seed_settings(db, site, args.force)
        seed_products(db, site)

        counts = rebrand_database(db)
        if any(counts.values()):
            print("Rebranded stored text:", {k: v for k, v in counts.items() if v})
        else:
            print("Rebrand pass: no legacy brand text found.")

    print("Done.")


if __name__ == "__main__":
    main()
