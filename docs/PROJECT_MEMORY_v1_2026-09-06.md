# AdsPilot project memory v1 — 2026-09-06

## Current state

- 2026-09-07 owner requested completing P0/P1 together for unified acceptance
  (latest wording repeats P0; interpreted using the earlier explicit P0/P1).
  Current head is `2ad4f3bbc33a416a18378c393787e061b95474bd`; branch clean at
  resumption. v0.2 CI run `34036354947` passed six jobs in the prior receipt.
- New iteration recovery: root owns scope/host operation contract, acceptance
  integration, packaging and delivery; delegated isolated work will cover
  Google workflow contracts/tests, affiliate reconciliation/contracts/tests,
  and residual active-adapter P0 safety. All test execution must use synthetic
  data or local mock HTTP, not real advertising accounts. No user infrastructure
  or account credentials are needed to continue development.
- Host operation registry implemented: 15 stable logical operations and two
  transport shapes, per-session/schema/account evidence, missing-only readiness
  and non-executable capability receipts. Twelve fixture tests passed. Unified
  non-installing developer release command implemented; five failure tests pass.
- Active-adapter agent will run bounded local fake-transport Go tests, then
  whole AdsCenter default/live tests/builds. Recovery in services/adscenter:
  GOWORK=off, GOTOOLCHAIN=local, GOMAXPROCS=2; portable go1.25.14 `go test
  -mod=readonly -p 2 ./internal/ads ./internal/config ./internal/api
  ./internal/executor`, repeat with `-tags ads_live`; then `./...` and builds.
  No provider calls or persistent application server are authorized by this.
- Focused default/live adapter checks completed in sessions 82074/2104;
  full default passed in 77131. Final live tests and two builds are being
  recovered by `active_adapter_p0_v3` in session 15698. Do not run a competing
  full Go suite while that process is active.
- Adapter milestone completed: session 15698 exited successfully; final default
  and ads_live module tests each pass 19 packages (nine with tests), both builds
  pass. Fourteen new regression functions plus table cases cover secret-source
  identity/failure, safe errors/redirects, exact request paths, keyword paging/
  nullable metrics, truthful validation and direct-account/preflight caching.
  Source frozen, manifests unchanged, no adapter process remains.
- Integrated development checkpoint: Node suite passed 116/116 before the
  final independent review additions. Final release totals will be recorded
  after both workflow agents freeze their sources; no universal live claim.
- Workflow sources frozen: Google slice 36/36, affiliate slice 37/37 and both
  contract CLIs passed. CJ synthetic loop computes USD commission 11.3333 and
  sale 110 against cost 12; the outcome is a proposal, not executed optimization.
- Root final adapter serialization correction preserves nullable search counts
  as JSON decimal strings (including values above JavaScript exact integers).
  Focused default/live ads package test recovery session: 98500. Prior full
  adapter results precede this serialization-only change; final CI will rerun.
- Independent forward Agent `acceptance_forward_v3` is evaluating five raw
  synthetic cases without developer evaluator/test answers. Final acceptance
  report must distinguish its actual outputs from deterministic fixtures.
- Independent forward evaluation completed: all five raw scenarios exhibited
  expected task boundaries and exact calculations; see
  `docs/AGENT_EVALUATION_v3_2026-09-07.md`. No live calls or fabricated tool
  results. All workflow/evaluation agents have completed, no agent work remains.
- Focused final keyword JSON serialization tests passed default/live in session
  98500. The nullable/string fix is now included in the final release run.
- Final integrated release recovery command (root): `node scripts/verify-release.mjs
  --python C:\Users\Administrator\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe
  --ilang-cache C:\Users\Administrator\.cache\adspilot-development\ilang-f81e2bf
  --adapters --go C:\Users\Administrator\.cache\adspilot-development\go1.25.14\go\bin\go.exe`.
  This tests/builds only declared active surfaces and performs no provider calls.
- Final unified run is active in local exec session 26378; primary package,
  all Node cases and strict I-Lang/Python checks have returned successfully;
  the optional adapter phase follows. Recover via that session or the exact
  command above if the desktop session is lost.
- Final milestone: unified release session 26378 completed exit 0, all six
  selected check groups passed with none skipped. Node 129/129; Python 4/4;
  pinned I-Lang ten docs zero errors/warnings, judge14/14, fixtures6/6.
  Final AdsCenter default/live each19packages and both builds passed; optional
  Affiliate library builds (no Go test files). All local processes are complete.
- v0.3 instruction-only ZIP built and integrity/inventory verified: 16 files,
  `dist/adspilot-agent-v0.3.0-2026-09-06.zip` (UTC archive date), SHA256
  `c2effa3845022a5ab3ea7570441a18eb93fbe81b06baf7fcb98638e3a6cac393`.
  v0.1/v0.2 original hashes rechecked unchanged. No product source edits after
  package construction; only receipt/documentation updates are allowed before
  this delivery unless the package is explicitly re-versioned/reverified.
