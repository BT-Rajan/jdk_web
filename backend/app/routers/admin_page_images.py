from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app import content_service, page_images_service
from app.config import settings
from app.db import get_db
from app.deps import get_current_admin, require_csrf
from app.models import AdminUser
from app.routers.admin_uploads import _sniff_image_type
from app.schema_base import CamelModel

router = APIRouter(prefix="/admin/api/pages/{page_slug}/images", tags=["admin-page-images"],
                    dependencies=[Depends(require_csrf)])

# Same cap as the home showcase — an admin adding more than this to one
# page's gallery just uploads a second batch.
MAX_FILES_PER_UPLOAD = 20


class PageImageOut(CamelModel):
    id: str
    url: str
    caption: str
    position: int
    is_active: bool
    created_at: str
    updated_at: str


class UploadErrorOut(CamelModel):
    filename: str
    detail: str


class UploadOut(CamelModel):
    created: list[PageImageOut]
    errors: list[UploadErrorOut]


class PageImageUpdateIn(CamelModel):
    caption: str | None = None
    is_active: bool | None = None


class PageImageReorderIn(CamelModel):
    ordered_ids: list[str]


def _serialize(img) -> PageImageOut:
    return PageImageOut(
        id=img.id, url=page_images_service.public_url(img.filename), caption=img.caption,
        position=img.position, is_active=img.is_active,
        created_at=img.created_at.isoformat(), updated_at=img.updated_at.isoformat(),
    )


def _require_page(db: Session, page_slug: str) -> None:
    if content_service.get_page(db, page_slug) is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No page {page_slug!r}")


@router.get("", response_model=list[PageImageOut])
def list_page_images(page_slug: str, admin: AdminUser = Depends(get_current_admin), db: Session = Depends(get_db)):
    _require_page(db, page_slug)
    return [_serialize(i) for i in page_images_service.list_images(db, page_slug)]


# Deliberately a plain `def` (not `async def`) — see admin_showcase.py's
# upload_showcase_images for why: the disk writes and DB calls run in a
# worker thread instead of blocking the event loop.
@router.post("", response_model=UploadOut)
def upload_page_images(
    page_slug: str, files: list[UploadFile],
    admin: AdminUser = Depends(get_current_admin), db: Session = Depends(get_db),
):
    _require_page(db, page_slug)
    if not files:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No files were uploaded")
    if len(files) > MAX_FILES_PER_UPLOAD:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Upload at most {MAX_FILES_PER_UPLOAD} photos at a time")

    max_bytes = settings.MAX_SHOWCASE_IMAGE_BYTES
    created, errors, written = [], [], []

    try:
        for f in files:
            name = f.filename or "file"
            body = f.file.read(max_bytes + 1)
            if not body:
                errors.append(UploadErrorOut(filename=name, detail="Empty file"))
                continue
            if len(body) > max_bytes:
                errors.append(UploadErrorOut(
                    filename=name, detail=f"Exceeds the {max_bytes // (1024 * 1024)}MB limit",
                ))
                continue
            sniffed = _sniff_image_type(body[:16])
            if sniffed is None or sniffed[1] == ".ico":
                errors.append(UploadErrorOut(filename=name, detail="Unsupported type — use PNG, JPEG or WEBP"))
                continue

            filename = page_images_service.save_file(body, sniffed[1])
            written.append(filename)
            created.append(page_images_service.create_image(
                db, page_slug, filename=filename, actor_id=admin.id, actor_username=admin.username,
            ))
        db.commit()
    except Exception:
        db.rollback()
        for filename in written:
            page_images_service.remove_file(filename)
        raise

    for img in created:
        db.refresh(img)
    return UploadOut(created=[_serialize(i) for i in created], errors=errors)


@router.post("/reorder", response_model=list[PageImageOut])
def reorder_page_images(
    page_slug: str, body: PageImageReorderIn,
    admin: AdminUser = Depends(get_current_admin), db: Session = Depends(get_db),
):
    _require_page(db, page_slug)
    try:
        images = page_images_service.reorder_images(
            db, page_slug, body.ordered_ids, actor_id=admin.id, actor_username=admin.username,
        )
        db.commit()
    except ValueError as e:
        db.rollback()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))
    for img in images:
        db.refresh(img)
    return [_serialize(i) for i in images]


@router.patch("/{image_id}", response_model=PageImageOut)
def update_page_image(
    page_slug: str, image_id: str, body: PageImageUpdateIn,
    admin: AdminUser = Depends(get_current_admin), db: Session = Depends(get_db),
):
    _require_page(db, page_slug)
    try:
        image = page_images_service.update_image(
            db, image_id, caption=body.caption, is_active=body.is_active,
            actor_id=admin.id, actor_username=admin.username,
        )
        db.commit()
    except KeyError as e:
        db.rollback()
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(e))
    except ValueError as e:
        db.rollback()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))
    db.refresh(image)
    return _serialize(image)


@router.delete("/{image_id}")
def delete_page_image(
    page_slug: str, image_id: str,
    admin: AdminUser = Depends(get_current_admin), db: Session = Depends(get_db),
):
    _require_page(db, page_slug)
    filename = page_images_service.delete_image(db, image_id, actor_id=admin.id, actor_username=admin.username)
    if filename is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No page image {image_id!r}")
    db.commit()
    page_images_service.remove_file(filename)
    return {"ok": True}
