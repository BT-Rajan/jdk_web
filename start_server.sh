#!/usr/bin/env bash
# ============================================================
#  Starts the already-installed JDK backend (which also serves
#  the built public site and admin dashboard) under gunicorn +
#  uvicorn workers — the standard Linux production combo, and
#  what systemd should point at (see deploy/jdk-web.service).
#  Run install.sh first if you haven't yet.
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
  echo "        Run ./install.sh first." >&2
  exit 1
fi

cd "$BACKEND_DIR"

HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-8001}"
# Gunicorn's own rule of thumb is (2 x CPU cores) + 1; 3 is a
# reasonable default for a small VM. Override with WEB_CONCURRENCY.
WORKERS="${WEB_CONCURRENCY:-3}"

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
