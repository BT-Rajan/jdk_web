from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app import showcase_service
from app.db import get_db
from app.schema_base import CamelModel

router = APIRouter(prefix="/api/showcase", tags=["public-showcase"])


class PublicShowcaseImageOut(CamelModel):
    id: str
    url: str
    caption: str


@router.get("", response_model=list[PublicShowcaseImageOut])
def list_showcase(response: Response, db: Session = Depends(get_db)):
    """Active photos only, in slideshow order, for the home page — no
    audit/state fields, matching the trim other public.* endpoints use.
    An empty list is a normal answer (the section simply doesn't render)."""
    response.headers["Cache-Control"] = "public, max-age=30"
    return [
        PublicShowcaseImageOut(id=i.id, url=showcase_service.public_url(i.filename), caption=i.caption)
        for i in showcase_service.list_images(db, active_only=True)
    ]
