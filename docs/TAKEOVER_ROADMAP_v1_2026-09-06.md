# AdsPilot takeover audit and development roadmap v1 — 2026-09-06

> Historical intake snapshot. The local-first product decision below was
> superseded by the owner on 2026-09-06. Use
> [Agent-native roadmap v2](AGENT_NATIVE_ROADMAP_v2_2026-09-06.md) for current work.

## Executive decision

AdsPilot is now treated as the primary development project, with the current
working product definition:

> A local, single-operator AI agent that can connect to Google Ads, inspect an
> account, research keywords, propose a change, validate it, obtain explicit
> approval, execute it safely, and return an auditable result.

The repository contains useful foundations, but it is not yet a working
end-to-end product. The immediate goal is to make the Google Ads golden path
real and measurable. Hosted SaaS concerns, the legacy dashboard, browser
isolation, traffic/anti-fraud, and broad affiliate-network support are deferred
until that path is proven.

## Intake baseline

- Repository: `https://github.com/adsorgcn/AdsPilot`
- Local checkout: `C:\Users\Administrator\Documents\AdsPilot`
- Baseline branch/commit: `main` at
  `c52cbfdf1f7f843cdfbd7e40f960140f7e269229`
- GitHub access: connected account has repository `admin` and `push` permission.
- GitHub backlog at intake: no open issues and no open pull requests.
- Remote feature branches are already ancestors of `main`.
- No repository `.env`, local `~/.adspilot/credentials.json`, or relevant
  Google Ads environment variables were present during intake. Only presence
  was checked; no secret values were read.
- No source code was changed during this intake. The durable takeover files are
  new, local, uncommitted files until the owner approves committing them.

## What exists today

| Area | Intended role | Verified reality |
| --- | --- | --- |
| `services/adscenter` | Google Ads core, OAuth, planning, execution | Strongest module, but default launch uses stubs; live code is build-tagged, calls API v16, and several public handlers return 501 or placeholders. |
| `services/aicore` | AI control plane | A generic model `/complete` proxy; it does not orchestrate AdsCenter tools or implement an agent loop. |
| `services/affiliate` | Affiliate data, links, commissions, sub-IDs | Phase-0 skeleton. CJ deep links exist; advertiser, product, and commission network calls are unimplemented. |
| Supporting Go services | BFF, console, projector, recommendations, ranking, activity, gateway | A mixture of reusable packages and older cloud/SaaS paths; several contracts reference removed or mismatched services. |
| `apps/frontend` | Historical web UI | Large legacy Next.js surface with login, billing, Supabase, and admin concepts that conflict with the current headless/local-first product direction. |
| OpenClaw/agent packaging | Primary user-facing distribution promised by README | Documentation mentions it, but the repository has no `SKILL.md`, MCP surface, or OpenClaw implementation. |

## Verified gaps

### P0 — current claims are not operationally true

1. **Default local execution is a stub.** Both local development scripts and the
   root npm script launch AdsCenter without the `ads_live` build tag. The real
   client and executor are guarded by `//go:build ads_live`; the default client
   returns empty or synthetic results and the default executor reports stub
   success.
2. **The live client targets a sunset API.** AdsCenter hard-codes Google Ads API
   `v16` across read and mutation URLs. Google sunset v16 on 2025-02-05, after
   which its requests fail. As of the intake date, Google's released versions
   are v22 through v25.
3. **The end-to-end Ads flow is incomplete.** Account management, campaign
   creation/reporting, configuration, synchronization, and related handlers
   include multiple HTTP 501 responses or simplified placeholder logic.
4. **The documented keyword capability is not wired to Google.** The public
   keyword expansion route performs local rule-based expansion; the live
   `KeywordIdeas` implementation is not called by that route.
5. **Build/test confidence is overstated.** The CI workflow is manual-only and
   checks only part of the Go workspace. It does not build the backend or verify
   the frontend. The root frontend test script calls a nonexistent frontend
   `test` script.
