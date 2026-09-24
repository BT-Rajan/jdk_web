"""
scripts/seed_content.py populates Pages / FAQ / on-screen text / the
Products catalog and rewrites legacy brand text.

Regression: the seed once crashed with `Unknown setting keys:
['copy.booking']` after that setting was removed from the registry. The
crash rolled back the whole transaction, so a fresh deploy silently ended
up with ZERO pages and the site header showed only the Home icon.
"""
from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import pytest

from app import products_service
from app.db import session_scope
from app.models import ContentPage, ContentPageVersion, FaqItem, Product, SiteSetting

_SEED_PATH = Path(__file__).resolve().parent.parent / "scripts" / "seed_content.py"
_spec = importlib.util.spec_from_file_location("seed_content_under_test", _SEED_PATH)
seed = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(seed)

_SEEDED_SETTING_KEYS = ("copy.home", "copy.chat", "chat.systemPrompt", "branding.metaDescription",
                        "contact.address", "branding.siteName")


def _run_seed(monkeypatch, *args: str) -> None:
    monkeypatch.setattr(sys, "argv", ["seed_content.py", *args])
    seed.main()


def _wipe() -> None:
    site = seed._load_site()
    slugs = {products_service.slugify(p["name"]) for p in site["products"]} | {"legacy-perennia-item"}
    with session_scope() as db:
        for model in (ContentPageVersion, ContentPage, FaqItem):
            for row in db.query(model).all():
                db.delete(row)
        for p in db.query(Product).filter(Product.slug.in_(slugs)).all():
            db.delete(p)
        for key in _SEEDED_SETTING_KEYS:
            row = db.get(SiteSetting, key)
            if row is not None:
                db.delete(row)
    from app.settings_service import invalidate_cache
    invalidate_cache()


@pytest.fixture(autouse=True)
def _clean():
    _wipe()
    yield
    _wipe()


def test_fresh_seed_creates_cement_pages_in_nav_order(monkeypatch):
    _run_seed(monkeypatch)
    with session_scope() as db:
        pages = db.query(ContentPage).order_by(ContentPage.order).all()
        assert [p.slug for p in pages] == ["about", "products", "quality", "contact"]
        assert all(p.is_visible and p.show_in_nav for p in pages)
        for p in pages:
            for lang in ("en", "ar"):
                assert p.translations[lang]["bodyMarkdown"].strip(), f"{p.slug}/{lang} body empty"
        assert db.query(FaqItem).count() == len(seed._load_site()["faq"])
        catalog = {p.slug for p in db.query(Product).all()}
        assert "ordinary-portland-cement-opc-50-kg-bag" in catalog


def test_seed_is_idempotent_and_keeps_admin_edits(monkeypatch):
    _run_seed(monkeypatch)
    with session_scope() as db:
        db.get(ContentPage, "about").translations = {
            "en": {"navLabel": "About", "sectionTitle": "Edited", "sectionBody": "x", "bodyMarkdown": "edited by admin"}}
    _run_seed(monkeypatch)
    with session_scope() as db:
        assert db.get(ContentPage, "about").translations["en"]["bodyMarkdown"] == "edited by admin"
        assert db.query(ContentPage).count() == 4


def test_force_overwrites_pages_and_hides_stale_services_page(monkeypatch):
    with session_scope() as db:
        db.add(ContentPage(slug="services", order=9, translations={
            "en": {"navLabel": "Services", "sectionTitle": "S", "sectionBody": "b", "bodyMarkdown": "AI"}}))
    _run_seed(monkeypatch, "--force")
    with session_scope() as db:
        services = db.get(ContentPage, "services")
        assert services is not None and not services.is_visible and not services.show_in_nav
        assert "cement" in db.get(ContentPage, "about").translations["en"]["bodyMarkdown"].lower()


def test_rebrand_rewrites_legacy_name_in_english_and_json_escaped_arabic(monkeypatch):
    with session_scope() as db:
        # settings_service stores json.dumps() output, i.e. Arabic as \uXXXX escapes.
        db.add(SiteSetting(key="copy.chat", value=json.dumps({
            "en": {"inputPlaceholder": "Ask Perennia AI anything…"},
            "ar": {"inputPlaceholder": "اسأل مساعد بيرينيا", "welcomeMsg": "المساعد الذكي لبيرينيا"}})))
        db.add(Product(name="Legacy Perennia item", slug="legacy-perennia-item", description="", price=1, unit="unit"))
    _run_seed(monkeypatch)
    with session_scope() as db:
        chat = json.loads(db.get(SiteSetting, "copy.chat").value)
        assert chat["en"]["inputPlaceholder"] == "Ask JDK Factory AI anything…"
        assert chat["ar"]["inputPlaceholder"] == "اسأل مساعد JDK Factory"
        assert chat["ar"]["welcomeMsg"] == "المساعد الذكي لـ JDK Factory"
        assert db.query(Product).filter(Product.slug == "legacy-perennia-item").one().name == "Legacy JDK Factory item"


def test_seeded_content_contains_no_legacy_brand():
    blob = _SEED_PATH.parent.parent.parent.joinpath("src", "content", "site.json").read_text(encoding="utf-8").lower()
    assert "perennia" not in blob and "بيرينيا" not in blob
