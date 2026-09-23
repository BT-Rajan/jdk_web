#!/usr/bin/env bash
# ============================================================
#  Update path for an already-installed deployment: pulls the latest
#  code, re-runs setup.sh (idempotent — cheap when nothing changed),
#  restarts PM2, then verifies the restarted process is actually
#  healthy before declaring success.
#
#  This last step is the direct fix for "PM2 shows it running but
#  nothing works": previously that was only discovered by someone
#  noticing later. Now the deploy itself fails loudly if the app
#  doesn't come back up.
#
#  Usage:
#    ./deploy.sh              # deploys the current branch
#    ./deploy.sh main         # fetches + checks out a specific branch first
# ============================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

BRANCH="${1:-$(git rev-parse --abbrev-ref HEAD)}"
PORT="${PORT:-7001}"
PM2_APP_NAME="${PM2_APP_NAME:-jdk-web}"

echo "==> git pull (branch: $BRANCH)"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull origin "$BRANCH"

echo "==> setup.sh"
"$ROOT_DIR/setup.sh"

echo "==> pm2 restart $PM2_APP_NAME"
if pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1; then
  pm2 restart "$PM2_APP_NAME" --update-env
else
  pm2 start "$ROOT_DIR/ecosystem.config.cjs"
fi

echo "==> health check"
healthy=0
for _ in $(seq 1 15); do
  if curl -fsS "http://127.0.0.1:${PORT}/api/health" >/dev/null 2>&1; then
    healthy=1
    break
  fi
  sleep 2
done

if [ "$healthy" -ne 1 ]; then
  echo "FATAL: app did not respond healthy on 127.0.0.1:${PORT}/api/health after restart." >&2
  echo "        Check: pm2 logs $PM2_APP_NAME --lines 50" >&2
  exit 1
fi

pm2 save
echo
echo "Deploy complete — 127.0.0.1:${PORT}/api/health is responding."
