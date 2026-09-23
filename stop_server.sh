#!/usr/bin/env bash
# ============================================================
#  Stops the JDK backend and forcefully frees the port it listens
#  on (default 7001) — companion to start_server.sh.
#
#  Order of operations:
#    1. If PM2 is managing the "jdk-web" process, stop it there
#       first (graceful — respects PM2's own state/logs).
#    2. Whatever is still bound to the port afterwards (a process
#       started outside PM2, a stray child, a hung worker) gets
#       SIGTERM, then SIGKILL if it hasn't exited after a short
#       grace period.
#    3. Verifies the port is actually free before exiting, and
#       fails loudly (non-zero exit) if it isn't.
#
#  Usage:
#    ./stop_server.sh
#    PORT=7002 ./stop_server.sh          # different port
#    PM2_APP_NAME=other ./stop_server.sh  # different PM2 app name
#    GRACE_SECONDS=10 ./stop_server.sh    # longer grace period
# ============================================================
# Deliberately no `-e` (unlike start_server.sh/deploy.sh): "port already
# free" / "no matching PIDs" are expected, non-error outcomes of the
# lookup helper below, not failures the script should abort on.
set -uo pipefail

PORT="${PORT:-7001}"
PM2_APP_NAME="${PM2_APP_NAME:-jdk-web}"
GRACE_SECONDS="${GRACE_SECONDS:-5}"

echo "==> Stopping JDK server (port $PORT)"

# --- 1. Stop via PM2 first, if it's managing this app -------------
if command -v pm2 >/dev/null 2>&1; then
  if pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1; then
    echo "==> pm2 stop $PM2_APP_NAME"
    pm2 stop "$PM2_APP_NAME" >/dev/null 2>&1 || true
  fi
fi

# --- helper: list PIDs currently LISTENing on $PORT ----------------
pids_on_port() {
  if command -v lsof >/dev/null 2>&1; then
    lsof -ti tcp:"$PORT" -sTCP:LISTEN 2>/dev/null
  elif command -v ss >/dev/null 2>&1; then
    ss -ltnp "sport = :$PORT" 2>/dev/null | grep -oP 'pid=\K[0-9]+' | sort -u
  elif command -v fuser >/dev/null 2>&1; then
    fuser "$PORT"/tcp 2>/dev/null | tr -s ' ' | tr ' ' '\n' | grep -E '^[0-9]+$'
  fi
  return 0
}

pids="$(pids_on_port)"

if [ -z "$pids" ]; then
  echo "Nothing listening on port $PORT."
  exit 0
fi

echo "==> Found process(es) on port $PORT: $(echo "$pids" | tr '\n' ' ')"
echo "==> Sending SIGTERM"
# shellcheck disable=SC2086
kill $pids 2>/dev/null || true

# --- wait up to GRACE_SECONDS for a graceful exit -------------------
for _ in $(seq 1 "$GRACE_SECONDS"); do
  pids="$(pids_on_port)"
  [ -z "$pids" ] && break
  sleep 1
done

# --- forceful fallback: SIGKILL anything still bound ---------------
pids="$(pids_on_port)"
if [ -n "$pids" ]; then
  echo "==> Still listening after ${GRACE_SECONDS}s — forcing SIGKILL: $(echo "$pids" | tr '\n' ' ')"
  # shellcheck disable=SC2086
  kill -9 $pids 2>/dev/null || true
  sleep 1
fi

# Last-resort belt-and-suspenders: if lsof/ss couldn't be used and
# fuser is available, its own -k flag will find and kill by socket
# directly rather than relying on a PID list we may have failed to parse.
if command -v fuser >/dev/null 2>&1; then
  fuser -k -TERM "$PORT"/tcp >/dev/null 2>&1 || true
  sleep 1
  fuser -k -KILL "$PORT"/tcp >/dev/null 2>&1 || true
fi

pids="$(pids_on_port)"
if [ -n "$pids" ]; then
  echo "ERROR: port $PORT still in use by: $(echo "$pids" | tr '\n' ' ')" >&2
  echo "        Check with: ss -ltnp | grep $PORT" >&2
  exit 1
fi

echo "Port $PORT is free."
