#!/usr/bin/env bash
# ============================================================
#  One idempotent script that gets this app from a fresh clone (or an
#  updated one) to "ready to run" — replaces the old manual sequence of
#  venv + .env copy + secrets gen + init_db.py + npm build, which was
#  easy to get partway through and forget a step.
#
#  Safe to re-run any number of times: each step only does work if
#  something is actually missing or out of date.
#
#  First-time install:
#    cp backend/.env.example backend/.env   # then edit DATABASE_URL, ALLOWED_ORIGINS
#    ./setup.sh                             # prompts once for an admin password
#
#  After pulling new code:
#    ./setup.sh
#
#  To also restart PM2 and verify the app came back up, use ./deploy.sh
#  instead of calling this directly.
# ============================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
VENV_PY="$BACKEND_DIR/venv/bin/python"
VENV_PIP="$BACKEND_DIR/venv/bin/pip"
ENV_FILE="$BACKEND_DIR/.env"

echo "==> Python virtualenv"
if [ ! -x "$VENV_PY" ]; then
  python3 -m venv "$BACKEND_DIR/venv"
  echo "    created $BACKEND_DIR/venv"
else
  echo "    already exists"
fi
"$VENV_PIP" install -q --upgrade pip
"$VENV_PIP" install -q -r "$BACKEND_DIR/requirements.txt"
echo "    dependencies installed/up to date"

echo "==> backend/.env"
if [ ! -f "$ENV_FILE" ]; then
  if [ ! -f "$BACKEND_DIR/.env.example" ]; then
    echo "FATAL: no backend/.env and no backend/.env.example to copy from." >&2
    exit 1
  fi
  cp "$BACKEND_DIR/.env.example" "$ENV_FILE"
  echo "    created from .env.example — edit DATABASE_URL / ALLOWED_ORIGINS / BEHIND_TLS_PROXY as needed"
else
  echo "    already exists"
fi

echo "==> secrets (SECRET_KEY, ENCRYPTION_KEY, bootstrap admin)"
secret_key_val="$(grep -E '^SECRET_KEY=' "$ENV_FILE" | head -1 | cut -d= -f2-)"
encryption_key_val="$(grep -E '^ENCRYPTION_KEY=' "$ENV_FILE" | head -1 | cut -d= -f2-)"
if [ -z "$secret_key_val" ] || [ -z "$encryption_key_val" ]; then
  if [ -t 0 ]; then
    "$VENV_PY" "$BACKEND_DIR/scripts/gen_secrets.py" --write-env "$ENV_FILE"
  else
    echo "FATAL: SECRET_KEY/ENCRYPTION_KEY are blank in $ENV_FILE and there's no terminal to prompt for an admin password." >&2
    echo "        Run this once, interactively (or pass --password):" >&2
    echo "        $VENV_PY $BACKEND_DIR/scripts/gen_secrets.py --write-env $ENV_FILE" >&2
    exit 1
  fi
else
  echo "    already set, skipping"
fi

echo "==> frontend build"
cd "$ROOT_DIR"
npm install
npm run build
echo "    dist/ built"

echo "==> database migrations"
cd "$BACKEND_DIR"
"$VENV_PY" -m alembic upgrade head

echo "==> bootstrap admin account (only if none exists yet)"
"$VENV_PY" scripts/seed_admin.py

# Fills any MISSING site content (About / Products / Quality / Contact
# pages, FAQ, on-screen text, product catalog) and rewrites legacy brand
# text stored in the DB. Safe on every deploy: it never overwrites what an
# admin has edited (use `scripts/seed_content.py --force` to replace).
# Non-fatal — a content problem must not block the app itself from deploying.
echo "==> seed site content"
if ! "$VENV_PY" scripts/seed_content.py; then
  echo "WARNING: content seed failed — the site will use its bundled fallback content." >&2
  echo "         Fix the error above, then run: $VENV_PY $BACKEND_DIR/scripts/seed_content.py" >&2
fi

echo
echo "Setup complete."
