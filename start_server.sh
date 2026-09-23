#!/usr/bin/env bash
# ============================================================
#  Starts the already-installed JDK backend (which also serves
#  the built public site and admin dashboard) under gunicorn +
#  uvicorn workers — the standard Linux production combo, and
#  what systemd should point at (see deploy/jdk-web.service).
#
#  First-time setup (no installer — do this once, by hand):
#    npm install && npm run build
#    cd backend && python3 -m venv venv && venv/bin/pip install -r requirements.txt
#    cp backend/.env.example backend/.env   # then edit DATABASE_URL, ALLOWED_ORIGINS
#    cd backend && venv/bin/python scripts/gen_secrets.py --write-env .env
#    cd backend && venv/bin/python scripts/init_db.py
#
#      ./start_server.sh
#
#  Env overrides: HOST, PORT, WEB_CONCURRENCY (worker count).
# ============================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
VENV_PY="$BACKEND_DIR/venv/bin/python"

if [ ! -x "$VENV_PY" ]; then
  echo "ERROR: backend virtualenv not found at $VENV_PY" >&2
  echo "        Run: cd backend && python3 -m venv venv && venv/bin/pip install -r requirements.txt" >&2
  exit 1
fi

# Catches the #1 cause of "PM2 shows it running for a second then nothing
# is listening, no visible error": the venv exists but is stale — e.g.
# requirements.txt gained gunicorn after this venv was created. Without
# this check, `python -m gunicorn` just fails at import and the process
# exits before binding any port or printing anything under a process
# manager's captured (non-interactive) output.
if ! "$VENV_PY" -c "import gunicorn, uvicorn.workers" >/dev/null 2>&1; then
  echo "ERROR: gunicorn/uvicorn not importable in $VENV_PY" >&2
  echo "        Your venv is likely stale. Run:" >&2
  echo "        cd backend && venv/bin/pip install -r requirements.txt" >&2
  exit 1
fi

if [ ! -f "$ROOT_DIR/dist/index.html" ]; then
  echo "WARNING: $ROOT_DIR/dist/index.html not found — the site/admin" >&2
  echo "          UI will 404 until you run: npm run build" >&2
fi

cd "$BACKEND_DIR"

HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-7001}"
# Gunicorn's own rule of thumb is (2 x CPU cores) + 1; 3 is a
# reasonable default for a small VM. Override with WEB_CONCURRENCY.
WORKERS="${WEB_CONCURRENCY:-3}"

if (exec 3<>"/dev/tcp/$HOST/$PORT") 2>/dev/null; then
  exec 3>&- 3<&-
  echo "ERROR: something is already listening on $HOST:$PORT" >&2
  echo "        Find it with: ss -ltnp | grep $PORT" >&2
  exit 1
fi

echo "JDK server starting..."
echo
echo "  Public site        http://$HOST:$PORT/"
echo "  Admin dashboard    http://$HOST:$PORT/admin"
echo "  Workers            $WORKERS"
echo

# exec (not a subshell) so systemd/PM2/whatever manages this process
# can signal it directly for graceful shutdown/restart.
exec "$VENV_PY" -m gunicorn app.main:app \
  --worker-class uvicorn.workers.UvicornWorker \
  --workers "$WORKERS" \
  --bind "$HOST:$PORT" \
  --access-logfile - \
  --error-logfile -
