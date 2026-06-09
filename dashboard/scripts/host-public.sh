#!/usr/bin/env bash
# Run dashboard in Docker and expose a temporary public URL via localtunnel.
# For a permanent URL, use Render — see DEPLOY.md
set -euo pipefail
cd "$(dirname "$0")/.."

bash scripts/deploy.sh

echo ""
echo "==> Starting public tunnel (Ctrl+C stops the URL)..."
npx --yes localtunnel --port "${DASHBOARD_PORT:-3456}"
