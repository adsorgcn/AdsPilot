# AdsPilot project memory v1 — 2026-09-06

## Current state

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

- Current plan is `docs/AGENT_ONBOARDING_v3_2026-09-06.md`; v1/v2 retain history.
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
