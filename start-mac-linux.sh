#!/usr/bin/env bash
# One-command setup and launch for macOS and Linux. Needs Python 3.12-3.14 and Node.js 20+.
set -euo pipefail
cd "$(dirname "$0")"
ROOT="$PWD"

PY=""
for c in python3.13 python3.12 python3.14 python3; do
  if command -v "$c" >/dev/null && "$c" -c 'import sys; sys.exit(0 if (3,12) <= sys.version_info[:2] <= (3,14) else 1)'; then PY="$c"; break; fi
done
[ -n "$PY" ] || { echo "Install Python 3.13 from https://www.python.org/downloads/ and run this again."; exit 1; }
command -v node >/dev/null && [ "$(node -p 'process.versions.node.split(".")[0]')" -ge 20 ] \
  || { echo "Install Node.js LTS from https://nodejs.org/ and run this again."; exit 1; }

echo "==> Python packages (first run takes several minutes)"
[ -x Finance-v1/.venv/bin/python ] || "$PY" -m venv Finance-v1/.venv
Finance-v1/.venv/bin/python -m pip install -q --disable-pip-version-check -r Finance-v1/requirements.txt

for app in AlphaSharp/backend AlphaSharp/frontend; do
  echo "==> Node packages for $app"
  [ -d "$app/node_modules" ] || (cd "$app" && npm ci --no-audit --no-fund --loglevel=error)
done
[ -f .env ] || [ -f Finance-v1/.env ] || cp .env.example .env

mkdir -p .local-logs
echo "==> Fetching the latest market closes"
(cd Finance-v1 && .venv/bin/python -m research.data > ../.local-logs/data-refresh.log 2>&1) || echo "Could not refresh market data. Using the saved data."
(cd Finance-v1 && exec .venv/bin/python -m uvicorn combined_api:app --host 127.0.0.1 --port 4000) > .local-logs/python.log 2>&1 &
P1=$!
(cd AlphaSharp/backend && exec node server.js) > .local-logs/api.log 2>&1 &
P2=$!
(cd AlphaSharp/frontend && exec node node_modules/vite/bin/vite.js --host 127.0.0.1) > .local-logs/frontend.log 2>&1 &
P3=$!
trap 'kill $P1 $P2 $P3 2>/dev/null; echo "AlphaSharp stopped."' EXIT INT TERM

echo "==> Waiting for services"
for url in http://127.0.0.1:4000/ http://127.0.0.1:5000/health http://127.0.0.1:5173/; do
  for _ in $(seq 1 120); do curl -sf "$url" >/dev/null && break; sleep 1; done
done
URL=http://127.0.0.1:5173
(command -v open >/dev/null && open "$URL") || (command -v xdg-open >/dev/null && xdg-open "$URL") || true
echo "AlphaSharp is running at $URL. Press Ctrl+C to stop."
wait