- P0/P1 agent-product engineering acceptance is mapped in v4; remaining
  real-host/provider acceptance is explicit and separate, not an account gate
  to further development. Publish on existing draft PR2 without main merge;
  exact commit/tree and CI recovery go in `dist/DELIVERY_RECEIPT_v3_2026-09-07.md`.
- Official current conversion contract check: new integrations cannot assume
  legacy UploadClickConversions eligibility after 2026-06-15; prefer documented
  Data Manager, which has a different credential/result/diagnostics model.
  CJ original and distinct correction rows are additive deltas, not overwrite
  by order ID. These findings are implemented in the affiliate slice/tests.
- Completion must map each original P0/P1 item to the owner-corrected agent
  architecture and evidence. Provider/host live acceptance remains separately
  labelled; do not count unsupported HTTP 501 or invented API fields as working
  integration. Preserve frozen historical modules and existing deliverables.

- Latest owner correction: stop treating their account as the development gate.
  v0.2 work now defines Google-official-doc-driven conditional user submissions,
  AI onboarding/repair, and multi-account/error scenario acceptance. Personal
  account success is only a sample, not a correctness proof. No live credentials
  are required for this development or offline evaluation.
- Recovery for this iteration: root owns intake/entrypoint/docs/packaging;
  `google_requirements_v2` researches official auth/access requirements;
  `google_recovery_v2` owns recovery catalog and troubleshooting reference.
  No background product service or live Google account mutation is involved.
- Verified documentation milestones: integration-owned credentials vs user
  grants, four API access levels including Explorer planning restrictions,
  client/MCC hierarchy, Cloud-managed pilot exception, host-managed OAuth/
  service identity routes, and account-independent testing limits. Sources are
  linked from the packaged onboarding and recovery references.
- v0.2 intake/route contract and onboarding reference implemented. Recovery
  agent delivered 31 rules with 88 typed codes, explicit actors, retry/stop
  policies and official sources. Contract validation passes four routes/31 rules;
  final Node checks pass 37/37, including 21 new onboarding/recovery cases.
- Independent Agent forward simulation completed four raw cases: native
  consent, planning/configuration failure, unknown creation outcome, and changed
  account/currency. Expected boundaries were observed; see
  `docs/AGENT_EVALUATION_v2_2026-09-06.md`. These are actual simulated Agent
  outputs, distinct from deterministic tests and not live Google certification.
  All subagent work is complete; no background local task remains.
- Final v0.2 local verification passed: Node 37/37; Python failure-handling
  tests 4/4; strict pinned I-Lang syntax zero errors/warnings in nine files,
  judge selftest 14/14 and fixtures 6/6; Skill quick validation; inventory
  36 modules/seven exclusions; diff check. This iteration changes no Go code.
- v0.2 dated ZIP built and integrity/inventory verified (12 instruction/data
  files): `dist/adspilot-agent-v0.2.0-2026-09-06.zip`, SHA256
  `d452ec20bd31efc7e7a3c942e27f2f8d25eb6be1eda33b149c5e967b922d8a59`.
  The v0.1 ZIP was retained and its original SHA256 rechecked unchanged.
- v0.2 publication recovery: deliver the verified index to the existing review
  branch/PR #2; never overwrite a changed remote head or merge main. The local
  dated receipt `dist/DELIVERY_RECEIPT_v2_2026-09-06.md` records the publication
  commit, hosted run ID/status and next command as they become available.

- 2026-09-06 owner correction: agent-native, instruction-only installation and
  use; no user-managed computer/server/runtime. Follow I-Lang at ilang.ai.
- P0 and P1 implementation authorized. Active branch:
  `codex/agent-native-p0-p1-2026-09-06`. Prior install/implementation permission
  questions are superseded for normal development work in this scope.
- Recovery: read this file and `git status`; implementation is split into
  isolated credential/success fixes, verification/CI, and agent skill/protocol.
  Any developer-only runtime downloads are separate from product dependencies.

- Repository: `https://github.com/adsorgcn/AdsPilot`
- Local checkout: `C:\Users\Administrator\Documents\AdsPilot`
- Default branch: `main`
- Intake commit: `c52cbfdf1f7f843cdfbd7e40f960140f7e269229`
- GitHub access verified through the connected `adsorgcn` account with repository `admin` and `push` permission.
- Checkout completed successfully; working tree was clean immediately after clone.
- The current Codex task is renamed `AdsPilot 主力项目接管` and pinned for ongoing work.
- Repository-level Codex guidance was added in `AGENTS.md`.
- The verified intake and prioritized backlog were recorded in
  `docs/TAKEOVER_ROADMAP_v1_2026-09-06.md`.
- Intake found no open GitHub issues or pull requests; the existing remote topic
  branches are already merged into `main`.
- P0 intake findings include an implicit stub execution path, sunset Google Ads
  API v16 endpoints, queued or write-shaped paths that can report success
  without verified execution, broken/incomplete verification gates, and
  refresh-token serialization into a Redis-capable shared cache. See the
  takeover roadmap for remediation and acceptance criteria.

## Recovery

Resume from the local checkout above. Before changing code, read `CLAUDE.md`, the root README, package manifests, and any task-specific instructions. Re-run `git status --short --branch` and compare `HEAD` with the intake commit.

