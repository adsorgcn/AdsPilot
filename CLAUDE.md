# AdsPilot — Project Context

AI-driven Google Ads automation. Single-user local-first model: an AI agent and
a human operate it together on one machine. No gateway, no login, no Docker.

## Paradigm
- `ADSPILOT_LOCAL=1` puts every service in local mode: bind 127.0.0.1 only,
  loopback requests get the fixed `local` user identity, and adscenter boots an
  embedded PostgreSQL (data in `~/.adspilot/pg`) when `DATABASE_URL` is unset.
- Google Ads auth is a loopback OAuth flow (Desktop client + PKCE); the refresh
  token lives only in `~/.adspilot/credentials.json`. See `docs/local-auth.md`.
- Credentials go in the repo-root `.env` (gitignored, template `.env.example`);
  `scripts/dev-local.ps1` / `.sh` load it on start.

## Layout
- `services/*` — independent Go modules: adscenter (Google Ads ops, the core),
  aicore, affiliate, bff, console, gateway-middleware, projector, proxy-pool,
  recommendations, siterank, useractivity
- `pkg/*` — shared Go libraries (cache, config, database, events, middleware, ...)
- `apps/frontend` — Next.js UI (npm, NOT pnpm); `packages/*` — shared TS types
- `specs/openapi/*.yaml` — canonical OpenAPI specs; `services/*/openapi.yaml`
  are mirrors; generated code in `services/*/internal/oapi` via
  `scripts/openapi/gen-go-stubs.sh` (oapi-codegen)

## Build & verify
- Services build standalone, matching CI/Dockerfiles: per module
  `GOWORK=off go mod tidy && go build ./...`. Run it all:
  `bash scripts/verify-build.sh` (expect 11/11).
- Root `go build ./...` does NOT work (modules resolve via per-module replace
  directives). `go work sync` and standalone tidy can disagree; standalone wins.
- Run locally: `.\scripts\dev-local.ps1` (Windows) / `./scripts/dev-local.sh`.

## Traps (learned the hard way)
- `.gitignore` anchors `/secrets/` deliberately: an unanchored `secrets/` rule
  swallowed `services/adscenter/internal/secrets` twice. Committing anything
  under a dir named `secrets` requires care (`git status` before push).
- All config via environment variables. No project IDs, domains, or credentials
  in source.
