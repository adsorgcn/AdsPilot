# Developer verification

The installable AdsPilot product is an instruction-only I-Lang agent skill.
These repository maintenance commands are for contributors, not installation
prerequisites for the user or agent host.

## Primary package checks

Node 22+ is sufficient; `npm install` is not needed:

```sh
node scripts/verify-agent-package.mjs
node scripts/verify-go.mjs --inventory-only
node --test tests/agent-package/*.test.mjs scripts/verify-go.test.mjs
```

With Python 3.12+ (standard library only), `python scripts/verify-ilang.py`
fetches and verifies the pinned upstream I-Lang grammar and judgment validators.
The manifest and instruction profile must match the approved revision in
`config/ilang-validator-pin.json`; validation also rejects empty judgment
fixtures. Its offline regression checks are
`python -B -m unittest discover -s tests/agent-package -p "test_*.py"`.
`python scripts/package-agent.py` creates a versioned, dated instruction-only
ZIP under `dist/`. CI runs both and retains the packaged skill as an artifact.
These Python commands are contributor tools, not agent installation steps.

`npm test` runs skill validation and verifier tests when npm is available.
CI runs those checks on Windows and Linux for every PR and push to `main`.
The frozen frontend is not a product gate and has no automated test runner.

## Optional legacy Go adapters

Go 1.25.1+ is needed only when maintaining legacy adapters:

```sh
node scripts/verify-go.mjs
node scripts/verify-go.mjs --module services/adscenter --tags ads_live --test
node scripts/verify-go.mjs --scope libraries --test
node scripts/verify-go.mjs --scope all --list
node scripts/verify-go.mjs --scope services --build
node scripts/verify-go.mjs --module services/affiliate --format
```

The default checks `services/adscenter` with both default and `ads_live` build
tags, plus `services/affiliate`. Tests use a 120-second per-package timeout and
exclude the `integration` tag. These are compile/unit checks, not proof of a
real Google Ads operation. `--go` or `ADSPILOT_GO` can name a portable Go binary.

CI pins Go 1.25.14. Each module runs with `GOWORK=off`, `GOTOOLCHAIN=local`, and `-mod=readonly`.
No tidy/sync command runs; missing checksums or manifest drift fail visibly.
Dependencies may download to Go's external module cache. Build artifacts go to
a unique temporary directory and are removed at the end. All repository Go
manifests are hashed before/after; any change fails and is left for inspection.
Library-only modules are identified as such and never reported as runnable
services. `--format` compares gofmt output without modifying files and ignores
Git's Windows-versus-Unix line-ending conversion.

The complete inventory is `config/go-module-inventory.json`: 36 modules and
explicit exclusions for source without a module. Discovery does not rely on
the incomplete historical `go.work`. A new/unlisted module, unowned source, or
stale exclusion fails inventory validation. `--scope all` opts into frozen
legacy modules; their unresolved failures are not hidden or claimed as green.

CI tests/builds optional adapters on Windows and Linux whenever their source,
shared libraries, verifier, inventory, or workflow changes. A manual workflow
run can request the same checks. The remaining legacy services, frontend, and
tools are retained but frozen, and are not skill runtime dependencies.

## Historical maintenance scripts

| Script | Scope |
| --- | --- |
| `verify-build.sh` | Bash compatibility wrapper for `verify-go.mjs --scope services --build`; no tidy |
| `dev-local.ps1` / `dev-local.sh` | Optional legacy AdsCenter development only |
| `check-go-mod-tidy.sh` | Historical Go dependency maintenance; not used by the verifier or primary CI |
| `openapi/` | Legacy Go adapter schema/code generation |
| `security/` | Repository secret scanning and Git hook setup |
