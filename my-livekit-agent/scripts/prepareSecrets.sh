#!/usr/bin/env bash
# Build .env.secrets for LiveKit Cloud from your local .env + production overrides.
# Usage: ./scripts/prepareSecrets.sh

set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "Missing .env — copy .env.example and fill in your LiveKit + MongoDB credentials."
  exit 1
fi

# shellcheck disable=SC1091
source .env

required=(LIVEKIT_URL LIVEKIT_API_KEY LIVEKIT_API_SECRET MONGODB_URI)
missing=()
for key in "${required[@]}"; do
  if [[ -z "${!key:-}" ]]; then
    missing+=("$key")
  fi
done

if [[ ${#missing[@]} -gt 0 ]]; then
  echo "Missing required values in .env: ${missing[*]}"
  exit 1
fi

if [[ "$MONGODB_URI" == *"127.0.0.1"* || "$MONGODB_URI" == *"localhost"* ]]; then
  echo "WARNING: MONGODB_URI points to localhost."
  echo "LiveKit Cloud workers cannot reach your local MongoDB."
  echo "Use MongoDB Atlas (mongodb+srv://...) for cloud deployment."
  echo ""
fi

cat > .env.secrets <<EOF
LIVEKIT_URL=${LIVEKIT_URL}
LIVEKIT_API_KEY=${LIVEKIT_API_KEY}
LIVEKIT_API_SECRET=${LIVEKIT_API_SECRET}
MONGODB_URI=${MONGODB_URI}
STT_PROVIDER=${STT_PROVIDER:-livekit}
STT_MODEL=${STT_MODEL:-cartesia/ink-whisper}
STT_LANGUAGE=${STT_LANGUAGE:-en}
LLM_PROVIDER=${LLM_PROVIDER:-livekit}
LLM_MODEL=${LLM_MODEL:-openai/gpt-4.1-nano}
LLM_TEMPERATURE=${LLM_TEMPERATURE:-0.3}
TTS_PROVIDER=${TTS_PROVIDER:-livekit}
TTS_MODEL=${TTS_MODEL:-cartesia/sonic-turbo}
TTS_VOICE=${TTS_VOICE:-f786b574-daa5-4673-aa0c-cbe3e8534c02}
LOG_LEVEL=${LOG_LEVEL:-info}
RECORDING_ENABLED=${RECORDING_ENABLED:-true}
CALL_ANALYSIS_ENABLED=${CALL_ANALYSIS_ENABLED:-true}
PROMPT_EVOLUTION_ENABLED=false
SEED_BILLING=false
SEED_PROMPT=false
DATA_RETENTION_DAYS=${DATA_RETENTION_DAYS:-90}
NUM_IDLE_PROCESSES=${NUM_IDLE_PROCESSES:-1}
NODE_ENV=production
EOF

if [[ -n "${DEEPGRAM_API_KEY:-}" ]]; then
  echo "DEEPGRAM_API_KEY=${DEEPGRAM_API_KEY}" >> .env.secrets
fi

echo "Wrote .env.secrets (production flags applied, prompt evolution disabled)."
echo "Next: lk agent create --secrets-file .env.secrets  (first time only)"
echo "      lk agent deploy"
