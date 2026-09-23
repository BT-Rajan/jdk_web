from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app import showcase_service
from app.config import settings
from app.db import get_db
from app.deps import get_current_admin, require_csrf
from app.models import AdminUser
# Same byte-sniffing the logo/favicon uploader uses — the file's real
# header decides the type, never the client's filename or Content-Type.
from app.routers.admin_uploads import _sniff_image_type
from app.schema_base import CamelModel

router = APIRouter(prefix="/admin/api/showcase", tags=["admin-showcase"], dependencies=[Depends(require_csrf)])

# Caps one request's fan-out. An admin adding more photos than this just
# uploads them in a second batch.
MAX_FILES_PER_UPLOAD = 20


class ShowcaseImageOut(CamelModel):
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
    created: list[ShowcaseImageOut]
    errors: list[UploadErrorOut]


class ShowcaseUpdateIn(CamelModel):
    caption: str | None = None
    is_active: bool | None = None


class ShowcaseReorderIn(CamelModel):
    ordered_ids: list[str]


def _serialize(img) -> ShowcaseImageOut:
    return ShowcaseImageOut(
        id=img.id, url=showcase_service.public_url(img.filename), caption=img.caption,
        position=img.position, is_active=img.is_active,
        created_at=img.created_at.isoformat(), updated_at=img.updated_at.isoformat(),
    )


@router.get("", response_model=list[ShowcaseImageOut])
def list_showcase(admin: AdminUser = Depends(get_current_admin), db: Session = Depends(get_db)):
    return [_serialize(i) for i in showcase_service.list_images(db)]


# Deliberately a plain `def` (not `async def`): FastAPI runs it in a
# worker thread, so the disk writes and DB calls below never block the
# event loop that serves every other request.
@router.post("", response_model=UploadOut)
def upload_showcase_images(
    files: list[UploadFile], admin: AdminUser = Depends(get_current_admin), db: Session = Depends(get_db),
):
    """Accepts several photos in one request. Each file is checked on its
    own: a bad one (too large, not a real image) is reported back in
    `errors` and skipped, without failing the good ones alongside it."""
    if not files:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "No files were uploaded")
    if len(files) > MAX_FILES_PER_UPLOAD:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, f"Upload at most {MAX_FILES_PER_UPLOAD} photos at a time",
        )

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
            # ICO is accepted by the logo/favicon uploader but is not a
            # photo format — the slideshow only takes PNG, JPEG and WEBP.
            if sniffed is None or sniffed[1] == ".ico":
                errors.append(UploadErrorOut(filename=name, detail="Unsupported type — use PNG, JPEG or WEBP"))
                continue

            filename = showcase_service.save_file(body, sniffed[1])
            written.append(filename)
            created.append(showcase_service.create_image(
                db, filename=filename, actor_id=admin.id, actor_username=admin.username,
            ))
        db.commit()
    except Exception:
        # Nothing was committed, so nothing may keep a file on disk.
        db.rollback()
        for filename in written:
            showcase_service.remove_file(filename)
        raise

    for img in created:
        db.refresh(img)
    return UploadOut(created=[_serialize(i) for i in created], errors=errors)


# Registered before the "/{image_id}" routes below on purpose, so
# "reorder" is never mistaken for an image id.
@router.post("/reorder", response_model=list[ShowcaseImageOut])
def reorder_showcase(body: ShowcaseReorderIn, admin: AdminUser = Depends(get_current_admin), db: Session = Depends(get_db)):
    try:
        images = showcase_service.reorder_images(
            db, body.ordered_ids, actor_id=admin.id, actor_username=admin.username,
        )
        db.commit()
    except ValueError as e:
        db.rollback()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))
    for img in images:
        db.refresh(img)
    return [_serialize(i) for i in images]


@router.patch("/{image_id}", response_model=ShowcaseImageOut)
def update_showcase(
    image_id: str, body: ShowcaseUpdateIn,
    admin: AdminUser = Depends(get_current_admin), db: Session = Depends(get_db),
):
    try:
        image = showcase_service.update_image(
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
def delete_showcase(image_id: str, admin: AdminUser = Depends(get_current_admin), db: Session = Depends(get_db)):
    filename = showcase_service.delete_image(db, image_id, actor_id=admin.id, actor_username=admin.username)
    if filename is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No showcase image {image_id!r}")
    db.commit()
    # Only after the row is durably gone — see showcase_service's docstring.
    showcase_service.remove_file(filename)
    return {"ok": True}
