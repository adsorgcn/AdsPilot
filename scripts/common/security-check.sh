#!/usr/bin/env bash
# DEPRECATED. This script previously embedded the very secrets it searched for
# (self-leaking) and missed JWTs entirely. Replaced by the pattern-only scanner:
#   scripts/security/scan-secrets.sh   (scan-staged | scan-tree)
# Enabled automatically as a pre-commit hook via: bash scripts/security/enable-hooks.sh
exec "$(git rev-parse --show-toplevel)/scripts/security/scan-secrets.sh" scan-tree
