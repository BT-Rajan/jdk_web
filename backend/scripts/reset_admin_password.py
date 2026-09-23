#!/usr/bin/env python3
"""
Resets the password for an existing admin_user row, in place — for
when you're locked out and don't know (or trust) the current
password/hash. Uses the exact same bcrypt context app/security.py
verifies against, so the result is guaranteed compatible with login.

    python scripts/reset_admin_password.py
    python scripts/reset_admin_password.py --username admin
"""
from __future__ import annotations

import argparse
import getpass
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select

from app.db import session_scope
from app.models import AdminUser
from app.security import hash_password


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--username", help="Which admin user to reset (default: first/only one found)")
    args = parser.parse_args()

    with session_scope() as db:
        if args.username:
            user = db.scalar(select(AdminUser).where(AdminUser.username == args.username))
            if not user:
                print(f"No admin user with username={args.username!r} found.", file=sys.stderr)
                sys.exit(1)
        else:
            users = db.scalars(select(AdminUser)).all()
            if not users:
                print("No admin users exist — run scripts/seed_admin.py instead.", file=sys.stderr)
                sys.exit(1)
            if len(users) > 1:
                print("Multiple admin users exist — re-run with --username <name>:", file=sys.stderr)
                for u in users:
                    print(f"  - {u.username} (role={u.role}, active={u.is_active})", file=sys.stderr)
                sys.exit(1)
            user = users[0]

        print(f"Resetting password for '{user.username}' (role={user.role}, active={user.is_active})")
        password = getpass.getpass("New password: ")
        confirm = getpass.getpass("Confirm new password: ")
        if password != confirm:
            print("Passwords didn't match — nothing changed.", file=sys.stderr)
            sys.exit(1)
        if len(password) < 12:
            print("WARNING: shorter than 12 characters.", file=sys.stderr)

        user.password_hash = hash_password(password)
        user.is_active = True  # in case it was ever deactivated
        print(f"Password updated for '{user.username}'. Try logging in now.")


if __name__ == "__main__":
    main()
