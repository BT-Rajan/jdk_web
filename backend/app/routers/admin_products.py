from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import products_service
from app.db import get_db
from app.deps import get_current_admin, require_csrf
from app.models import AdminUser
from app.schema_base import CamelModel

router = APIRouter(prefix="/admin/api/products", tags=["admin-products"], dependencies=[Depends(require_csrf)])


class ProductOut(CamelModel):
    id: str
    name: str
    slug: str
    description: str
    price: float
    unit: str
    is_active: bool
    position: int
    created_at: str
    updated_at: str


class ProductCreateIn(CamelModel):
    name: str
    description: str = ""
    price: float
    unit: str = "unit"
    is_active: bool = True


class ProductUpdateIn(CamelModel):
    name: str | None = None
    description: str | None = None
    price: float | None = None
    unit: str | None = None
    is_active: bool | None = None


def _serialize(p) -> ProductOut:
    return ProductOut(
        id=p.id, name=p.name, slug=p.slug, description=p.description, price=p.price, unit=p.unit,
        is_active=p.is_active, position=p.position,
        created_at=p.created_at.isoformat(), updated_at=p.updated_at.isoformat(),
    )


@router.get("", response_model=list[ProductOut])
def list_products(admin: AdminUser = Depends(get_current_admin), db: Session = Depends(get_db)):
    return [_serialize(p) for p in products_service.list_products(db)]


@router.post("", response_model=ProductOut)
def create_product(body: ProductCreateIn, admin: AdminUser = Depends(get_current_admin), db: Session = Depends(get_db)):
    try:
        product = products_service.create_product(
            db, name=body.name, description=body.description, price=body.price, unit=body.unit,
            is_active=body.is_active, actor_id=admin.id, actor_username=admin.username,
        )
        db.commit()
    except ValueError as e:
        db.rollback()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))
    db.refresh(product)
    return _serialize(product)


@router.get("/{product_id}", response_model=ProductOut)
def get_product(product_id: str, admin: AdminUser = Depends(get_current_admin), db: Session = Depends(get_db)):
    product = products_service.get_product(db, product_id)
    if product is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No product {product_id!r}")
    return _serialize(product)


@router.patch("/{product_id}", response_model=ProductOut)
def update_product(
    product_id: str, body: ProductUpdateIn,
    admin: AdminUser = Depends(get_current_admin), db: Session = Depends(get_db),
):
    try:
        product = products_service.update_product(
            db, product_id, name=body.name, description=body.description, price=body.price,
            unit=body.unit, is_active=body.is_active, actor_id=admin.id, actor_username=admin.username,
        )
        db.commit()
    except KeyError as e:
        db.rollback()
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(e))
    except ValueError as e:
        db.rollback()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))
    db.refresh(product)
    return _serialize(product)


@router.delete("/{product_id}")
def delete_product(product_id: str, admin: AdminUser = Depends(get_current_admin), db: Session = Depends(get_db)):
    ok = products_service.delete_product(db, product_id, actor_id=admin.id, actor_username=admin.username)
    db.commit()
    if not ok:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No product {product_id!r}")
    return {"ok": True}
