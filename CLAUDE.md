# Google-Monetize — Project Context

AI-driven Google Ads management & automation backend (Go microservices + Next.js frontend).

## Layout
- `services/*` — independent Go modules, one per service (adscenter, siterank, billing, user, console, recommendations, batchopen, bff, gateway-middleware, projector, useractivity)
- `pkg/*` — shared Go libraries (cache, database, events, httpclient, middleware, telemetry, ...)
- `apps/frontend` — Next.js web UI; `packages/*` — shared TS packages
- `go.work` — Go workspace tying the modules together

## Conventions
- All config via environment variables. Nothing hardcoded: no project IDs, domains, or credentials in source.
- Backend: Go 1.25.1+. Frontend: pnpm + turbo.
- `GCP_PROJECT_ID`, `APP_DOMAIN`, `DATABASE_URL`, `REDIS_URL` are the core env vars.

## Build
- Backend: `go work sync && go build ./...`
- Frontend: `pnpm install && pnpm build`
