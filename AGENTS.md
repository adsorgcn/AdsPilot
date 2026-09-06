# AdsPilot repository instructions

## Mission

AdsPilot is an agent-native Google Ads automation skill governed by I-Lang
(https://ilang.ai/spec/). The owner clarified on 2026-09-06 that installation
and use must happen inside an AI agent: no user-managed computer, server,
daemon, Go/Node installation, or database is a product prerequisite. The agent
host supplies tools, authorized connectors, secret storage, and execution.
`services/adscenter` is a legacy optional adapter, not the required runtime.
The newest owner instruction overrides the previous local-first roadmap.

Owner clarification (2026-09-06): development must be documentation-driven and
account-independent. Build conditional user intake, agent-led setup/repair, and
multi-scenario evaluations from Google's official contracts. A working owner
account is one optional integration observation, never a product acceptance
criterion or a prerequisite to continue design/development. Missing credentials
in the development session do not justify stopping this work.

## Start here

Before changing code, read these files in order:

1. `CLAUDE.md`
2. `docs/P0_P1_ACCEPTANCE_v4_2026-09-07.md`
3. `docs/PROJECT_MEMORY_v1_2026-09-06.md`
4. The README and module-specific README for the area being changed

Treat the v4 acceptance plan as the current engineering baseline. When a claim in
older documentation conflicts with executable code or a current test, prefer
the verified code/test result and update the stale documentation in the same
change.

## Development priorities

1. Keep build, test, and CI results truthful and reproducible.
2. Deliver the instruction-only I-Lang skill and real Google Ads read workflows
   through capabilities already supplied by the agent host.
3. Put every live write behind validation, explicit approval, idempotency, and
   an auditable result.
4. Keep the skill independent of AdsCenter and adapt to discovered host tools.
5. Defer affiliate expansion, traffic/anti-fraud, and browser isolation until
   the Google Ads golden path is proven.

## Verification rules

- This repository is a multi-module Go workspace. Do not use a root
  `go build ./...` as proof that the backend works.
- Verify active adapters using `node scripts/verify-go.mjs`; it uses
  `GOWORK=off` and `-mod=readonly`, and never tidy/syncs manifests.
- Use `node scripts/verify-agent-package.mjs` and `python scripts/verify-ilang.py`
  for the primary instruction-only product.
- Do not report frontend tests as passing until a real frontend test script and
  runner exist.
- A stub response, synthetic ID, HTTP 501, or validate-only response is not a
  successful live Google Ads operation.
- Record commands actually run, commands blocked by missing tooling or
  credentials, and their outcomes separately.

## External-action safety

- Never print, commit, or copy OAuth refresh tokens, developer tokens, client
  secrets, API keys, or account credentials into logs or documentation.
- Never place Google Ads credentials or refresh tokens in the shared
  `pkg/cache` layer, because that layer can be backed by Redis/Valkey. Secret
  material must remain in the protected host secret store; the optional legacy
  adapter may use its local credential store and a process-local secret cache.
- Repository write access does not authorize changing a live Google Ads
  account. Require explicit user authorization for the concrete account and
  mutation.
- New campaign and mutation flows must default to validation/dry-run. The first
  live campaign created in an end-to-end test must be paused and use a bounded
  budget.
- Never silently fall back from live mode to a stub. Surface the active mode in
  startup logs and API health output, and fail closed when live mode is
  requested but unavailable.

## Change discipline

- Preserve unrelated user changes and keep commits focused.
- Use versioned, dated names for takeover reports and other durable delivery
  artifacts.
- Update `docs/PROJECT_MEMORY_v1_2026-09-06.md` immediately after a verified
  milestone, and leave recovery commands for interrupted long-running work.
- Keep generated OpenAPI mirrors synchronized with the canonical specs, and do
  not edit generated files without updating their source.
