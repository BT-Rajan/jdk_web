import datetime as dt

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import Field
from sqlalchemy.orm import Session

from app import leads_service, notification_service, products_service, webhook_service
from app.config import settings
from app.db import get_db
from app.rate_limit import limiter
from app.schema_base import CamelModel

router = APIRouter(prefix="/api/orders", tags=["public-orders"])


class OrderItemIn(CamelModel):
    product_id: str = Field(min_length=1, max_length=32)
    quantity: int = Field(gt=0, le=1000)


class OrderCreateIn(CamelModel):
    name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=254)
    phone: str = Field(default="", max_length=40)
    items: list[OrderItemIn] = Field(min_length=1, max_length=50)
    required_date: str = Field(min_length=1, max_length=10)
    notes: str = Field(default="", max_length=1000)


def _format_summary(name: str, items: list[dict], required_date: str, total: float, notes: str) -> str:
    lines = [f"Order request from {name}:"]
    for item in items:
        lines.append(f"  - {item['quantity']}x {item['name']} @ {item['unitPrice']:.2f} = {item['lineTotal']:.2f}")
    lines.append(f"Required by: {required_date}")
    lines.append(f"Estimated total: {total:.2f}")
    if notes.strip():
        lines.append(f"Notes: {notes.strip()}")
    return "\n".join(lines)


@router.post("")
@limiter.limit(settings.RATE_LIMIT_ORDER)
def create_order(request: Request, body: OrderCreateIn, db: Session = Depends(get_db)):
    if "@" not in body.email or "." not in body.email.split("@")[-1]:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "A valid email is required")
    try:
        dt.date.fromisoformat(body.required_date)
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "requiredDate must be a valid date (YYYY-MM-DD)")

    # Prices are always taken from the live catalog, never trusted from
    # the client — the estimate the order form showed while the visitor
    # was picking items is only ever a preview.
    line_items: list[dict] = []
    total = 0.0
    for entry in body.items:
        product = products_service.get_product(db, entry.product_id)
        if product is None or not product.is_active:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Product {entry.product_id!r} is not available")
        line_total = round(product.price * entry.quantity, 2)
        total += line_total
        line_items.append({
            "productId": product.id, "name": product.name, "quantity": entry.quantity,
            "unitPrice": product.price, "lineTotal": line_total,
        })
    total = round(total, 2)

    summary = _format_summary(body.name, line_items, body.required_date, total, body.notes)
    lead, _created = leads_service.capture_lead(
        db, email=body.email, source="cart", name=body.name, phone=body.phone,
        transcript_entry={"from": "order", "text": summary},
    )
    if body.notes.strip():
        lead.notes = body.notes.strip()
    db.commit()

    order_payload = {
        "leadId": lead.id, "name": body.name, "email": body.email, "phone": body.phone,
        "items": line_items, "requiredDate": body.required_date, "estimatedTotal": total,
        "notes": body.notes,
    }
    notification_service.notify_admin_new_lead(db, email=body.email, message=summary)
    webhook_service.dispatch_event(db, "order.created", order_payload)
    db.commit()

    return {"ok": True, "leadId": lead.id, "estimatedTotal": total}
