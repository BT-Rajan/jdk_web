"""
Read/write access to the home-page showcase photos. Mirrors
products_service.py's role: routers never touch the ORM (or the uploads
directory) directly, so validation, audit logging, and file cleanup
happen in exactly one place.

File handling and DB handling are deliberately separate steps: callers
write the file first (save_file), then add the row, commit, and only
then — for deletes — remove the file (remove_file). That ordering means
a failed commit can at worst leave an orphaned file on disk, never a
row pointing at a file that no longer exists.
"""
from __future__ import annotations

import logging
import secrets
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import AuditLog, ShowcaseImage

logger = logging.getLogger("jdk.showcase")

MAX_CAPTION_LENGTH = 200


def public_url(filename: str) -> str:
    return f"/uploads/{filename}"


def list_images(db: Session, *, active_only: bool = False) -> list[ShowcaseImage]:
    # created_at is only a tie-breaker for rows that ever end up sharing
    # a position, so the order is always fully deterministic.
    stmt = select(ShowcaseImage).order_by(ShowcaseImage.position, ShowcaseImage.created_at)
    if active_only:
        stmt = stmt.where(ShowcaseImage.is_active.is_(True))
    return list(db.scalars(stmt))


def save_file(body: bytes, ext: str) -> str:
    """Writes an already-validated image to the uploads directory under a
    random name (never derived from anything the client sent) and returns
    that filename."""
    filename = f"{secrets.token_hex(16)}{ext}"
    (settings.UPLOADS_DIR / filename).write_bytes(body)
    return filename


def remove_file(filename: str) -> None:
    """Best-effort delete of an uploaded file. `filename` always comes
    from our own DB, but is still reduced to a bare name and checked
    before touching the disk, so this can never delete anything outside
    the uploads directory. A missing file or an OS error is logged, not
    raised — the row is already gone, and a leftover file is harmless."""
    if not filename or Path(filename).name != filename:
        logger.warning("Refusing to remove suspicious showcase filename %r", filename)
        return
    try:
        (settings.UPLOADS_DIR / filename).unlink(missing_ok=True)
    except OSError:
        logger.exception("Could not remove showcase file %s", filename)


def create_image(
    db: Session, *, filename: str, caption: str = "",
    actor_id: str | None, actor_username: str | None,
) -> ShowcaseImage:
    caption = caption.strip()
    if len(caption) > MAX_CAPTION_LENGTH:
        raise ValueError(f"caption must be {MAX_CAPTION_LENGTH} characters or fewer")

    max_position = db.scalar(select(ShowcaseImage.position).order_by(ShowcaseImage.position.desc()).limit(1))
    image = ShowcaseImage(
        filename=filename, caption=caption, is_active=True,
        position=0 if max_position is None else max_position + 1,
        updated_by=actor_id,
    )
    db.add(image)
    db.add(AuditLog(actor_id=actor_id, actor_username=actor_username, action="showcase.create", target=filename))
    # Flush (not commit) so the next create_image in the same request
    # sees this row when it computes the following position.
    db.flush()
    return image


def update_image(
    db: Session, image_id: str, *, caption: str | None = None, is_active: bool | None = None,
    actor_id: str | None, actor_username: str | None,
) -> ShowcaseImage:
    image = db.get(ShowcaseImage, image_id)
    if image is None:
        raise KeyError(f"No showcase image {image_id!r}")

    if caption is not None:
        caption = caption.strip()
        if len(caption) > MAX_CAPTION_LENGTH:
            raise ValueError(f"caption must be {MAX_CAPTION_LENGTH} characters or fewer")
        image.caption = caption
    if is_active is not None:
        image.is_active = is_active
    image.updated_by = actor_id

    db.add(AuditLog(actor_id=actor_id, actor_username=actor_username, action="showcase.update", target=image_id))
    return image


def delete_image(
    db: Session, image_id: str, *, actor_id: str | None, actor_username: str | None,
) -> str | None:
    """Deletes the row and returns its filename so the caller can remove
    the file *after* the transaction commits. None means no such row."""
    image = db.get(ShowcaseImage, image_id)
    if image is None:
        return None
    filename = image.filename
    db.delete(image)
    db.add(AuditLog(actor_id=actor_id, actor_username=actor_username, action="showcase.delete", target=image_id))
    return filename


def reorder_images(
    db: Session, ordered_ids: list[str], *, actor_id: str | None, actor_username: str | None,
) -> list[ShowcaseImage]:
    """Applies the given order. Any image not listed keeps its relative
    order after the listed ones, so a stale client list (e.g. another
    admin just uploaded a photo) can never drop or scramble a photo."""
    if len(set(ordered_ids)) != len(ordered_ids):
        raise ValueError("orderedIds contains duplicates")

    images = list_images(db)
    by_id = {img.id: img for img in images}
    unknown = [i for i in ordered_ids if i not in by_id]
    if unknown:
        raise ValueError(f"Unknown showcase image id(s): {', '.join(unknown)}")

    listed = set(ordered_ids)
    final = [by_id[i] for i in ordered_ids] + [img for img in images if img.id not in listed]
    for position, image in enumerate(final):
        image.position = position

    db.add(AuditLog(actor_id=actor_id, actor_username=actor_username, action="showcase.reorder"))
    return final
