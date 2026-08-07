#!/usr/bin/env bash
# Idempotent dependency bootstrap for the AdsPilot / Google-Monetize monorepo.
# Safe to run repeatedly: it only refreshes dependencies and seeds a local
# frontend env file when one is not already present.
set -euo pipefail

# Resolve repo root relative to this script so the command works regardless of cwd.
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

echo "[install] Go workspace sync (downloads module dependencies)"
go work sync

echo "[install] npm install (root workspaces: apps/*, services/*, packages/*)"
npm install

# Seed a local frontend env file for `next dev` if the developer has not provided
# one. Public marketing pages render without real credentials; authenticated flows
# require replacing these placeholders with a real Supabase project's keys.
FE_ENV="apps/frontend/.env.local"
if [ ! -f "$FE_ENV" ]; then
  echo "[install] seeding $FE_ENV with local placeholders"
  cat > "$FE_ENV" <<'EOF'
# Auto-generated local dev placeholders. Replace with real Supabase project values
# to enable authenticated flows. Public marketing pages work without them.
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=local-anon-key-placeholder
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_API_BASE_URL=http://localhost:8090
EOF
else
  echo "[install] $FE_ENV already exists; leaving it untouched"
fi

echo "[install] done"
