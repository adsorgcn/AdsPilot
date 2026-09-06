# AdsPilot — Project Context

Primary product: an instruction-only, I-Lang-governed AI Agent Skill.
The owner corrected the previous local-first design on 2026-09-06.
Users must not need their own computer/server, Go/Node, daemon, or database.
The agent host provides tools, connectors, permission enforcement, secret
storage, durable execution records, and optional scheduling.

Develop from official API contracts, conditional intake and multi-scenario
agent evaluations. Do not gate product work on the author's personal account
or call one successful integration proof of correctness for all users.

Read `AGENTS.md`, `docs/AGENT_ONBOARDING_v3_2026-09-06.md`, and
`docs/PROJECT_MEMORY_v1_2026-09-06.md` before work.

## Layout and status

- `skills/adspilot/`: the product. Text and manifest only, no install commands.
- `scripts/verify-agent-package.mjs`, `scripts/verify-ilang.py`,
  `tests/agent-package/`: developer checks, not host runtime dependencies.
- `services/adscenter`: optional legacy Google Ads adapter, default and live
  compile/unit gates. Unsupported writes are explicitly disabled.
- `services/affiliate`: optional provider library, not a runnable server.
- Other Go modules, frontend, local OAuth and deployment scripts: frozen
  historical assets, retained without claiming production readiness.
- `specs/openapi/*.yaml`: canonical legacy OpenAPI schemas;
  `services/*/internal/oapi`: generated code.

## Verification

Primary checks need Node 22+ and Python 3.12+ only for contributors:
`node scripts/verify-agent-package.mjs`,
`node --test tests/agent-package/*.test.mjs scripts/verify-go.test.mjs`,
`python scripts/verify-ilang.py`.

Optional adapters: `node scripts/verify-go.mjs` (Go 1.25.14 in CI).
Complete inventory: `node scripts/verify-go.mjs --inventory-only`.
Modules use `GOWORK=off`, `GOTOOLCHAIN=local`, `-mod=readonly`.
Never run `go mod tidy` as verification or claim root `go build ./...` proves
the monorepo works. Node/Go/Python here are developer tools only.

## Safety and traps

- Existing module imports retain `github.com/ScientificInternet/Google-Monetize`.
  Do not rename them merely to match the GitHub repository owner.
- Never serialize credentials into shared Redis/Valkey caches, logs, prompts,
  artifacts, or source. Prefer opaque host-held grants for the agent product.
- Target customer CID and manager/login CID are different.
- Reuse valid scoped authorization; don't confuse repository access with Ads
  account mutation authority.
- Validation, planning, queued state and HTTP 501 are not live completion.
- A create timeout is unknown outcome, not permission to retry.
- Follow pinned official I-Lang; custom domain data is not a new verb.
- Preserve unrelated changes, record verified milestones and recovery state.
