"""
Read/write access to the product catalog the public order form
selects from. Mirrors leads_service.py's/content_service.py's role:
routers never touch the ORM directly, so validation and audit logging
happen in exactly one place.
"""
from __future__ import annotations

import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import AuditLog, Product

_SLUG_RE = re.compile(r"[^a-z0-9]+")


def slugify(value: str) -> str:
    slug = _SLUG_RE.sub("-", value.strip().lower()).strip("-")
    return slug or "product"


def _unique_slug(db: Session, base: str, *, exclude_id: str | None = None) -> str:
    slug = base
    n = 2
    while True:
        stmt = select(Product.id).where(Product.slug == slug)
        if exclude_id is not None:
            stmt = stmt.where(Product.id != exclude_id)
        if db.scalar(stmt) is None:
            return slug
        slug = f"{base}-{n}"
        n += 1


def list_products(db: Session, *, active_only: bool = False) -> list[Product]:
    stmt = select(Product).order_by(Product.position, Product.name)
    if active_only:
        stmt = stmt.where(Product.is_active.is_(True))
    return list(db.scalars(stmt))


def get_product(db: Session, product_id: str) -> Product | None:
    return db.get(Product, product_id)


def create_product(
    db: Session, *, name: str, description: str = "", price: float, unit: str = "unit",
    is_active: bool = True, actor_id: str | None, actor_username: str | None,
) -> Product:
    name = name.strip()
    if not name:
        raise ValueError("name is required")
    if price < 0:
        raise ValueError("price must not be negative")

    max_position = db.scalar(select(Product.position).order_by(Product.position.desc()).limit(1))
    product = Product(
        name=name, slug=_unique_slug(db, slugify(name)), description=description.strip(),
        price=price, unit=unit.strip() or "unit", is_active=is_active,
        position=(max_position or 0) + 1,
    )
    db.add(product)
    db.add(AuditLog(actor_id=actor_id, actor_username=actor_username, action="product.create"))
    db.flush()
    return product


def update_product(
    db: Session, product_id: str, *, name: str | None = None, description: str | None = None,
    price: float | None = None, unit: str | None = None, is_active: bool | None = None,
    actor_id: str | None, actor_username: str | None,
) -> Product:
    product = db.get(Product, product_id)
    if product is None:
        raise KeyError(f"No product {product_id!r}")

    if name is not None:
        name = name.strip()
        if not name:
            raise ValueError("name is required")
        if name != product.name:
            product.slug = _unique_slug(db, slugify(name), exclude_id=product_id)
        product.name = name
    if description is not None:
        product.description = description.strip()
    if price is not None:
        if price < 0:
            raise ValueError("price must not be negative")
        product.price = price
    if unit is not None:
        product.unit = unit.strip() or "unit"
    if is_active is not None:
        product.is_active = is_active

    db.add(AuditLog(actor_id=actor_id, actor_username=actor_username, action="product.update", target=product_id))
    return product


def delete_product(db: Session, product_id: str, *, actor_id: str | None, actor_username: str | None) -> bool:
    product = db.get(Product, product_id)
    if product is None:
        return False
    db.delete(product)
    db.add(AuditLog(actor_id=actor_id, actor_username=actor_username, action="product.delete", target=product_id))
    return True
