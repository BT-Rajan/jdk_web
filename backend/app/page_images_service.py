"""
Read/write access to per-page photos (About's factory photo, Quality's
certification scans, etc.) — mirrors showcase_service.py's role and
file-handling exactly, just scoped by `page_slug` instead of being one
global gallery. Routers never touch the ORM or the uploads directory
directly, so validation and audit logging happen in exactly one place.
"""
from __future__ import annotations

import logging
import secrets
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import AuditLog, PageImage

logger = logging.getLogger("jdk.page_images")

MAX_CAPTION_LENGTH = 200


def public_url(filename: str) -> str:
    return f"/uploads/{filename}"


def list_images(db: Session, page_slug: str, *, active_only: bool = False) -> list[PageImage]:
    stmt = select(PageImage).where(PageImage.page_slug == page_slug).order_by(
        PageImage.position, PageImage.created_at
    )
    if active_only:
        stmt = stmt.where(PageImage.is_active.is_(True))
    return list(db.scalars(stmt))


def save_file(body: bytes, ext: str) -> str:
    filename = f"{secrets.token_hex(16)}{ext}"
    (settings.UPLOADS_DIR / filename).write_bytes(body)
    return filename


def remove_file(filename: str) -> None:
    """Best-effort delete — same guard as showcase_service.remove_file:
    `filename` always comes from our own DB, but is still reduced to a
    bare name and checked before touching disk."""
    if not filename or Path(filename).name != filename:
        logger.warning("Refusing to remove suspicious page-image filename %r", filename)
        return
    try:
        (settings.UPLOADS_DIR / filename).unlink(missing_ok=True)
    except OSError:
        logger.exception("Could not remove page-image file %s", filename)


def create_image(
    db: Session, page_slug: str, *, filename: str, caption: str = "",
    actor_id: str | None, actor_username: str | None,
) -> PageImage:
    caption = caption.strip()
    if len(caption) > MAX_CAPTION_LENGTH:
        raise ValueError(f"caption must be {MAX_CAPTION_LENGTH} characters or fewer")

    max_position = db.scalar(
        select(PageImage.position).where(PageImage.page_slug == page_slug)
        .order_by(PageImage.position.desc()).limit(1)
    )
    image = PageImage(
        page_slug=page_slug, filename=filename, caption=caption, is_active=True,
        position=0 if max_position is None else max_position + 1,
        updated_by=actor_id,
    )
    db.add(image)
    db.add(AuditLog(actor_id=actor_id, actor_username=actor_username, action="page_image.create", target=page_slug))
    # Flush (not commit) so the next create_image in the same request
    # sees this row when it computes the following position.
    db.flush()
    return image


def get_image(db: Session, image_id: str) -> PageImage | None:
    return db.get(PageImage, image_id)


def update_image(
    db: Session, image_id: str, *, caption: str | None = None, is_active: bool | None = None,
    actor_id: str | None, actor_username: str | None,
) -> PageImage:
    image = db.get(PageImage, image_id)
    if image is None:
        raise KeyError(f"No page image {image_id!r}")

    if caption is not None:
        caption = caption.strip()
        if len(caption) > MAX_CAPTION_LENGTH:
            raise ValueError(f"caption must be {MAX_CAPTION_LENGTH} characters or fewer")
        image.caption = caption
    if is_active is not None:
        image.is_active = is_active
    image.updated_by = actor_id

    db.add(AuditLog(actor_id=actor_id, actor_username=actor_username, action="page_image.update", target=image_id))
    return image


def delete_image(db: Session, image_id: str, *, actor_id: str | None, actor_username: str | None) -> str | None:
    """Deletes the row and returns its filename so the caller can remove
    the file *after* the transaction commits. None means no such row."""
    image = db.get(PageImage, image_id)
    if image is None:
        return None
    filename = image.filename
    db.delete(image)
    db.add(AuditLog(actor_id=actor_id, actor_username=actor_username, action="page_image.delete", target=image_id))
    return filename


def reorder_images(
    db: Session, page_slug: str, ordered_ids: list[str], *, actor_id: str | None, actor_username: str | None,
) -> list[PageImage]:
    """Applies the given order within one page's gallery. Any image not
    listed keeps its relative order after the listed ones."""
    if len(set(ordered_ids)) != len(ordered_ids):
        raise ValueError("orderedIds contains duplicates")

    images = list_images(db, page_slug)
    by_id = {img.id: img for img in images}
    unknown = [i for i in ordered_ids if i not in by_id]
    if unknown:
        raise ValueError(f"Unknown page image id(s): {', '.join(unknown)}")

    listed = set(ordered_ids)
    final = [by_id[i] for i in ordered_ids] + [img for img in images if img.id not in listed]
    for position, image in enumerate(final):
        image.position = position

    db.add(AuditLog(actor_id=actor_id, actor_username=actor_username, action="page_image.reorder", target=page_slug))
    return final