## Intake completed

- Architecture, unfinished-work, quality, and live Google Ads path reviews were
  completed as read-only audits.
- `git diff --check` and syntax checks for the tracked JavaScript entry files
  passed. Go tests/builds, npm install/typecheck/lint/build/tests, Docker build,
  and Gitleaks were not run because their local tooling or dependencies are
  absent.
- No repository `.env`, local AdsPilot credential file, or relevant Google Ads
  environment variables were present. Presence was checked without reading any
  secret value.
- No background audit process remains to recover. Resume with P0.1 in the
  takeover roadmap; the first recommended change is a truthful developer and CI
  baseline that requires no production credentials.

## Pending decisions

- Current plan is `docs/P0_P1_ACCEPTANCE_v4_2026-09-07.md`; v1/v2/v3 retain history.
- Normal development/tooling work is authorized. Deliver on the active review
  branch; do not merge unverified changes to main.
- Whether the legacy SaaS frontend/services should be archived or retained as a
  separately supported product surface. Current default: retain frozen assets.
- Authorization and safe account scope for any future live Google Ads test.
  This applies only to optional provider integration tests, never as a gate for
  official-contract-driven development, onboarding design or offline evaluation.

## Implementation milestones

- Agent instruction package v0.1.0 created, no executable/dependency/service
  payload. Host tools supply all production execution and secret storage.
- Official I-Lang specification pinned to
  `f81e2bf1a952563ede3d45b814bb4a8482ba38cd`; v5 merged document 2.0.1,
  frozen M1-M8/ine serialization, L1 advisory boundary explicitly documented.
- Official strict syntax check passed with zero errors/warnings; judgment
  selftest 14/14 and mode fixtures 6/6. Skill-creator quick validation passed.
- Primary structure/regression suite and module verifier tests passed 14/14.
- Go module inventory maps 36 modules and seven explicit orphan-source
  exclusions. Verification is readonly and does not run tidy/sync.
- Credential cache uses process-local memory, never shared Redis/Valkey;
  credential config tests passed, including no network connection to cache.
- AdsCenter focused default/live tests passed. Full final checks are tracked in
  `IMPLEMENTATION_STATE_v1_2026-09-06.md`; no real provider claim is made.
- Affiliate library tests/build passed; it is not a runnable service or a
  completed CJ connector. No live advertising requests were performed.
- Three independent Skill scenario reviews passed expected boundaries;
  clarified standing grants vs plan approvals and missing host capability rows.
- Current session tool discovery found no Google Ads/CJ execution connector;
  plugin search tools are not exposed either. This is a current-host dependency,
  not proof no compatible integrations exist. Live account acceptance remains
  pending; do not request plaintext tokens or a user-hosted replacement server.
- README/README.en/CLAUDE/AGENTS now describe agent-native use; old local-first
  roadmap and handoff carry superseded notices.
- Final protocol pin review added a single approved revision/hash configuration,
  rejecting profile drift and empty fixtures: Node 16/16, Python 4/4 passed;
  upstream grammar/judge checks passed again.
- Versioned instruction-only ZIP built and integrity checked (8 files):
  `dist/adspilot-agent-v0.1.0-2026-09-06.zip`, SHA256
  `cf45c645a89457cb71781e6d3513119d8df366eeba2e7bb1443871f11df7b710`.
  This ignored local delivery file must not be silently overwritten; CI packages
  the same versioned source as a workflow artifact.
- OAuth routes are now restricted to validated local-loopback requests with
  Host/Origin/Fetch-Metadata checks; callback retains state+PKCE protections.
  Provider revocation and local credential deletion now have separate results;
  network/rejection cannot claim revocation. Final full tests cover this patch.
- Local account snapshots bypass shared cache to avoid fixed `local` identity
  collisions or stale account lists after OAuth changes. Non-local historical
  cache invalidation, token encryption-variable naming, and tenant ownership
  remain audit items before any separately authorized legacy deployment.
- Final stable AdsCenter verification passed: default and ads_live, each 19
  packages (9 with tests, 10 without), plus both builds. The final two-line
  local-cache guard received API retests and both builds. No Go manifest drift.
- All local development/test sessions ended; no application/background server
  was started. Review branch publication and remote CI are separate milestones.

## GitHub delivery

- Review branch published: `codex/agent-native-p0-p1-2026-09-06`.
- Implementation commit: `1ef0f22ea1b5e9896ddc50b528336d27ef612e7a`.
- Draft PR: https://github.com/adsorgcn/AdsPilot/pull/2 — not merged.
- GitHub tree matches the verified local index exactly:
  `14c49b2d0ef6196115602605a8923f280661f6fd`.
- Remote verification run `34031924587` was in progress at first observation;
  this is not a green-CI claim. Recheck the PR checks or its Actions run before
  merge. CI continuation is hosted by GitHub, not a local background task.
- Subsequent v0.1 receipt commit `6ad161b5fc23c30ec96d6ef727e0b9086a5c855e`
  has a completed successful run `34032021277`, rechecked before v0.2 delivery.
  This historical success does not establish the new v0.2 commit's CI outcome.
