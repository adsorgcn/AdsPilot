#!/usr/bin/env bash
# Run an AdsPilot service in the single-user local model (macOS/Linux).
#   ./scripts/dev-local.sh                # adscenter on 127.0.0.1:8080
#   ./scripts/dev-local.sh aicore 8082    # aicore on 127.0.0.1:8082
set -euo pipefail

SERVICE="${1:-adscenter}"
PORT="${2:-8080}"

cd "$(dirname "$0")/.."

# Load KEY=VALUE lines from the repo-root .env (gitignored; see .env.example).
# This is where Google Ads credentials live in the local model.
if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

# Command-line arguments win over .env for these two.
ADSPILOT_LOCAL=1 PORT="$PORT" go run "./services/$SERVICE"
