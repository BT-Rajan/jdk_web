from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app import products_service
from app.db import get_db
from app.schema_base import CamelModel

router = APIRouter(prefix="/api/products", tags=["public-products"])


class PublicProductOut(CamelModel):
    id: str
    name: str
    slug: str
    description: str
    price: float
    unit: str
    image_url: str | None
    datasheet_url: str | None
    datasheet_filename: str | None


@router.get("", response_model=list[PublicProductOut])
def list_products(response: Response, db: Session = Depends(get_db)):
    """Active products only, for the public order form and the public
    Products page — no cost/audit fields, matching the public-facing
    trim other public.* endpoints use."""
    response.headers["Cache-Control"] = "public, max-age=30"
    products = products_service.list_products(db, active_only=True)
    return [
        PublicProductOut(
            id=p.id, name=p.name, slug=p.slug, description=p.description, price=p.price, unit=p.unit,
            image_url=p.image_url, datasheet_url=p.datasheet_url, datasheet_filename=p.datasheet_filename,
        )
        for p in products
    ]
