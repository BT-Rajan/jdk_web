#!/usr/bin/env python3
"""
Bootstraps the first admin account from BOOTSTRAP_ADMIN_USERNAME /
BOOTSTRAP_ADMIN_PASSWORD_HASH in .env (generate the hash with
scripts/gen_secrets.py), but only if the admin_user table is empty.
Safe to re-run: it never touches existing admin accounts.

Schema creation is no longer this script's job — run `alembic upgrade
head` first (setup.sh/deploy.sh already do this in order). This only
seeds data.

    alembic upgrade head
    python scripts/seed_admin.py
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select

from app.config import settings
from app.db import session_scope
from app.models import AdminUser


def main() -> None:
    with session_scope() as db:
        existing = db.scalar(select(AdminUser).limit(1))
        if existing:
            print("Admin user already exists — skipping bootstrap.")
            return
        if not settings.BOOTSTRAP_ADMIN_PASSWORD_HASH:
            print(
                "No admin user exists yet, and BOOTSTRAP_ADMIN_PASSWORD_HASH is unset.\n"
                "Run scripts/gen_secrets.py, put the output in .env, then re-run this script.",
                file=sys.stderr,
            )
            sys.exit(1)
        db.add(AdminUser(
            username=settings.BOOTSTRAP_ADMIN_USERNAME,
            password_hash=settings.BOOTSTRAP_ADMIN_PASSWORD_HASH,
            role="owner",
        ))
        print(f"Created bootstrap admin user '{settings.BOOTSTRAP_ADMIN_USERNAME}'.")


if __name__ == "__main__":
    main()
