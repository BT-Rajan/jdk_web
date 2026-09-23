"""
Database engine/session setup. Dialect-agnostic by design — every model
and query in this app goes through SQLAlchemy's ORM/Core, never raw
string-interpolated SQL, so the same code runs unmodified against SQLite
(dev), Postgres, or MySQL (prod), controlled entirely by DATABASE_URL.
"""
from __future__ import annotations

import logging
import sys
import time
from contextlib import contextmanager
from typing import Iterator

from sqlalchemy import create_engine, text
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

logger = logging.getLogger("jdk.db")

_connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=_connect_args,
    pool_pre_ping=True,
    future=True,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


class Base(DeclarativeBase):
    pass


def wait_for_db(retries: int = 5, base_delay: float = 1.0) -> None:
    """Boot-time guard: proves the DB is actually reachable before the app
    finishes starting, with a bounded retry/backoff to ride out a DB that's
    still coming up itself (e.g. a VPS reboot racing MySQL's own startup).

    Schema is no longer synced here — that's Alembic's job now, run as an
    explicit `alembic upgrade head` deploy step (see setup.sh/deploy.sh),
    not something the running app does to itself on every boot. This
    function only answers "can I reach DATABASE_URL at all", and fails
    loudly with an actionable message + clean exit instead of letting a
    connection error surface as an unguarded traceback deep in ASGI
    startup, which is what used to turn a DB hiccup into a silent
    PM2 crash-respawn loop.
    """
    last_exc: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            return
        except Exception as exc:  # noqa: BLE001 - deliberately broad: any connectivity failure
            last_exc = exc
            if attempt < retries:
                delay = base_delay * (2 ** (attempt - 1))
                logger.warning(
                    "Database not reachable yet (attempt %d/%d): %s — retrying in %.1fs",
                    attempt, retries, exc, delay,
                )
                time.sleep(delay)
    print(f"FATAL: cannot reach DATABASE_URL after {retries} attempts: {last_exc}", file=sys.stderr)
    print("        Check DATABASE_URL in .env and that the database server is running.", file=sys.stderr)
    sys.exit(1)


def get_db() -> Iterator[Session]:
    """FastAPI dependency: one session per request, always closed."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def session_scope() -> Iterator[Session]:
    """For use outside request handlers (scripts, background jobs)."""
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
