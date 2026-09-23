"""
Webhook CRUD and outbound delivery. Lets the business wire external
systems (a CRM, a spreadsheet automation, Slack, ...) into store events
without polling.

Dispatch is synchronous and best-effort, mirroring
notification_service.py's own philosophy: a delivery failure (target
down, DNS failure, timeout, non-2xx response) is logged and swallowed,
never raised up to break the action that triggered it. No retries in
this first pass.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import time
from datetime import datetime, timezone

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import AuditLog, Webhook, WebhookDelivery
from app.net_safety import UnsafeUrlError, assert_public_http_url
from app.security import decrypt_secret, encrypt_secret

EVENT_CHOICES: set[str] = {"order.created"}

REQUEST_TIMEOUT_SECONDS = 10.0
_SECRET_BYTES = 32  # matches the entropy of a Fernet key's own token, more than enough for an HMAC secret


def _generate_secret() -> str:
    import secrets as _secrets
    return _secrets.token_urlsafe(_SECRET_BYTES)


def _validate_url(url: str) -> None:
    if not url:
        raise ValueError("url is required")
    if url.startswith("https://"):
        pass
    elif url.startswith("http://") and not settings.is_production:
        pass  # local testing only
    else:
        raise ValueError("url must start with https:// (http:// is only allowed outside production)")

    # SSRF guard: reject a URL whose host resolves to a private,
    # loopback, link-local, reserved, or multicast address (internal
    # services, cloud metadata endpoints, etc). Checked here at
    # create/update time, and again on every delivery attempt in
    # _deliver_one below — this endpoint is admin-only, but that's not
    # a reason to skip it (see app/net_safety.py), and a webhook fires
    # automatically and repeatedly for the life of the account, so a
    # one-time check at registration isn't enough on its own.
    try:
        assert_public_http_url(url)
    except UnsafeUrlError as e:
        raise ValueError(str(e)) from e


def _validate_events(events: list) -> None:
    if not events:
        raise ValueError("events must include at least one event name")
    unknown = set(events) - EVENT_CHOICES
    if unknown:
        raise ValueError(f"unknown event(s): {sorted(unknown)}. Must be one of {sorted(EVENT_CHOICES)}")


# ── CRUD ─────────────────────────────────────────────────────────────

def list_webhooks(db: Session) -> list[Webhook]:
    return list(db.scalars(select(Webhook).order_by(Webhook.created_at)))


def get_webhook(db: Session, webhook_id: str) -> Webhook | None:
    return db.get(Webhook, webhook_id)


def create_webhook(
    db: Session, *, url: str, events: list[str], is_active: bool = True,
    actor_id: str | None, actor_username: str | None,
) -> tuple[Webhook, str]:
    """Returns (webhook, plaintext_secret) — the only time the plaintext
    is ever available again after this call returns."""
    _validate_url(url)
    _validate_events(events)

    plaintext_secret = _generate_secret()
    webhook = Webhook(url=url, secret=encrypt_secret(plaintext_secret), events=list(events), is_active=is_active)
    db.add(webhook)
    db.add(AuditLog(actor_id=actor_id, actor_username=actor_username, action="webhook.create"))
    db.flush()
    return webhook, plaintext_secret


def update_webhook(
    db: Session, webhook_id: str, *, url: str | None = None, events: list[str] | None = None,
    is_active: bool | None = None, actor_id: str | None, actor_username: str | None,
) -> Webhook:
    webhook = db.get(Webhook, webhook_id)
    if webhook is None:
        raise KeyError(f"No webhook {webhook_id!r}")

    if url is not None:
        _validate_url(url)
        webhook.url = url
    if events is not None:
        _validate_events(events)
        webhook.events = list(events)
    if is_active is not None:
        webhook.is_active = is_active

    db.add(AuditLog(actor_id=actor_id, actor_username=actor_username, action="webhook.update", target=webhook_id))
    return webhook


def regenerate_secret(db: Session, webhook_id: str, *, actor_id: str | None, actor_username: str | None) -> str:
    webhook = db.get(Webhook, webhook_id)
    if webhook is None:
        raise KeyError(f"No webhook {webhook_id!r}")
    plaintext_secret = _generate_secret()
    webhook.secret = encrypt_secret(plaintext_secret)
    db.add(AuditLog(actor_id=actor_id, actor_username=actor_username,
                     action="webhook.regenerate_secret", target=webhook_id))
    return plaintext_secret


def delete_webhook(db: Session, webhook_id: str, *, actor_id: str | None, actor_username: str | None) -> bool:
    webhook = db.get(Webhook, webhook_id)
    if webhook is None:
        return False
    db.delete(webhook)  # cascades to its WebhookDelivery rows
    db.add(AuditLog(actor_id=actor_id, actor_username=actor_username, action="webhook.delete", target=webhook_id))
    return True


def list_deliveries(db: Session, webhook_id: str, *, limit: int = 50, offset: int = 0) -> list[WebhookDelivery]:
    stmt = (
        select(WebhookDelivery)
        .where(WebhookDelivery.webhook_id == webhook_id)
        .order_by(WebhookDelivery.attempted_at.desc())
        .limit(limit)
        .offset(offset)
    )
    return list(db.scalars(stmt))


# ── Delivery ─────────────────────────────────────────────────────────

def _sign(secret: str, raw_body: bytes) -> str:
    digest = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


def _deliver_one(db: Session, webhook: Webhook, event: str, payload: dict) -> WebhookDelivery:
    """Sends one delivery and logs it, regardless of outcome. Never
    raises — a broken receiver on the business's end must not break
    the action that triggered this."""
    started = time.monotonic()
    response_status: int | None = None

    # Re-validate on every delivery, not just at create/update time: a
    # webhook fires automatically for as long as it's active, and a
    # hostname that resolved to a public address when the admin
    # registered it can be re-pointed at an internal address later
    # (DNS change on the receiving end, not a redirect from it — this
    # doesn't rely on the response at all). Blocked here the same way
    # any other delivery failure is: logged, not raised.
    try:
        assert_public_http_url(webhook.url)
    except UnsafeUrlError:
        duration_ms = int((time.monotonic() - started) * 1000)
        delivery = WebhookDelivery(
            webhook_id=webhook.id, event=event, payload=payload,
            response_status=None, duration_ms=duration_ms,
        )
        db.add(delivery)
        db.flush()
        return delivery

    raw_body = json.dumps(payload, separators=(",", ":")).encode()
    secret = decrypt_secret(webhook.secret)
    signature = _sign(secret, raw_body)

    try:
        resp = httpx.post(
            webhook.url,
            content=raw_body,
            headers={"Content-Type": "application/json", "X-JDK-Signature": signature},
            timeout=REQUEST_TIMEOUT_SECONDS,
            follow_redirects=False,  # a redirect could otherwise be used to reach a blocked address post-check
        )
        response_status = resp.status_code
    except httpx.HTTPError:
        response_status = None  # request never completed - DNS/timeout/connection failure
    duration_ms = int((time.monotonic() - started) * 1000)

    delivery = WebhookDelivery(
        webhook_id=webhook.id, event=event, payload=payload,
        response_status=response_status, duration_ms=duration_ms,
    )
    db.add(delivery)
    db.flush()
    return delivery


def dispatch_event(db: Session, event: str, data: dict) -> None:
    """Fires one delivery per active webhook subscribed to `event` -
    never a single batched call across webhooks, and never raises (a
    delivery failure is logged, not propagated)."""
    payload = {
        "event": event, "data": data,
        "sent_at": datetime.now(timezone.utc).isoformat(),
    }
    stmt = select(Webhook).where(Webhook.is_active.is_(True))
    for webhook in db.scalars(stmt):
        if event not in webhook.events:
            continue
        try:
            _deliver_one(db, webhook, event, payload)
        except Exception:
            # _deliver_one already catches httpx failures; this is a
            # last-resort guard (e.g. a corrupt secret) so one broken
            # webhook can never take down delivery to the others.
            import logging
            logging.getLogger("jdk.webhooks").exception(
                "Webhook delivery raised unexpectedly for webhook %s", webhook.id
            )


def send_test_event(db: Session, webhook_id: str) -> WebhookDelivery:
    """Fires a synthetic test payload at exactly this one webhook, so
    an admin can verify their endpoint before it ever sees a real
    event."""
    webhook = db.get(Webhook, webhook_id)
    if webhook is None:
        raise KeyError(f"No webhook {webhook_id!r}")
    fixture_data = {"id": "TEST-00000000", "message": "This is a test delivery triggered from the admin dashboard."}
    payload = {
        "event": "test", "data": fixture_data,
        "sent_at": datetime.now(timezone.utc).isoformat(),
    }
    return _deliver_one(db, webhook, "test", payload)
