#!/usr/bin/env bash
# ============================================================
#  Starts the already-installed JDK backend (which also serves
#  the built public site and admin dashboard) as a single
#  uvicorn process — meant to be run under PM2 (see
#  ecosystem.config.cjs) so PM2 does the restart/monitoring, not
#  a second process manager on top of it.
#
#  This script assumes everything is already installed/configured — it
#  does NOT set up the venv, .env, secrets, or run migrations. For that
#  (first-time install, or pulling new code), use:
#
#    ./setup.sh       # first-time, or after pulling code with new deps/migrations
#    ./deploy.sh       # setup.sh + restart PM2 + health check, in one step
#
#  Run directly (rare — normally PM2 execs this):
#    ./start_server.sh
#
#  Run under PM2 (recommended for production):
#    pm2 start ecosystem.config.cjs
#    pm2 save
#
#  Env overrides: HOST, PORT.
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
# requirements.txt gained a dependency after this venv was created.
# Without this check, `python -m uvicorn` just fails at import and the
# process exits before binding any port or printing anything under a
# process manager's captured (non-interactive) output.
if ! "$VENV_PY" -c "import uvicorn" >/dev/null 2>&1; then
  echo "ERROR: uvicorn not importable in $VENV_PY" >&2
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
echo

# exec (not a subshell) so PM2/systemd/whatever manages this process can
# signal it directly for shutdown/restart, and so it's the only OS
# process serving this app — no gunicorn master + worker pool underneath.
exec "$VENV_PY" -m uvicorn app.main:app \
  --host "$HOST" \
  --port "$PORT"
