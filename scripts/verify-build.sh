#!/usr/bin/env bash
# Compatibility wrapper for developer-only legacy service builds.
# No tidy or manifest changes; primary skill verification needs neither Go nor Bash.
set -euo pipefail
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
exec node "$script_dir/verify-go.mjs" --scope services --build "$@"
