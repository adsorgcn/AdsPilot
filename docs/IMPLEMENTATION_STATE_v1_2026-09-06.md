# P0/P1 implementation state — 2026-09-06

Owner requirement: agent-native, instruction-only installation and use;
I-Lang protocol; no user-maintained computer/server or AdsPilot daemon.

Branch: `codex/agent-native-p0-p1-2026-09-06`.

## Completed implementation workstreams

- Root: I-Lang specification review, Agent Skill, host capability contract,
  product documentation, integration/review.
- `credential_p0`: process-local credential cache and correct account targeting.
- `truthful_execution_p0`: remove fake completion and update optional adapter.
- `verification_p0`: non-mutating module inventory/verification and PR CI.

## Developer runtime recovery

Portable Go download (development only, not a product requirement):

- Archive: `C:\Users\Administrator\.cache\adspilot-development\go1.25.14.windows-amd64.zip`
- Source: `https://go.dev/dl/go1.25.14.windows-amd64.zip`
- Expected SHA256: `119044a92b3987c341cd6aebb256676dd4780d292f7b4e72a3e9976677841697`
- Executable after extraction:
  `C:\Users\Administrator\.cache\adspilot-development\go1.25.14\go\bin\go.exe`
- Recovery: check archive hash, extract it if the executable is absent, then
  rerun module verification. Do not redownload a valid archive or modify PATH
  globally. Each developer command sets its own process PATH when needed.

## Verified milestones

- Portable Go SHA256 and version verified; runtime is available for development.
- Primary skill package structure and seven regression tests passed.
- Official pinned I-Lang strict grammar check: zero errors and warnings.
- Official judgment self-test: 14/14; AdsPilot schema/mode fixtures: 6/6.
- Non-mutating Go inventory/regression tests: seven passed, 36 modules mapped.
- Credential config suite passed, including no Redis/Valkey connection.
- AdsCenter default focused suites passed; Affiliate library tests/build passed.
- Independent skill scenario review covered missing tools, changed budget and
  unknown create outcome; scope wording and host capability table clarified.
- Final package suite: Node 16/16, Python 4/4; protocol source/profile drift and
  empty fixtures are rejected. Official upstream checks remain passing.
- Eight-file ZIP packaged and checked: `dist/adspilot-agent-v0.1.0-2026-09-06.zip`;
  SHA256 `cf45c645a89457cb71781e6d3513119d8df366eeba2e7bb1443871f11df7b710`.
- OAuth route exposure/revocation truth repairs and regression tests are now
  implemented; final stable full-module tests are in progress.

## Final local verification and recovery

OAuth/server stable full checks passed in session 5191 (19 packages,
9 with tests/10 without, default and ads_live; both builds). Final local-cache
guard verification passed in session 75685: API default 4.691s, live 4.464s,
both whole-module builds passed again. All local Go sessions are complete.

Reproduce with `node scripts/verify-go.mjs --module services/adscenter` with
portable Go on PATH. Actual stable checks used `GOWORK=off GOTOOLCHAIN=local
GOMAXPROCS=2`, `go test -p 2 -mod=readonly -count=1 -timeout=120s ./...`
and the same with `-tags ads_live`, plus both `go build` variants.
Build output directory: `C:\Users\Administrator\.cache\adspilot-development\builds\p0-v1-2026-09-06`.

Go manifests have no diff. Staged diff/check and narrow secret-pattern heuristic
passed; full Gitleaks was not run locally and remains a CI gate. No whole-repo
or frontend test claim is made.

All other agent tasks and their tool processes have completed. No local
background server or advertising process is running from this work.

## Remaining acceptance

- Review branch published as draft PR https://github.com/adsorgcn/AdsPilot/pull/2
  at implementation commit `1ef0f22ea1b5e9896ddc50b528336d27ef612e7a`.
  Observe remote CI separately from local tests (initial run `34031924587`
  in progress). Main is unchanged; no merge performed.
- Bind actual Google Ads/CJ host connectors and authorized account scope.
- Prove real reads, one bounded paused campaign, and affiliate reconciliation.
- Retained legacy non-local deployment requires a separate security/ownership
  audit before public use. Full P0/P1 and live provider connectivity are not
  claimed complete merely because urgent containment and the skill pass tests.
