# AdsPilot Agent-native roadmap v2 — 2026-09-06

> Historical v0.1 delivery plan. The owner subsequently clarified that personal
> account connection must not gate development or define product acceptance.
> Follow [documentation-driven v3](AGENT_ONBOARDING_v3_2026-09-06.md) for current
> conditional intake, agent-led setup/recovery and scenario-based acceptance.

## Product decision

The owner explicitly authorized P0/P1 implementation and corrected the earlier
local-first design. The primary product is an instruction-only AI Agent Skill.
It must not require a user-managed computer, server, daemon, database, or runtime.
Host-provided tools, authorized connectors, secrets, storage and scheduling
perform execution. Provider account consent may still be required.

This supersedes the product definition in the v1 intake, not its audit evidence.
Legacy AdsCenter is an optional adapter. Existing services/frontend remain
available for reference; they are not silently deleted or advertised as a
second supported product.

Legacy non-local/multi-user deployment is not production-approved. Its remaining
historic audit/read handlers need a separate ownership/tenant-isolation review
(for example operation-ID-based snapshot/shard queries) before any public use.
This patch is scoped urgent containment, not a whole-monorepo security audit.

## P0: urgent safety and truthful execution

| Workstream | Implemented in this branch | Still required |
| --- | --- | --- |
| P0.1 Verification | Primary Skill tests/packaging, full 36-module inventory, non-mutating Go verifier, PR CI | Observe remote CI; no claim frozen services/frontend all pass |
| P0.2 Real read path | Host capability/identity contract; legacy process-local credentials; distinct client/MCC IDs; v25 URL and representative parsing fixes | Connect actual host Google Ads tool and verify real identity, metadata, keywords and metrics |
| P0.3 Safe writes | Remove stub success; reject unsupported legacy execution; Skill defines exact validation/approval, durable claim and readback | Prove a paused-campaign creation through a capable host with explicitly scoped account/budget authorization |

HTTP 501 is deliberate containment of incomplete functionality, not completion
of the write golden path. v25 compile/unit tests cover representative requests,
not a certified migration of every historic Google operation. No advertising
account was modified during this development.

## P1: agent product and business loop

### P1.1 — loadable Agent Skill (implemented initial release)

- `skills/adspilot`: instruction-only v0.1.0, MIT, exact manifest inventory.
- Host capability discovery, readiness states and no-infrastructure fallback.
- I-Lang v4 execution + v5 judgment profile pinned to the owner's canonical
  specification commit; L1 advisory only, no invented runtime enforcement.
- Defined account/keyword/paused Search/optimization and evidence workflows.
- Developer-only strict upstream grammar/mode checks and ZIP packaging.
- Independent scenario review: missing tools, changed budget, unknown create
  outcome. This review is not live host certification or automated model eval.

Acceptance remaining: install on one nominated real agent host, verify tool
binding from observed schemas, and exercise its real authorization and durable
record boundaries. Marketplace publication is not yet performed.

### P1.2 — affiliate feedback loop (started, not complete)

The Skill now specifies advertiser eligibility, paid-search terms, product
pagination, provider-issued tracking links, opaque sub-ID mapping, commission
revision/deduplication, unmatched-record handling and Google conversion uploads.
All execution uses existing host capabilities; no tracking server is required
by this product. If the host lacks a consented click source or durable mapping,
attribution remains unavailable rather than invented.

Next implementation/acceptance work:

1. Bind a real authorized CJ tool/schema and verify offers and program terms.
2. Resolve the network-provided tracking link and host-held tracking mapping.
3. Import sample provider exports first; demonstrate duplicate/reversal and
   unmatched handling without uploading conversions.
4. Validate and, only under scoped authorization, upload the selected legitimate
   conversions and preserve per-item provider evidence.

The old Go CJ implementation is not silently promoted to production-ready.
Its full network integration remains unfinished and is not the Skill runtime.

### P1.3 — architecture boundaries (implemented initial boundary)

READMEs, contributor guidance, CI and inventory now distinguish the primary
Skill, optional active adapters and frozen historical assets. Deprecated
local-only handoff documents point here. Do not build new frontend login,
billing, proxy/browser service or database provisioning as prerequisites.

## Delivery sequence and completion evidence

1. Land urgent containment, credential fixes, reproducible tests and v0.1.0
   Skill in a review branch; do not merge on unobserved CI.
2. Connect the chosen agent host's existing Google Ads tools and prove read
   correctness on an authorized client account.
3. Validate a bounded, paused campaign, bind existing scoped approval or obtain
missing scope, submit once and read back all created resources.
4. Complete CJ attribution/reconciliation before adding autonomous optimization.

Only an evidenced provider result counts as live completion. A missing host
connector or account grant is a concrete external dependency, not a reason to
reintroduce user infrastructure. Keep independently executable development
work moving while that dependency is unresolved.

See `IMPLEMENTATION_STATE_v1_2026-09-06.md` for commands and recovery state,
and `PROJECT_MEMORY_v1_2026-09-06.md` for the durable current handoff.