6. **This workstation cannot reproduce the claimed green build yet.** Node
   `v24.19.0` is available, but npm, Go, Bash, Docker, and Gitleaks were not
   available on PATH, and dependencies are not installed. Static JavaScript
   syntax checks passed; Go and npm verification were not run.
7. **Credential locality has a configuration-dependent breach.** AdsCenter
   serializes the full credential object, including the refresh token, into the
   generic cache. That cache writes through to Redis/Valkey whenever either
   backing URL is configured. Local mode normally stays in memory, but this
   behavior conflicts with the promise that tokens remain only in the local
   credential store. A second legacy path still reads refresh tokens from the
   database, so credential ownership is not yet singular.
8. **Some write-shaped paths report success without performing the work.** Bulk
   requests can remain queued without an execution worker, while stub
   mutations, budget-transfer, diagnostic-execution, and rollback paths contain
   success/completed responses that do not prove a Google-side change. These
   must become explicit unsupported/dry-run results until real execution and
   read-back verification exist.

### P1 — product and repository boundaries are unclear

- The README promises OpenClaw delivery, but no agent-facing implementation
  exists and `aicore` is not connected to AdsCenter.
- The current `go.work` omits some modules; several source directories are not
  owned by any Go module, so existing CI cannot see all code.
- Module paths and many imports still use
  `github.com/ScientificInternet/Google-Monetize`, not the current repository
  identity.
- The frontend has conflicting Next.js configuration files, no automated test
  suite, and extensive stale SaaS dependencies and endpoints.
- Generator scripts and endpoint maps still reference removed cloud-era
  services.
- Documentation disagrees about root Go builds, active modules, security
  workflows, product UI, and what has actually been verified.

### P2 — promised breadth is mostly future work

- CJ advertiser lookup, product search, and commission import are not wired.
- Durable sub-ID storage, reconciliation, and offline conversion feedback are
  not production-ready.
- Traffic ingestion, anti-fraud, and browser-pool provider layers described in
  the README are not implemented as product modules.

## Delivery roadmap

### P0.1 — make the repository truthfully verifiable

Deliver a clean-machine, non-mutating verification path before feature work.

- Pin and bootstrap the supported local toolchain: Go 1.25.1 and a Node/npm
  combination compatible with `packageManager: npm@10.8.2`.
- Replace or wrap Bash-only local verification with a Windows-friendly command.
- Fix root test scripts, the backend module test strategy, conflicting frontend
  configuration, lockfile drift, and the frontend Docker install path.
- Decide which modules are active. Every tracked source file must either belong
  to an active verified module or be explicitly archived/removed.
- Make CI run automatically on pull requests and `main` pushes. Gate merges on
  formatting, module tests, backend builds, frontend install/typecheck/lint/build,
  secret scanning, and at least a smoke test.
- Add checks for actual executable entrypoints and container targets; compiling
  a directory that contains only library packages must not count as a runnable
  service passing.

Acceptance:

- One documented command exits nonzero on failure and does not rewrite
  `go.mod`, `go.sum`, or lockfiles.
- The same checks run automatically on pull requests.
- A clean checkout produces a recorded green baseline, or each remaining
  failure has a tracked issue and owner.

### P0.2 — establish an explicit real Google Ads read path

- Upgrade all Google Ads REST endpoints from v16 to a currently supported
  version, targeting v25 after reviewing breaking changes.
- Replace implicit build-tag behavior with an explicit runtime mode such as
  `stub`, `validate`, or `live`. Never silently report stub results as live.
- Move secret caching out of the generic Redis-capable cache and establish the
  local credential store as the single source of truth for local mode. Cache
  only non-secret metadata or use a process-local secret cache.
- Expose the active mode and API version in health/status output.
- Wire loopback OAuth and the local credential store into a real sequence:
  token refresh, accessible-customer listing, account selection, campaign read,
  and Google Keyword Ideas.
