#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 2 ]]; then
  echo "Usage: $0 <project-id> <output-file>" >&2
  echo "Example: $0 ${GCP_PROJECT_ID} .env.preview.generated" >&2
  exit 1
fi

PROJECT_ID="$1"
OUTPUT_FILE="$2"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

python3 "${SCRIPT_DIR}/audit_secrets.py" \
  --project "${PROJECT_ID}" \
  --export "${REPO_ROOT}/${OUTPUT_FILE}"
