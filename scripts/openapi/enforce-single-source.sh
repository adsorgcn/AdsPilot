#!/usr/bin/env bash
set -euo pipefail

# Enforce single source of truth for OpenAPI specs.
# Fails if files under services/*/openapi.yaml are modified in the change set.

BASE_REF=${1:-}

detect_base() {
  # Prefer GitHub-provided base ref for PRs
  if [[ -n "${GITHUB_BASE_REF:-}" ]]; then
    echo "origin/${GITHUB_BASE_REF}"
    return
  fi
  # If explicit arg provided
  if [[ -n "$BASE_REF" ]]; then
    echo "$BASE_REF"
    return
  fi
  # Fallback: previous commit on current branch
  if git rev-parse --verify HEAD~1 >/dev/null 2>&1; then
    echo "HEAD~1"
    return
  fi
  # Initial commit case: nothing to compare
  echo ""
}

BASE=$(detect_base)
if [[ -n "$BASE" ]]; then
  # Shallow fetch for comparison
  git fetch --no-tags --depth=2 origin "+${BASE}:${BASE}" 2>/dev/null || true
  CHANGED=$(git diff --name-only "$BASE"...HEAD 2>/dev/null || git diff --name-only "$BASE" HEAD 2>/dev/null || true)
  if [[ -z "$CHANGED" ]]; then
    echo "[warn] No changes detected, checking HEAD~1" >&2
    CHANGED=$(git diff --name-only HEAD~1 HEAD 2>/dev/null || true)
  fi
else
  # Initial commit or no base: check all tracked files
  CHANGED=$(git ls-files)
fi

violations=()
for f in $CHANGED; do
  [[ -z "$f" ]] && continue
  case "$f" in
    services/*/openapi.yaml)
      # Check if only comment lines changed (header sync is allowed)
      if [[ -n "$BASE" ]] && [[ -f "$f" ]]; then
        if git diff "$BASE" HEAD -- "$f" | grep -E '^\+[^+#]|^-[^-#]' >/dev/null 2>&1; then
          # Non-comment lines changed
          violations+=("$f")
        fi
      else
        violations+=("$f")
      fi
      ;;
  esac
done

if (( ${#violations[@]} )); then
  echo "[error] The following service OpenAPI files were modified:" >&2
  printf '  - %s\n' "${violations[@]}" >&2
  echo "Please edit the canonical specs under specs/openapi/*.yaml and use scripts/openapi/generate.sh to refresh service stubs." >&2
  exit 1
fi

echo "[OK] Single-source OpenAPI enforcement passed (no service openapi.yaml modified)."

