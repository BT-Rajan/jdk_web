#!/usr/bin/env python3
"""
One-time data migration: copies every row from an existing SQLite
database into the MySQL database configured by DATABASE_URL (.env).

Schema creation is NOT this script's job — run `alembic upgrade head`
against the MySQL target first (same as any other deploy; see
setup.sh/deploy.sh). This only copies rows, and refuses to run (in
non-dry-run mode) if the target schema isn't there yet.

Usage:
    # DATABASE_URL in .env must already point at the target mysql+pymysql:// URL
    alembic upgrade head
    python scripts/migrate_sqlite_to_mysql.py --sqlite-path ./data/jdk.db

    # Preview row counts without writing anything:
    python scripts/migrate_sqlite_to_mysql.py --sqlite-path ./data/jdk.db --dry-run

    # If the target tables already have rows (e.g. you ran seed_admin.py
    # against MySQL first), wipe them before copying:
    python scripts/migrate_sqlite_to_mysql.py --sqlite-path ./data/jdk.db --truncate

Safe to re-run in --dry-run mode any number of times. Without
--truncate, the script refuses to touch a target table that already
has rows, so it will never silently duplicate or clobber data.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import create_engine, delete, func, insert, inspect, select

from app.config import settings
from app.db import Base
from app.models import (  # noqa: F401 — import registers every table on Base.metadata
    AdminUser, AdminSession, SiteSetting, AuditLog, ContentPage,
    ContentPageVersion, FaqItem, Appointment, AppointmentQuestionAnswer, Service,
    ServiceCustomQuestion, AvailabilityRule, Webhook, WebhookDelivery,
    CalendarCredential, Lead, KnowledgeSource,
)

_MISSING_SCHEMA_HELP = (
    "FATAL: target MySQL database has no tables yet.\n"
    "Run `alembic upgrade head` against it first, then re-run this script."
)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--sqlite-path", required=True, help="Path to the source .db file, e.g. ./data/jdk.db")
    parser.add_argument("--dry-run", action="store_true", help="Only print row counts, write nothing")
    parser.add_argument("--truncate", action="store_true", help="Delete existing rows in each target table before copying")
    args = parser.parse_args()

    sqlite_path = Path(args.sqlite_path).resolve()
    if not sqlite_path.exists():
        print(f"FATAL: no SQLite file at {sqlite_path}", file=sys.stderr)
        sys.exit(1)

    if not settings.DATABASE_URL.startswith("mysql"):
        print(
            f"FATAL: DATABASE_URL ({settings.DATABASE_URL!r}) is not a mysql:// URL.\n"
            "Point .env's DATABASE_URL at the target MySQL database before running this.",
            file=sys.stderr,
        )
        sys.exit(1)

    source_engine = create_engine(f"sqlite:///{sqlite_path}", future=True)
    target_engine = create_engine(settings.DATABASE_URL, future=True)

    print(f"Source: sqlite:///{sqlite_path}")
    print(f"Target: {settings.DATABASE_URL}")

    target_tables = set(inspect(target_engine).get_table_names())
    if not args.dry_run and not target_tables:
        print(_MISSING_SCHEMA_HELP, file=sys.stderr)
        sys.exit(1)

    tables = Base.metadata.sorted_tables  # parent tables before children (FK order)
    total_copied = 0

    with source_engine.connect() as src, target_engine.connect() as tgt:
        # In dry-run mode the target schema may not exist yet (e.g.
        # previewing before ever running `alembic upgrade head` against
        # it) — that's fine, it just means "0 rows there" rather than a
        # query error. Outside dry-run, target_tables is already
        # confirmed non-empty above.
        target_has_table = target_tables

        # FK order is respected by sorted_tables already; disabling checks
        # too is just cheap insurance against ordering surprises.
        if not args.dry_run:
            tgt.exec_driver_sql("SET FOREIGN_KEY_CHECKS=0")

        for table in tables:
            src_count = src.execute(select(func.count()).select_from(table)).scalar_one()

            if args.dry_run:
                if table.name in target_has_table:
                    tgt_count = tgt.execute(select(func.count()).select_from(table)).scalar_one()
                else:
                    tgt_count = 0
                print(f"  {table.name:<28} source rows: {src_count:>6}   target rows: {tgt_count:>6}")
                continue

            tgt_count = tgt.execute(select(func.count()).select_from(table)).scalar_one()

            if tgt_count > 0:
                if not args.truncate:
                    print(
                        f"  {table.name:<28} SKIPPED — target already has {tgt_count} row(s). "
                        "Re-run with --truncate to overwrite.",
                    )
                    continue
                tgt.execute(delete(table))

            if src_count == 0:
                print(f"  {table.name:<28} 0 rows, nothing to copy")
                continue

            rows = [dict(r) for r in src.execute(select(table)).mappings().all()]
            tgt.execute(insert(table), rows)
            total_copied += len(rows)
            print(f"  {table.name:<28} copied {len(rows)} row(s)")

        if not args.dry_run:
            tgt.exec_driver_sql("SET FOREIGN_KEY_CHECKS=1")
            tgt.commit()

    if args.dry_run:
        print("\nDry run only — nothing was written. Re-run without --dry-run to copy.")
    else:
        print(f"\nDone — {total_copied} row(s) copied into MySQL.")


if __name__ == "__main__":
    main()
