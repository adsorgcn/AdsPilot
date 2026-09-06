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

The package contains only Markdown instructions/references, JSON domain
contracts and a manifest. No install scripts, background processes, or bundled SDKs.
Missing tools trigger host capability discovery, conditional intake, a setup
packet and useful research/drafts; they do not trigger invented execution or
instructions to deploy an AdsPilot server.
An account owner may still need to authorize Google/CJ through the host.

## What the owner supplies

The agent discovers/fills existing facts first. The owner supplies the product,
goal, audience and (for campaign tasks) spending scope; selects an unresolved
account; and completes Google sign-in/consent or owner-only attestations.
Secrets go into the host's protected connection flow, never chat.

The agent prepares missing setup/application material, checks actual API
capabilities, diagnoses structured failures, repairs within its existing scope,
and resumes from evidence. Existing connector users need not obtain their own
developer token or Cloud project. Owner-managed API setup is a conditional path.
See [onboarding](skills/adspilot/references/onboarding.md) and
[recovery](skills/adspilot/references/troubleshooting.md).

Development and acceptance use official contracts plus diverse scenarios.
The author's personal account is neither a development prerequisite nor proof
that arbitrary users will have no bugs.

## Honest release status

Version 0.3.0 supplies 15 stable logical operations, two host-binding shapes,
conditional intake/recovery, exact Google report and paused Search plan
contracts, CJ delta reconciliation and checkpointing, and current Data Manager
versus eligible legacy conversion routes. Developer reference transformations
and synthetic scenarios exercise actual values and decisions, not prose matches.

These are defined agent workflows, **not verified live provider integrations**.
Host connectors, durable operation claims, scoped grants, and provider readback
are required for real writes. Unknown create outcomes must be reconciled, not
blindly retried. CJ connectivity and the complete advertising-to-commission
loop still need separately authorized real-host acceptance testing. Use the
[unified P0/P1 acceptance checklist](docs/P0_P1_ACCEPTANCE_v4_2026-09-07.md)
and the self-contained [user-agent acceptance](skills/adspilot/references/acceptance.md).

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
node scripts/verify-release.mjs
python scripts/package-agent.py
```

For optional Go maintenance, run `node scripts/verify-go.mjs` with Go available.
It tests/builds AdsCenter default and `ads_live`, plus the Affiliate library,
without modifying manifests. The inventory covers 36 modules, not 36 passing
services. See [developer verification](scripts/README.md).

The main product is `skills/adspilot/`. Legacy services, frontend, and local
OAuth/deployment scripts are retained assets, not runtime dependencies.
The [v4 unified acceptance plan](docs/P0_P1_ACCEPTANCE_v4_2026-09-07.md)
is current; earlier v1/v2/v3 reports retain historical audit/design evidence.

[MIT License](LICENSE)
