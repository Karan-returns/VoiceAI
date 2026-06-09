#!/usr/bin/env bash
# Full deploy helper — run after: lk cloud auth
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Building agent..."
npm run build

echo "==> Preparing secrets..."
bash scripts/prepareSecrets.sh

echo "==> Checking LiveKit Cloud auth..."
if ! lk project list 2>&1 | grep -qv 'No projects configured'; then
  echo ""
  echo "Not logged in to LiveKit Cloud. Press Ctrl+C if this script is still running, then:"
  echo "  lk cloud auth"
  echo ""
  echo "Complete login in the browser, then re-run:"
  echo "  bash scripts/deploy.sh"
  exit 1
fi

if [[ -f livekit.toml ]] && grep -qE '^\s*id\s*=' livekit.toml 2>/dev/null; then
  echo "==> Deploying existing agent..."
  lk agent deploy --secrets-file .env.secrets
else
  echo "==> Creating new agent (first deploy)..."
  lk agent create --secrets-file .env.secrets
  echo "==> Deploying..."
  lk agent deploy --secrets-file .env.secrets
fi

echo ""
echo "==> Agent status:"
lk agent status
echo ""
echo "Test at https://agents-playground.livekit.io with your LiveKit URL + API key/secret."
