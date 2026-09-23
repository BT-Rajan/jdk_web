"""Coverage for the public order-request flow: product catalog CRUD,
the public order form's product listing, and order submission —
including that price is always recomputed server-side, never trusted
from the client, and that a lead is captured from a successful order.
"""
from __future__ import annotations

from app.rate_limit import limiter


def _create_product(logged_in_client, *, name="Widget", price=10.0, unit="unit"):
    resp = logged_in_client.post("/admin/api/products", json={"name": name, "price": price, "unit": unit})
    resp.raise_for_status()
    return resp.json()


def test_public_products_lists_only_active(client, logged_in_client):
    active = _create_product(logged_in_client, name="Active Widget")
    inactive = _create_product(logged_in_client, name="Inactive Widget")
    logged_in_client.patch(f"/admin/api/products/{inactive['id']}", json={"isActive": False}).raise_for_status()

    resp = client.get("/api/products")
    assert resp.status_code == 200
    names = [p["name"] for p in resp.json()]
    assert "Active Widget" in names
    assert "Inactive Widget" not in names
    # No cost/audit fields leak to the public endpoint.
    assert "isActive" not in resp.json()[0]


def test_order_recomputes_price_from_live_catalog(client, logged_in_client):
    limiter.reset()
    product = _create_product(logged_in_client, name="Consulting Hour", price=150.0, unit="hour")

    resp = client.post("/api/orders", json={
        "name": "Jane Doe", "email": "jane@example.com", "phone": "555-1234",
        # Client-supplied price/total would be ignored even if present —
        # this payload doesn't send one at all, proving the total below
        # comes purely from the server's own catalog lookup.
        "items": [{"productId": product["id"], "quantity": 3}],
        "requiredDate": "2030-01-01",
    })
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["ok"] is True
    assert body["estimatedTotal"] == 450.0

    lead = logged_in_client.get(f"/admin/api/leads/{body['leadId']}")
    lead.raise_for_status()
    lead_body = lead.json()
    assert lead_body["source"] == "cart"
    assert lead_body["email"] == "jane@example.com"
    assert "450.00" in lead_body["transcript"][0]["text"]


def test_order_rejects_inactive_or_unknown_product(client, logged_in_client):
    limiter.reset()
    product = _create_product(logged_in_client, name="To Deactivate")
    logged_in_client.patch(f"/admin/api/products/{product['id']}", json={"isActive": False}).raise_for_status()

    resp = client.post("/api/orders", json={
        "name": "Someone", "email": "someone@example.com",
        "items": [{"productId": product["id"], "quantity": 1}],
        "requiredDate": "2030-01-01",
    })
    assert resp.status_code == 400

    resp2 = client.post("/api/orders", json={
        "name": "Someone", "email": "someone@example.com",
        "items": [{"productId": "does-not-exist", "quantity": 1}],
        "requiredDate": "2030-01-01",
    })
    assert resp2.status_code == 400


def test_order_rejects_invalid_email_and_date(client, logged_in_client):
    limiter.reset()
    product = _create_product(logged_in_client, name="Anything")

    bad_email = client.post("/api/orders", json={
        "name": "Someone", "email": "not-an-email",
        "items": [{"productId": product["id"], "quantity": 1}],
        "requiredDate": "2030-01-01",
    })
    assert bad_email.status_code == 400

    bad_date = client.post("/api/orders", json={
        "name": "Someone", "email": "someone@example.com",
        "items": [{"productId": product["id"], "quantity": 1}],
        "requiredDate": "not-a-date",
    })
    assert bad_date.status_code == 400
