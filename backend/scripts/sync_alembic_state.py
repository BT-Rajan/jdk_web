#!/usr/bin/env python3
"""
One-time repair for: alembic upgrade head failing with
"Table 'admin_user' already exists" (error 1050).

Cause: tables were created directly via SQLAlchemy
(Base.metadata.create_all) before Alembic ever ran, so
alembic_version was never stamped. Alembic then tries to
recreate tables that already exist.

This script is read-only about intent: it inspects the DB,
tells you exactly what it's about to do, and only stamps
alembic_version if every table the initial migration would
create is already present (i.e. it's safe to consider that
migration "done"). It never drops or alters data.

    python scripts/sync_alembic_state.py            # dry run (default)
    python scripts/sync_alembic_state.py --apply     # actually stamp
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import inspect
from alembic.config import Config
from alembic.script import ScriptDirectory
from alembic.runtime.migration import MigrationContext

from app.db import engine

BACKEND_DIR = Path(__file__).resolve().parent.parent


def main() -> None:
    apply = "--apply" in sys.argv

    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    script = ScriptDirectory.from_config(cfg)
    head_rev = script.get_current_head()

    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    with engine.connect() as conn:
        ctx = MigrationContext.configure(conn)
        current_rev = ctx.get_current_revision()

    print(f"Current alembic_version in DB : {current_rev!r}")
    print(f"Latest migration head         : {head_rev!r}")
    print(f"Tables found in DB            : {len(existing_tables)}")

    if current_rev == head_rev:
        print("Already in sync — nothing to do.")
        return

    if current_rev is not None:
        print(
            f"alembic_version is set to {current_rev!r}, not empty — "
            "this isn't the 'never stamped' case. Not touching it "
            "automatically; check manually with `alembic history`."
        )
        return

    # Walk every revision from base to head and collect every table
    # each one would create, so this works even if more migrations
    # get added later.
    expected_tables: set[str] = set()
    for rev in script.walk_revisions(base="base", head=head_rev):
        module = rev.module
        src = Path(module.__file__).read_text(encoding="utf-8")
        for line in src.splitlines():
            line = line.strip()
            if line.startswith("op.create_table("):
                name = line.split("op.create_table(", 1)[1].split(",", 1)[0]
                expected_tables.add(name.strip("'\""))

    missing = expected_tables - existing_tables
    if missing:
        print(
            "NOT safe to auto-stamp: these tables the migrations "
            f"expect are missing from the DB: {sorted(missing)}"
        )
        print(
            "Schema is only partially applied — investigate manually "
            "(compare `alembic history` against `SHOW TABLES`) before "
            "running `alembic upgrade head` or stamping."
        )
        return

    print(
        f"All {len(expected_tables)} expected tables already exist and "
        f"alembic_version is empty → safe to stamp at head {head_rev!r}."
    )
    if not apply:
        print("Dry run only. Re-run with --apply to actually stamp.")
        return

    from alembic import command

    command.stamp(cfg, head_rev)
    print(f"Stamped alembic_version = {head_rev}. `alembic upgrade head` will now run cleanly.")


if __name__ == "__main__":
    main()
