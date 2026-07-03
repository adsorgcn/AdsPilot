#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
SCHEMA_PATH="apps/frontend/prisma/schema.prisma"
CONFIG_PATH_DEFAULT="gofly_admin_v3/config.yaml"

help() {
  cat <<EOF
Usage: $0 <command> [--config path] [--schema path]

Commands:
  status                Show Prisma migration status
  deploy                Apply Prisma migrations (deploy)
  diff                  Show SQL diff between migrations and target DB
  resolve <name>        Mark a migration as applied (baseline) by name
  resolve-rolled <name> Mark a migration as rolled back (failed) by name
  format                Run prisma format on schema
  validate              Validate prisma schema

Options:
  --config <path>       Config YAML path (default: $CONFIG_PATH_DEFAULT)
  --schema <path>       Prisma schema path (default: $SCHEMA_PATH)

Environment:
  DATABASE_URL          If unset, derived from config.yaml (mysql://user:pass@host:port/db)
  SHADOW_DATABASE_URL   Optional; used by prisma migrate diff

Examples:
  $0 status
  $0 deploy
  $0 diff
  $0 resolve 20250919000000_backend_core_mysql
EOF
}

parse_args() {
  CONFIG_PATH="$CONFIG_PATH_DEFAULT"
  SCHEMA="$SCHEMA_PATH"
  CMD=""
  ARG1=""
  while [[ $# -gt 0 ]]; do
    case "$1" in
      status|deploy|diff|resolve|resolve-rolled|format|validate) CMD="$1"; shift; if [[ "$CMD" == "resolve" || "$CMD" == "resolve-rolled" ]]; then ARG1="${1:-}"; [[ -z "$ARG1" ]] && { echo "$CMD requires a migration name"; exit 1; }; shift; fi ;;
      --config) CONFIG_PATH="$2"; shift 2 ;;
      --schema) SCHEMA="$2"; shift 2 ;;
      -h|--help) help; exit 0 ;;
      *) echo "Unknown arg: $1"; help; exit 1 ;;
    esac
  done
  [[ -z "$CMD" ]] && { help; exit 1; }
}

ensure_database_url() {
  if [[ -n "${DATABASE_URL:-}" ]]; then
    return 0
  fi
  local cfg="$CONFIG_PATH"
  if [[ ! -f "$cfg" ]]; then
    echo "Config not found: $cfg" >&2; exit 2
  fi
  # Extract database.{host,port,username,password,database}
  local host port user pass db
  # shellcheck disable=SC2016
  eval $(awk '
    /^[[:space:]]*database:[[:space:]]*$/ { in_db=1; next }
    in_db==1 && /^[^[:space:]]/ { in_db=0 }
    in_db==1 {
      if ($1 ~ /^[[:space:]]*host:/)     { sub(/^[[:space:]]*host:[[:space:]]*/, ""); gsub(/"/, ""); print "_H=" $0 }
      if ($1 ~ /^[[:space:]]*port:/)     { sub(/^[[:space:]]*port:[[:space:]]*/, ""); gsub(/"/, ""); print "_P=" $0 }
      if ($1 ~ /^[[:space:]]*username:/) { sub(/^[[:space:]]*username:[[:space:]]*/, ""); gsub(/"/, ""); print "_U=" $0 }
      if ($1 ~ /^[[:space:]]*password:/) { sub(/^[[:space:]]*password:[[:space:]]*/, ""); gsub(/"/, ""); print "_W=" $0 }
      if ($1 ~ /^[[:space:]]*database:/) { sub(/^[[:space:]]*database:[[:space:]]*/, ""); gsub(/"/, ""); print "_D=" $0 }
    }
  ' "$cfg")
  host="${_H:-}"; port="${_P:-}"; user="${_U:-}"; pass="${_W:-}"; db="${_D:-}"
  if [[ -z "$host$port$user$pass$db" ]]; then
    echo "Failed to derive DATABASE_URL from $cfg; please export DATABASE_URL" >&2; exit 3
  fi
  export DATABASE_URL="mysql://${user}:${pass}@${host}:${port}/${db}"
}

run_prisma() {
  # Run prisma from apps/frontend where devDependency exists (no network pull)
  ( cd "$ROOT_DIR/apps/frontend" && npx prisma "$@" )
}

main() {
  parse_args "$@"
  case "$CMD" in
    status)
      ensure_database_url
      run_prisma migrate status --schema "$SCHEMA"
      ;;
    deploy)
      ensure_database_url
      run_prisma migrate deploy --schema "$SCHEMA"
      ;;
    diff)
      ensure_database_url
      run_prisma migrate diff --from-migrations "$(dirname "$SCHEMA")/migrations" --to-url "$DATABASE_URL" --script ${SHADOW_DATABASE_URL:+--shadow-database-url "$SHADOW_DATABASE_URL"}
      ;;
    resolve)
      ensure_database_url
      run_prisma migrate resolve --schema "$SCHEMA" --applied "$ARG1"
      ;;
    resolve-rolled)
      ensure_database_url
      run_prisma migrate resolve --schema "$SCHEMA" --rolled-back "$ARG1"
      ;;
    format)
      ( cd "$ROOT_DIR/apps/frontend" && npx prisma format --schema "$SCHEMA" )
      ;;
    validate)
      ( cd "$ROOT_DIR/apps/frontend" && npx prisma validate --schema "$SCHEMA" )
      ;;
  esac
}

main "$@"
