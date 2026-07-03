#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 3 ]]; then
  cat <<'USAGE'
Usage: scripts/env/update-run-service.sh <project-id> <region> <service-name> [--include-optional]

Example:
  scripts/env/update-run-service.sh ${GCP_PROJECT_ID} asia-northeast1 billing
USAGE
  exit 1
fi

PROJECT_ID=$1
REGION=$2
SERVICE=$3
shift 3

ARGS=("--project" "$PROJECT_ID" "--region" "$REGION" "--service" "$SERVICE" "--print-command")

if [[ $# -gt 0 ]]; then
  ARGS+=("$@")
fi

COMMAND=$(python3 "$(dirname "$0")/build_update_command.py" "${ARGS[@]}")

echo "[info] executing: $COMMAND"
# shellcheck disable=SC2086
$COMMAND
