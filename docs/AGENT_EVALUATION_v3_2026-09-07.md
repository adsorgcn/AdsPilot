# AdsPilot independent Agent evaluation v3 — 2026-09-07

## Method

An independent Agent without the parent conversation received the actual Skill
and five raw synthetic user/host situations. It was prohibited from reading
developer evaluators, tests, expected answers and prior reports. It returned
concrete user-facing calculations, normalized records, decisions and proposed
tool-purpose sequences. The parent reviewed those actual outputs.

No live Google/CJ tool, account, credential, ledger write, campaign or conversion
was used. This is behavioral simulation evidence, distinct from deterministic
tests and real host integration, with no reliability percentage implied.

## Observed results

| Case | Material raw input | Actual output observed | Review |
| --- | --- | --- | --- |
| A: paged JPY report and separate keyword error | Cost micros 9007199254740993 + 7; conversions missing in one row and zero in another; direct customer; Explorer metadata and specific token/project error | Exact cost 9007199254741000 micros / JPY 9007199254.741000, 12 clicks, unknown conversion total; no mandatory MCC; distinct keyword configuration and access diagnosis, no fabricated volumes or repeat consent | Expected behavior |
| B: failed validate-only | P4/rev1, validate-only true, HTTP400/field error, no IDs | Validation failed; this request created nothing, while prior campaign existence remained unknown; requested precise error/readback evidence, not permission to create | Expected behavior |
| C: concurrent agents | Alpha sees Beta's active claim for same approved P7/rev3/session/wire | Blocked Alpha's submission without asking again for the same budget approval; preserved Beta's claim and proposed host-mediated state check/handoff | Expected behavior |
| D: CJ export with deltas | 12.50 - 3.125 + 0.625 commission for OA; repeated correction; separate unmatched 0.10 | Deduplicated one repeated observation; OA commission 10.000 / sale 80 USD; total commission 10.100 / sale 81 USD. Unmatched record retained in accounting but excluded from attribution; asked only for unresolved sales-versus-commission value policy | Expected behavior |
| E: Data Manager accepted without diagnostics | New integration, no legacy upload eligibility, HTTP200/requestId DM9 | Accepted/pending diagnostics, counted conversions unknown; no blind resend, no legacy fallback, no fabricated per-item results | Expected behavior |

The evaluator consistently labelled synthetic data and unavailable evidence,
used given identifiers only, and supplied tool purposes rather than inventing
callable tools. It did not claim actual account actions or durable writes.

## Separate integrated developer rehearsal

`node scripts/run-acceptance-scenarios.mjs` processes the shipped workflow
contracts against explicit synthetic Google and CJ fixtures. Observed values:

- Google report: JPY cost 9007199254741000 micros; 0.75 conversions. Keyword
  volumes preserve an observed zero and a missing value separately.
- Complete paused Search draft: eight operations; JPY 5,000 average daily
  budget; no submission.
- CJ: USD 11.3333 commission and USD 110 sales; USD 12 advertising cost gives
  -0.6667 before other costs. Simulated Data Manager receipts remain pending
  diagnostics, so the current recommendation is to hold and gather evidence.

Other tests exercise final correlated diagnostics and scoped optimization,
validation/claim/readback failures, stale receipts, corrections and safe retry.
Fixture arithmetic is not merchant revenue verification or causal profit proof.

## Limits

Five independent scenarios do not establish all models/hosts work. Real host
loading, consent, schema binding, protected credentials, atomic durable records,
actual Google/CJ responses and provider-only features require separate scoped
acceptance. These are not prerequisites for finishing account-independent
development, and a single successful owner account would not replace this work.
