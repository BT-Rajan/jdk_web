from __future__ import annotations

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app import content_service, page_images_service
from app.db import get_db

router = APIRouter(prefix="/api/content", tags=["public-content"])


@router.get("/pages")
def public_pages(response: Response, db: Session = Depends(get_db)):
    """All visible pages, every language at once (small payload, and it
    lets the frontend switch languages instantly with no refetch).
    `images` is language-independent (a photo isn't translated) — an
    empty list is the common case, so most pages render as plain text
    exactly as before; one or more turns ContentPage.jsx into a
    two-column layout (see src/components/pages/ContentPage.jsx)."""
    response.headers["Cache-Control"] = "public, max-age=30"
    pages = content_service.list_pages(db, visible_only=True)
    return [
        {
            "slug": p.slug,
            "order": p.order,
            "showInNav": p.show_in_nav,
            "translations": p.translations,
            "images": [
                {"url": page_images_service.public_url(img.filename), "caption": img.caption}
                for img in page_images_service.list_images(db, p.slug, active_only=True)
            ],
        }
        for p in pages
    ]


@router.get("/faq")
def public_faq(response: Response, db: Session = Depends(get_db)):
    response.headers["Cache-Control"] = "public, max-age=30"
    items = content_service.list_faq(db, active_only=True)
    return [{"id": i.id, "translations": i.translations} for i in items]
