"""
Low-level senders (email + WhatsApp) plus the internal staff alert for
a new chat lead. Every function here is best-effort by design — a
notification failure (bad SMTP creds, WhatsApp provider down, nothing
configured at all) is logged and swallowed, never raised up to break
the request that triggered it.
"""
from __future__ import annotations

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from sqlalchemy.orm import Session

from app import whatsapp_client
from app.settings_service import get_setting

logger = logging.getLogger("jdk.notifications")


def _lang_value(value, lang: str):
    if isinstance(value, dict):
        return value.get(lang) or value.get("en") or next(iter(value.values()), "")
    return value


def render(template: dict, lang: str, **kwargs) -> dict:
    """template is a JSON setting value shaped {subject, body} (per
    language if i18n). Returns {subject, body} with placeholders filled."""
    picked = _lang_value(template, lang)
    return {k: v.format(**kwargs) for k, v in picked.items()}


def render_text(template, lang: str, **kwargs) -> str:
    return _lang_value(template, lang).format(**kwargs)


# ── Low-level senders ──────────────────────────────────────────────

def send_email(db: Session, *, to_email: str, subject: str, body_text: str) -> bool:
    if not get_setting(db, "notifications.emailEnabled"):
        return False
    host = get_setting(db, "notifications.smtpHost")
    from_email = get_setting(db, "notifications.fromEmail")
    if not host or not from_email:
        logger.info("Email notification skipped: SMTP not fully configured")
        return False

    from_name = get_setting(db, "notifications.fromName") or _lang_value(get_setting(db, "branding.siteName"), "en")
    port = get_setting(db, "notifications.smtpPort")
    use_tls = get_setting(db, "notifications.smtpUseTls")
    username = get_setting(db, "notifications.smtpUsername")
    password = get_setting(db, "notifications.smtpPassword")

    msg = MIMEMultipart()
    msg["Subject"] = subject
    msg["From"] = f"{from_name} <{from_email}>"
    msg["To"] = to_email
    msg.attach(MIMEText(body_text, "plain", "utf-8"))

    try:
        with smtplib.SMTP(host, port, timeout=10) as server:
            if use_tls:
                server.starttls()
            if username:
                server.login(username, password)
            server.send_message(msg)
        return True
    except (smtplib.SMTPException, OSError) as e:
        logger.warning("Email notification failed to %s: %s", to_email, e)
        return False


def send_whatsapp(db: Session, *, to_number: str, message: str) -> bool:
    if not get_setting(db, "notifications.whatsappEnabled") or not to_number:
        return False
    provider = get_setting(db, "notifications.whatsappProvider")
    if provider == "none":
        return False
    try:
        whatsapp_client.send_message(
            provider=provider,
            account_id=get_setting(db, "notifications.whatsappAccountId"),
            api_key=get_setting(db, "notifications.whatsappApiKey"),
            from_number=get_setting(db, "notifications.whatsappFromNumber"),
            to_number=to_number,
            message=message,
        )
        return True
    except whatsapp_client.WhatsAppError as e:
        logger.warning("WhatsApp notification failed to %s: %s", to_number, e)
        return False


# ── Internal staff alerts ────────────────────────────────────────────

def _admin_email(db: Session) -> str:
    return get_setting(db, "notifications.adminAlertEmail")


def notify_admin_new_lead(db: Session, *, email: str, message: str) -> None:
    to = _admin_email(db)
    if not to:
        return
    try:
        rendered = render(get_setting(db, "templates.newLeadAdminAlert"), "en", email=email, message=message)
        send_email(db, to_email=to, subject=rendered["subject"], body_text=rendered["body"])
    except Exception:
        logger.exception("New-lead admin alert failed for %s", email)
