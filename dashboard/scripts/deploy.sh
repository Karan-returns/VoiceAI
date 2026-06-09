#!/usr/bin/env bash
# Build and run QA dashboard locally in Docker (or print Render deploy steps).
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "Copy .env.example to .env and set MONGODB_URI first."
  exit 1
fi

# shellcheck disable=SC1091
source .env

if [[ -z "${MONGODB_URI:-}" ]]; then
  echo "MONGODB_URI is required in .env"
  exit 1
fi

if [[ -z "${DASHBOARD_API_KEY:-}" ]]; then
  DASHBOARD_API_KEY="$(openssl rand -hex 24)"
  echo "DASHBOARD_API_KEY=${DASHBOARD_API_KEY}" >> .env
  echo "Generated DASHBOARD_API_KEY and appended to .env"
  echo "Share this key with your team for dashboard login."
fi

echo "==> Building Docker image..."
docker build -t novatel-qa-dashboard .

echo "==> Starting container on http://localhost:${DASHBOARD_PORT:-3456}"
docker rm -f novatel-qa-dashboard 2>/dev/null || true
docker run -d \
  --name novatel-qa-dashboard \
  -p "${DASHBOARD_PORT:-3456}:3456" \
  -e "MONGODB_URI=${MONGODB_URI}" \
  -e "DASHBOARD_API_KEY=${DASHBOARD_API_KEY}" \
  -e "PORT=3456" \
  novatel-qa-dashboard

echo ""
echo "Dashboard running at http://localhost:${DASHBOARD_PORT:-3456}"
echo "Access key for teammates: ${DASHBOARD_API_KEY}"
echo ""
echo "To host on Render (free): push to GitHub, then"
echo "  https://dashboard.render.com → New → Web Service → connect repo"
echo "  Root directory: dashboard"
echo "  Runtime: Docker"
echo "  Add env: MONGODB_URI + DASHBOARD_API_KEY (same key as above)"
