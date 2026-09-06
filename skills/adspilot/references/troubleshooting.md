# Evidence-driven recovery

Read this when onboarding fails, a provider call fails, or a session resumes
after an uncertain call. Use the data-only [recovery catalog](../contracts/recovery-catalog.json)
to select a bounded recovery action. Its codes guide the agent; they are not
tools, Google guarantees, or a substitute for host enforcement. See
[host capabilities](host.md) and [execution records](records.md) for those
boundaries.

## Diagnose before choosing a repair

Capture a redacted failure record: provider, observed tool and method, API
version, timestamp, intended customer and optional login customer, read versus
validate-only versus write, plan/revision, submission evidence, HTTP/gRPC
status, typed error code, field location, operation index, and request-id when
returned. Include any prior host-internal retries. Never capture Authorization
headers, developer tokens, client secrets, refresh tokens or authorization
codes. A request-id is diagnostic correlation, not an idempotency key.
[Google error structure](https://developers.google.com/google-ads/api/docs/best-practices/understand-api-errors)
and [call metadata](https://developers.google.com/google-ads/api/docs/concepts/call-structure).

Match the response's structured namespace, not a substring of prose. Inspect
canonical status, all detailed errors and partial-failure entries, including
responses with HTTP 200. Prefer the most specific evidenced rule. `HOST_*`
codes are internal observations defined by AdsPilot, never fabricated Google
responses. A possible submitted mutation with no definitive outcome takes
precedence over every generic retry rule. A missing response does not prove
Google rejected the write.

OAuth `invalid_grant` is not synonymous with an expired access token: inspect
the token endpoint's exchange stage and `grant_type`. A rejected authorization
code needs a fresh connection flow; a rejected refresh grant requires checking
its binding and possibly renewed consent. In contrast, an ordinary Ads
`OAUTH_TOKEN_EXPIRED` can use the host's existing refresh facility. HTTP 401
alone proves neither diagnosis.
[OAuth exchange and refresh errors](https://developers.google.com/identity/protocols/oauth2/web-server).

Do not treat every `RESOURCE_EXHAUSTED` or HTTP 429 as a daily quota. Inspect
rate/query-cost/usage evidence; an oversized gRPC response can also produce
resource exhaustion. Keep long-term/daily limits deferred until an evidenced
reset or corrected plan, and avoid evasion by rotating accounts or tokens.
[Google quotas](https://developers.google.com/google-ads/api/docs/best-practices/quotas).

## Let the agent do the work it can actually do

The catalog's `actor` identifies who controls the decisive fix:

| Actor | What the agent does now |
| --- | --- |
| `agent` | Inspect evidence, look up the exact current schema, repair a draft/query or reconcile state within existing scope |
| `owner` | Prepare everything possible and ask only for the missing consent, business fact, account choice or scoped decision |
| `host` | Produce a precise `capability_request` or connector-configuration request; bind an existing compatible capability if available |
| `provider` | Prepare the relevant review/support material; do not pretend the agent can grant Google's approval |

`automatic: true` permits the described action under existing authority, not
permission to create accounts, invite users, upgrade quotas, purchase anything,
raise budgets, enable paused campaigns, change destinations or bypass review.
`automatic: false` does not prevent autonomous diagnosis and preparation; it
means the decisive external correction needs its actual actor. The integration
owner may be the host vendor, not the advertiser. Ask the advertiser to supply
developer-token/project configuration only in an explicit bring-your-own-app
route, using the host's secure submission interface.

When a connector, protected secret path or execution boundary is missing,
return data containing `type: capability_request`, logical capability, observed
missing evidence, affected workflow, required method/auth/account scope, and
the host-side next action. Keep useful plans and supplied-data analysis moving.
Do not turn a missing host capability into a request for a user's server,
terminal or local credential file. The secret-store and durable-write boundaries
are AdsPilot product requirements; the cited Google pages support credential
and API behavior, not certification of those host capabilities.

## Bounded automatic recovery

Use each rule's `retry_policy` and `stop_condition`. Unless a narrower rule
applies, AdsPilot's chosen transient-recovery policy is up to three retries
with exponential delay starting at 5 seconds and jitter, subject to the user's
wait budget and a longer provider-provided delay. These numbers are product
defaults, not Google-mandated constants. Use host scheduling for long waits;
without it, report the eligible resume time instead of promising a background
worker. [Google recommends bounded exponential backoff](https://developers.google.com/google-ads/api/docs/best-practices/error-types).

Counters belong to the logical operation and failure family, including hidden
connector retries. A new session, new name or semantically unchanged revision
does not reset them. Two evidence-backed payload repairs may each be validated;
repeating the same invalid payload without a correction is not a repair.
Pause the affected action when its bound is reached; continue independent
work and return the exact dependency needed to resume.

A `confirmed_rejected_mutation` is one whose definitive provider result proves
the particular operation was not applied. An HTTP code, absent result, local
timeout, request-id or lack of an immediately visible resource is insufficient
by itself. Any later retry still needs current authorization, the correct
ledger claim and exact provider validation. Respect an intentional user stop.

For unknown outcome, keep the operation claim and reconcile with read-only
calls using exact resource IDs or multiple plan attributes. Names alone are
not unique. Ambiguous or unavailable readback remains `unknown_outcome`; do
not resubmit a create to find out what happened. For partial failure, preserve
applied resource IDs and failed indices, then recover only proven unapplied
operations. [Google partial-failure semantics](https://developers.google.com/google-ads/api/docs/best-practices/partial-failures).

## Repair the plan, not its safety conditions

Field errors should trigger official-schema lookup and the smallest draft
correction. Derive values only from verified account metadata or supplied
business facts. Do not auto-raise a budget to satisfy a minimum, manufacture a
political-advertising declaration, replace a removed resource, or silently
change dates, targeting or product claims to make validation pass. Changed
payloads receive a new revision, fresh exact-payload validation and a current
approval binding. A standing grant can be reused only when the host confirms
it covers the revised plan; old plan-specific approval is not transferable.

For a policy rejection, read its actual policy topic, draft compliant creative
where supported by facts, and revalidate. A review/exemption is a distinct,
explicitly authorized workflow; do not evade enforcement or automatically
assert an exception. [Policy error details and review routes](https://developers.google.com/google-ads/api/docs/policy-exemption/overview).

For `UNSUPPORTED_VERSION`, read the current
[sunset schedule](https://developers.google.com/google-ads/api/docs/sunset-dates)
and migration guidance, then verify an actually exposed compatible binding.
Do not infer sunset from HTTP 404/501 alone or merely replace a version number
and call the integration repaired.

## Return only the unresolved work to the user

Report the plain-language problem, what the agent checked or repaired, actual
execution state, and the smallest remaining action. A useful owner request is
"Reconnect Google Ads using your AI platform's connection button; I will reuse
the prepared plan after checking the account," not "set up a server." A useful
host request identifies the missing method or protected credential capability,
not an invented tool name.

If recovery cannot finish, preserve a support packet with rule ID, request-id,
method/version, redacted structured error, attempts, plan revision, provider
state and next responsible actor. It must be resumable without repeating an
uncertain mutation or requiring the AdsPilot repository owner's account.
Catalog/fixture success verifies covered decisions only; it does not establish
that every host, account, API version or advertisement is bug-free.
