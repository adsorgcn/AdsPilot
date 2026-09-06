# AdsPilot

[中文](README.md)

An instruction-only advertising Skill installed and used by an AI agent,
governed by [I-Lang](https://ilang.ai/spec/).

**Users do not need to provide a computer, server, Docker, Go, Node, or database
for AdsPilot.** The agent host supplies execution, connected tools, permissions,
secret storage, and durable records. This is host-provided computing, not
computing without an execution environment.

## Install and use

Ask your agent to load [skills/adspilot](skills/adspilot/SKILL.md), or import the
versioned `adspilot-agent-v*.zip` using its host's skill import mechanism.
The folder is a loadable Skill, not a claim of marketplace publication or
certification across every agent platform.

> Load AdsPilot, discover your existing Google Ads and affiliate connectors,
> verify the account and data sources, then prepare keywords and a paused
> campaign plan for this product.

The package contains only Markdown instructions/references and a JSON
manifest. No install scripts, background processes, or bundled SDKs.
Missing tools produce explicit readiness limits and useful research/drafts,
not invented execution or instructions to deploy an AdsPilot server.
An account owner may still need to authorize Google/CJ through the host.

## Honest release status

Version 0.1.0 includes capability discovery, account and keyword workflows,
validated/approved campaign plans, execution evidence, affiliate research,
commission reconciliation, and conversion-upload instructions.

These are defined agent workflows, **not verified live provider integrations**.
Host connectors, durable operation claims, scoped grants, and provider readback
are required for real writes. Unknown create outcomes must be reconciled, not
blindly retried. CJ connectivity and the complete advertising-to-commission
loop still need real-host acceptance testing.

The optional Go AdsCenter adapter now fails explicitly for unsupported
execution instead of returning synthetic success. HTTP 501 is a mitigation,
not a completed advertising feature.

## Protocol

Pinned [official I-Lang specification](https://github.com/ilang-ai/ilang-spec)
commit: `f81e2bf1a952563ede3d45b814bb4a8482ba38cd`.

The skill uses v4.0-FINAL execution/security and v5.0 merged document 2.0.1
judgment serialization, including frozen Part II M1–M8 and `ine`.
It declares **L1 advisory only**; runtime enforcement belongs to the host.
v5 is public preview. Passing syntax/mode checks is not L2/L3 certification.

See [protocol binding](skills/adspilot/references/ilang.md),
[host contract](skills/adspilot/references/host.md), and
[records and approvals](skills/adspilot/references/records.md).

## Contributor checks

Development tools below are not installation requirements. No `npm install`
is needed for the primary checks.

```sh
node scripts/verify-agent-package.mjs
node --test tests/agent-package/*.test.mjs scripts/verify-go.test.mjs
node scripts/verify-go.mjs --inventory-only
python scripts/verify-ilang.py
python scripts/package-agent.py
```

For optional Go maintenance, run `node scripts/verify-go.mjs` with Go available.
It tests/builds AdsCenter default and `ads_live`, plus the Affiliate library,
without modifying manifests. The inventory covers 36 modules, not 36 passing
services. See [developer verification](scripts/README.md).

The main product is `skills/adspilot/`. Legacy services, frontend, and local
OAuth/deployment scripts are retained assets, not runtime dependencies.
The [v2 roadmap](docs/AGENT_NATIVE_ROADMAP_v2_2026-09-06.md) supersedes the
historical local-first product definition.

[MIT License](LICENSE)
