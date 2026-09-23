#!/usr/bin/env bash
# ============================================================
#  One-time setup for a fresh checkout on Ubuntu/Linux:
#  frontend build + backend virtualenv + .env scaffolding.
#
#      ./install.sh
# ============================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"

echo "==> Installing frontend dependencies"
cd "$ROOT_DIR"
npm install

echo "==> Building frontend (dist/) — serves both the public site and /admin"
npm run build

echo "==> Setting up backend virtualenv"
cd "$BACKEND_DIR"
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
deactivate

if [ ! -f .env ]; then
  echo "==> Creating backend/.env from .env.example"
  cp .env.example .env
  echo "    Edit it now: DATABASE_URL, ALLOWED_ORIGINS, then generate secrets (next step)."
fi

cat <<'MSG'

==> Setup complete.

Next steps:
  1. Edit backend/.env — at minimum DATABASE_URL and ALLOWED_ORIGINS
     for your real domain.
  2. Generate production secrets + the bootstrap admin password hash:
       cd backend && venv/bin/python scripts/gen_secrets.py --write-env .env
  3. Initialize the database (first run only):
       cd backend && venv/bin/python scripts/init_db.py
  4. Start the server:
       ./start_server.sh
MSG