- Keep the manager/login customer ID separate from the target customer ID. The
  former belongs only in the request header; every read or mutation must name
  the authorized target account explicitly.
- Add contract tests with fake HTTP servers and a credential-gated integration
  test that never prints secrets.

Acceptance:

- Live mode fails closed when required credentials are missing.
- Configuring Redis/Valkey cannot cause a refresh token or client secret to be
  written to that shared cache.
- A real test account can complete OAuth, list accessible accounts, read
  campaigns, and obtain keyword ideas.
- Logs and responses distinguish real, stub, cached, and validate-only data.

### P0.3 — complete one safe write golden path

- Implement a narrow Search campaign flow before broad mutation coverage.
- Generate a deterministic plan; validate it with Google using validate-only;
  require explicit approval; execute idempotently; then read back and report the
  created resources.
- Create the first live campaign paused, with a bounded budget.
- Persist the request, approval, Google operation IDs, partial failures, and
  final result. Make retries safe.
- Implement or deliberately remove the queued bulk worker surface; no queued
  operation may be presented as completed before execution and read-back.
- Replace placeholder validation, rollback, and execution-report behavior for
  this golden path.

Acceptance:

- An authorized test account can create one paused Search campaign from an
  agent-generated plan without duplicate resources on retry.
- The operator can see exactly what was proposed, validated, approved,
  executed, and verified.

### P1.1 — ship the actual agent product surface

- Define a small stable tool contract: auth status, accounts, campaign summary,
  keyword ideas, draft plan, validate plan, approve/execute, and execution
  status.
- Package that contract as the promised OpenClaw skill, while keeping the core
  transport-neutral so an MCP or CLI adapter can reuse it.
- Connect AI reasoning to typed AdsCenter operations rather than free-form HTTP
  or a generic completion proxy.
- Add adversarial tests for prompt injection, account confusion, excessive
  budgets, duplicate approvals, and unsupported mutations.

### P1.2 — complete the affiliate feedback loop

- Implement CJ advertiser, product, and commission APIs.
- Replace the temporary file mapping with durable, queryable sub-ID storage.
- Add deterministic link generation, click/conversion reconciliation, and
  offline conversion upload with privacy and deduplication controls.
- Prove one affiliate-network-to-Google-Ads optimization loop before adding
  more providers.

### P1.3 — remove architectural ambiguity

- Archive or remove cloud-era login, billing, Supabase, admin dashboard, and
  dead service contracts that are outside the chosen local product.
- Normalize module/import paths to the current repository identity.
- Regenerate OpenAPI clients only from canonical live specs.
- Rewrite README/HANDOFF/security documentation from executable facts.

### P2 — expand only after the core loop is measured

- Traffic ingestion and attribution quality.
- Anti-fraud signals and policy actions.
- Browser/profile isolation for explicitly justified workflows.
- Additional affiliate networks, campaign types, and optimization strategies.

## Proposed first three pull requests

1. **PR 1 — truthful developer baseline:** reproducible toolchain notes,
   non-mutating verification command, repaired npm scripts, automatic CI, and an
   explicit active-module inventory. No credentials required.
2. **PR 2 — explicit live read path:** Google Ads v25 migration, explicit
   runtime mode, health metadata, and contract tests. No live account mutation.
3. **PR 3 — credential-gated golden path:** real OAuth/read/keyword integration
   test, followed by validate-only and a paused Search campaign on an authorized
   test account.

PR 1 can start immediately. PR 2 can be implemented and unit-tested without
credentials. PR 3 requires the owner to provide or authorize use of a Google Ads
OAuth client, developer token, login customer ID where applicable, and a safe
test account; secrets must stay outside Git.

## Backlog tracking recommendation

The repository had no open issues at intake. After the roadmap is approved,
create one milestone for each P0 stage and convert the bullets above into small,
acceptance-tested GitHub issues. Do not use README status tables as the backlog.
