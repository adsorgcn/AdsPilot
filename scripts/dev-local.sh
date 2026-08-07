#!/usr/bin/env bash
# Run an AdsPilot service in the single-user local model (macOS/Linux).
#   ./scripts/dev-local.sh                # adscenter on 127.0.0.1:8080
#   ./scripts/dev-local.sh aicore 8082    # aicore on 127.0.0.1:8082
set -euo pipefail

SERVICE="${1:-adscenter}"
PORT="${2:-8080}"

cd "$(dirname "$0")/.."
ADSPILOT_LOCAL=1 PORT="$PORT" go run "./services/$SERVICE"
